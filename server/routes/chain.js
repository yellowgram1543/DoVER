const express = require('express');
const router = express.Router();
const db = require('../db/db');
const documentQueue = require('../utils/queue');
const gemini = require('../utils/gemini');
const report = require('../utils/report');

/**
 * Helper to check if a user can access a specific document.
 * Authority can access all. Regular users can only access their own.
 */
function canAccessDocument(user, document) {
    if (!user) return false;
    if (user.role === 'authority') return true;
    return document.uploaded_by === user.name || document.uploader_email === user.email;
}

router.get('/', (req, res) => {
    try {
        const isAuthority = req.user && req.user.role === 'authority';
        let documents;
        if (isAuthority) {
            documents = db.prepare('SELECT * FROM documents ORDER BY block_index ASC').all();
        } else {
            // Check both name and email for robustness, as some legacy docs might lack email
            documents = db.prepare('SELECT * FROM documents WHERE uploaded_by = ? OR uploader_email = ? ORDER BY block_index ASC').all(req.user.name, req.user.email);
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
        let auditLogs;
        if (isAuthority) {
            auditLogs = db.prepare(`
                SELECT a.document_id, d.filename, a.action, a.actor, a.timestamp, a.details
                FROM audit_log a
                JOIN documents d ON a.document_id = d.block_index
                ORDER BY a.timestamp DESC
            `).all();
        } else {
            auditLogs = db.prepare(`
                SELECT a.document_id, d.filename, a.action, a.actor, a.timestamp, a.details
                FROM audit_log a
                JOIN documents d ON a.document_id = d.block_index
                WHERE d.uploaded_by = ? OR d.uploader_email = ?
                ORDER BY a.timestamp DESC
            `).all(req.user.name, req.user.email);
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

        if (!canAccessDocument(req.user, document)) {
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

        if (!canAccessDocument(req.user, doc)) {
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

        // Fetch all jobs across every state in parallel
        const [waiting, active, completed, failed, delayed] = await Promise.all([
            documentQueue.getWaiting(),
            documentQueue.getActive(),
            documentQueue.getCompleted(),
            documentQueue.getFailed(),
            documentQueue.getDelayed()
        ]);

        const allJobs = [...waiting, ...active, ...completed, ...failed, ...delayed];

        // Filter to jobs belonging to this batch
        let batchJobs = allJobs.filter(j => j.data.batch_id === batchId);

        if (batchJobs.length === 0) {
            return res.status(404).json({ success: false, error: 'No jobs found for this batch_id' });
        }

        // RBAC: Ensure user owns this batch OR is authority
        const isAuthority = req.user && req.user.role === 'authority';
        const ownsBatch = batchJobs.every(j => j.data.uploadedBy === req.user.name || j.data.uploaderEmail === req.user.email);
        
        if (!isAuthority && !ownsBatch) {
            return res.status(403).json({ success: false, error: 'Permission denied' });
        }

        // Map each job to a clean status object
        const jobs = batchJobs.map(j => {
            let status;
            if (waiting.find(x => x.id === j.id))   status = 'queued';
            else if (active.find(x => x.id === j.id)) status = 'processing';
            else if (failed.find(x => x.id === j.id)) status = 'failed';
            else                                       status = 'completed';

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
        if (!canAccessDocument(req.user, currentDoc)) {
            return res.status(403).json({ success: false, error: 'Permission denied' });
        }

        const targetFilename = currentDoc.filename;
        const targetEmail = currentDoc.uploader_email;

        // 2. Trace back to the root document (parent_document_id is NULL)
        let rootId = currentDoc.block_index;
        let parentId = currentDoc.parent_document_id;
        let safety = 0;
        
        while (parentId !== null && safety < 50) {
            const parent = db.prepare('SELECT block_index, parent_document_id, filename, uploader_email FROM documents WHERE block_index = ?').get(parentId);
            
            // STRICT LINEAGE: Stop if parent metadata mismatch
            if (!parent || parent.filename !== targetFilename || parent.uploader_email !== targetEmail) {
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
                WHERE d.filename = ? AND (d.uploader_email = ? OR (d.uploader_email IS NULL AND ? IS NULL))
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

module.exports = router;
