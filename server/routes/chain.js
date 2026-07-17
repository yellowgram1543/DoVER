const express = require('express');
const router = express.Router();
const db = require('../db/db');
const documentQueue = require('../utils/queue');
const gemini = require('../utils/gemini');
const report = require('../utils/report');
const signatureEngine = require('../utils/signature_engine');
const { getBucket, mongoose } = require('../db/mongodb');
const fs = require('fs');
const path = require('path');
const { emailsEqual } = require('../utils/email');

/**
 * Helper to check if a user can access the full content/files of a document.
 * Authority can access all. Regular users can only access their own.
 * Note: Metadata is now visible to all in the Global Ledger for transparency.
 */
function canAccessFullContent(user, document) {
    if (!user) return false;
    if (user.role === 'authority') return true;
    return emailsEqual(document.uploader_email, user.email);
}

router.get('/', (req, res) => {
    try {
        const isAuthority = req.user && req.user.role === 'authority';
        const isLoggedIn = !!req.user;
        const mode = req.query.mode || 'b2c'; // Default to personal vault mode
        
        if (!isLoggedIn) {
            return res.json([]);
        }

        let documents;
        if (isAuthority) {
            // Authorities see everything for oversight
            documents = db.prepare('SELECT block_index, filename, file_type, uploaded_by, uploader_email, department, upload_timestamp, file_hash, block_hash, is_tampered, version_number, polygon_txid, merkle_root, merkle_proof FROM documents ORDER BY block_index DESC').all();
        } else if (mode === 'b2b') {
            // Institutional Ledger: Show documents that belong to B2B categories.
            const b2bDepts = ['Employee Records', 'Financial Audit', 'Compliance', 'Legal', 'Executive Office']; 
            const placeholders = b2bDepts.map(() => '?').join(',');
            
            // SECURITY FIX: Filter by uploader_email so standard users can only see their own B2B documents.
            documents = db.prepare(`
                SELECT block_index, filename, file_type, uploaded_by, uploader_email, department, upload_timestamp, file_hash, block_hash, is_tampered, version_number, polygon_txid, merkle_root, merkle_proof 
                FROM documents 
                WHERE department IN (${placeholders}) AND LOWER(uploader_email) = LOWER(?)
                ORDER BY block_index DESC
            `).all(...b2bDepts, req.user.email);
        } else {
            // Personal Ledger (B2C): Show only personal records.
            // We EXCLUDE B2B departments to ensure a clean separation.
            const b2bDepts = ['Employee Records', 'Financial Audit', 'Compliance', 'Legal', 'Executive Office'];
            const placeholders = b2bDepts.map(() => '?').join(',');
            
            documents = db.prepare(`
                SELECT block_index, filename, file_type, uploaded_by, uploader_email, department, upload_timestamp, file_hash, block_hash, is_tampered, version_number, polygon_txid, merkle_root, merkle_proof 
                FROM documents 
                WHERE LOWER(uploader_email) = LOWER(?) 
                AND department NOT IN (${placeholders})
                ORDER BY block_index DESC
            `).all(req.user.email, ...b2bDepts);
        }
        
        res.json(documents);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Failed to retrieve chain' });
    }
});

router.get('/audit', (req, res) => {
    try {
        const isAuthority = req.user && req.user.role === 'authority';
        const isLoggedIn = !!req.user;
        let auditLogs;
        if (isAuthority) {
            auditLogs = db.prepare(`
                SELECT a.document_id, d.filename, a.action, a.actor, a.timestamp, a.details
                FROM audit_log a
                LEFT JOIN documents d ON a.document_id = d.block_index
                ORDER BY a.timestamp DESC
            `).all();
        } else if (isLoggedIn) {
            auditLogs = db.prepare(`
                SELECT a.document_id, d.filename, a.action, a.actor, a.timestamp, a.details
                FROM audit_log a
                LEFT JOIN documents d ON a.document_id = d.block_index
                WHERE LOWER(d.uploader_email) = LOWER(?)
                ORDER BY a.timestamp DESC
            `).all(req.user.email);
        } else {
            auditLogs = []; // Guests don't see private audit trails
        }
        res.json(auditLogs);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Failed to retrieve audit logs' });
    }
});

router.get('/document/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const document = db.prepare('SELECT * FROM documents WHERE block_index = ?').get(id);

        if (!document) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        if (!canAccessFullContent(req.user, document)) {
            return res.status(403).json({ success: false, error: 'Permission denied' });
        }

        res.json(document);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Failed to retrieve document details' });
    }
});

router.get('/document/:id/history', (req, res) => {
    try {
        const doc = db.prepare('SELECT uploaded_by, uploader_email FROM documents WHERE block_index = ?').get(req.params.id);
        if (!doc) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        if (!canAccessFullContent(req.user, doc)) {
            return res.status(403).json({ success: false, error: 'Permission denied' });
        }

        const history = db.prepare(`
            SELECT a.document_id, d.filename, a.action, a.actor, a.timestamp, a.details
            FROM audit_log a
            JOIN documents d ON a.document_id = d.block_index
            WHERE a.document_id = ?
            ORDER BY a.timestamp DESC
        `).all(req.params.id);
        res.json(history);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Failed to retrieve document history' });
    }
});

// ── Batch Status ──
router.get('/batch/:batch_id/status', async (req, res) => {
    try {
        const batchId = parseInt(req.params.batch_id);

        // Fetch all jobs in parallel by checking the states selectively or getting a list of IDs.
        // Bull doesn't have a "getJobsByData" method, but we can avoid pulling all contents.
        // For this prototype, we'll use a more targeted approach if we had job IDs stored,
        // but since we don't store batch->job mapping in DB yet, we'll keep the logic but 
        // optimize it to not pull every job's full data if possible.
        
        const [waiting, active, completed, failed] = await Promise.all([
            documentQueue.getWaiting(),
            documentQueue.getActive(),
            documentQueue.getCompleted(),
            documentQueue.getFailed()
        ]);

        const allJobs = [...waiting, ...active, ...completed, ...failed];
        const batchJobs = allJobs.filter(job => job && job.data && job.data.batch_id === batchId);

        if (batchJobs.length === 0) {
            return res.status(404).json({ success: false, error: 'No jobs found for this batch_id' });
        }

        // RBAC: Ensure user owns this batch OR is authority
        const isAuthority = req.user && req.user.role === 'authority';
        const ownsBatch = req.user && batchJobs.every(j => emailsEqual(j.data.uploaderEmail, req.user.email));
        
        if (!isAuthority && !ownsBatch) {
            return res.status(403).json({ success: false, error: 'Permission denied' });
        }

        const waitingIds = waiting.map(j => j.id);
        const activeIds = active.map(j => j.id);
        const failedIds = failed.map(j => j.id);
        const completedIds = completed.map(j => j.id);

        // Map each job to a clean status object
        const jobs = batchJobs.map(j => {
            let status;
            if (waitingIds.includes(j.id))        status = 'queued';
            else if (activeIds.includes(j.id))    status = 'processing';
            else if (failedIds.includes(j.id))    status = 'failed';
            else if (completedIds.includes(j.id)) status = 'completed';
            else                                  status = 'unknown';

            return {
                job_id: j.id,
                filename: j.data.originalname,
                status,
                progress: j._progress || 0,
                error: j.failedReason || null,
                document_id: j.returnvalue ? j.returnvalue.document_id : null
            };
        });

        const counts = jobs.reduce((acc, j) => {
            acc[j.status] = (acc[j.status] || 0) + 1;
            return acc;
        }, {});

        res.json({
            batch_id: batchId,
            total: jobs.length,
            completed: counts.completed || 0,
            failed: counts.failed || 0,
            processing: counts.processing || 0,
            queued: counts.queued || 0,
            jobs
        });

    } catch (error) {
        console.error('[BATCH_STATUS_ERROR]', error);
        res.status(500).json({ success: false, error: 'Failed to get batch status' });
    }
});

router.get('/document/:id/versions', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        
        // 1. Find the current document
        let currentDoc = db.prepare('SELECT block_index, parent_document_id, uploaded_by, uploader_email, filename FROM documents WHERE block_index = ?').get(id);
        if (!currentDoc) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        // RBAC check
        if (!canAccessFullContent(req.user, currentDoc)) {
            return res.status(403).json({ success: false, error: 'Permission denied' });
        }

        const targetFilename = currentDoc.filename;
        const targetEmail = currentDoc.uploader_email;

        // 2. Trace back to the root document (parent_document_id is NULL)
        let rootId = currentDoc.block_index;
        let parentId = currentDoc.parent_document_id;
        let safety = 0;
        
        while (parentId !== null && safety < 5000) {
            const parent = db.prepare('SELECT block_index, parent_document_id, filename, uploader_email FROM documents WHERE block_index = ?').get(parentId);
            
            // STRICT LINEAGE: Stop if parent metadata mismatch
            if (!parent || parent.filename !== targetFilename || !emailsEqual(parent.uploader_email, targetEmail)) {
                break;
            }

            rootId = parent.block_index;
            parentId = parent.parent_document_id;
            safety++;
        }

        // 3. Fetch all documents in the version chain starting from root
        // Using a recursive CTE to find all descendants, filtering by metadata for safety
        const versions = db.prepare(`
            WITH RECURSIVE descendants(id) AS (
                SELECT block_index FROM documents WHERE block_index = ?
                UNION
                SELECT d.block_index 
                FROM documents d 
                JOIN descendants ON d.parent_document_id = descendants.id
                WHERE d.filename = ? AND (LOWER(d.uploader_email) = LOWER(?) OR (d.uploader_email IS NULL AND ? IS NULL))
            )
            SELECT 
                version_number,
                block_index as document_id,
                filename,
                uploaded_by,
                upload_timestamp,
                version_note,
                block_hash,
                is_tampered
            FROM documents 
            WHERE block_index IN descendants 
            ORDER BY version_number ASC
        `).all(rootId, targetFilename, targetEmail, targetEmail);

        res.json(versions);
    } catch (error) {
        console.error('[VERSIONS_ERROR]', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve version history' });
    }
});

/**
 * Manual trigger for Gemini AI analysis.
 * Restricted to authorities.
 */
router.post('/document/:id/analyze', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const document = db.prepare('SELECT block_index, ocr_text, forensic_score FROM documents WHERE block_index = ?').get(id);

        if (!document) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        // RBAC: Only authorities can trigger manual AI analysis
        if (!req.user || req.user.role !== 'authority') {
            return res.status(403).json({ success: false, error: 'Authority privileges required' });
        }

        if (!document.ocr_text) {
            return res.status(400).json({ success: false, error: 'Document lacks OCR text for analysis' });
        }

        const forensicReport = document.forensic_score ? JSON.parse(document.forensic_score) : {};
        const summary = await gemini.generateDocumentSummary(document.ocr_text, forensicReport);

        db.prepare('UPDATE documents SET ai_summary = ? WHERE block_index = ?').run(JSON.stringify(summary), id);

        db.prepare(`INSERT INTO audit_log (document_id, action, actor, details) VALUES (?, ?, ?, ?)`)
            .run(id, 'AI_REANALYZE', req.user.name, 'Manual Gemini AI analysis triggered by authority');

        res.json({
            success: true,
            summary
        });

    } catch (error) {
        console.error('[AI_ANALYZE_ERROR]', error);
        res.status(500).json({ success: false, error: 'AI Analysis failed: ' + error.message });
    }
});

/**
 * Official Audit Report Export.
 * Restricted to authorities.
 */
router.get('/document/:id/report', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        
        // RBAC: Authority only
        if (!req.user || req.user.role !== 'authority') {
            return res.status(403).json({ success: false, error: 'Authority privileges required' });
        }

        const pdfBuffer = await report.generateAuditReport(id);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=DoVER_Audit_Report_${id}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[REPORT_ENDPOINT_ERROR]', error);
        res.status(500).json({ success: false, error: 'Failed to generate report: ' + error.message });
    }
});

const { PDFDocument } = require('pdf-lib');

/**
 * Official Certified Document Export (Signed PDF).
 * Restricted to authorities.
 */
router.get('/document/:id/certified', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        
        // 1. Fetch metadata from SQLite
        const doc = db.prepare('SELECT * FROM documents WHERE block_index = ?').get(id);
        if (!doc) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        // RBAC: Authority OR Document Owner
        if (!canAccessFullContent(req.user, doc)) {
            return res.status(403).json({ success: false, error: 'Permission denied' });
        }

        // 2. Fetch original file from GridFS
        const bucket = getBucket();
        const storageId = doc.storage_id || doc.filename;
        
        if (!mongoose.Types.ObjectId.isValid(storageId)) {
            throw new Error('Invalid storage ID for certification');
        }

        const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(storageId));
        const chunks = [];
        for await (const chunk of downloadStream) {
            chunks.push(chunk);
        }
        let fileBuffer = Buffer.concat(chunks);

        // ── Image-to-PDF Conversion (CRITICAL FIX) ──
        // If the file is an image, we MUST wrap it in a PDF before signing.
        if (doc.file_type.includes('image') || /jpg|jpeg|png/.test(doc.filename.toLowerCase())) {
            console.log(`[CERTIFY] Converting ${doc.file_type} to PDF container...`);
            const pdfDoc = await PDFDocument.create();
            const image = doc.file_type.includes('png') ? await pdfDoc.embedPng(fileBuffer) : await pdfDoc.embedJpg(fileBuffer);
            
            const page = pdfDoc.addPage([image.width, image.height]);
            page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
            
            fileBuffer = Buffer.from(await pdfDoc.save());
        }

        // 3. Prepare Proof Data for embedding
        const proof = {
            block_index: doc.block_index,
            block_hash: doc.block_hash,
            file_hash: doc.file_hash,
            timestamp: doc.upload_timestamp,
            uploaded_by: doc.uploaded_by,
            forensic_score: doc.forensic_score ? JSON.parse(doc.forensic_score) : null,
            ocr_hash: doc.ocr_hash,
            system: 'DoVER Decentralized Vault'
        };

        // 4. Sign and Certify
        console.log(`[CERTIFY] Generating signed PDF for Block #${id}...`);
        const signedBuffer = await signatureEngine.signPdf(fileBuffer, {
            reason: 'Official Document Certification',
            location: 'DoVER Digital Vault',
            proof: proof
        });

        // 5. Send Result
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=DoVER_Certified_${id}.pdf`);
        res.send(signedBuffer);

    } catch (error) {
        console.error('[CERTIFY_ENDPOINT_ERROR]', error);
        res.status(500).json({ success: false, error: 'Certification failed: ' + error.message });
    }
});

module.exports = router;
