const documentQueue = require('./queue');
const db = require('../db/db');
const hasher = require('./hasher');
const ocr = require('./ocr');
const forensics = require('./forensics');
const signature = require('./signature');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getBucket } = require('../db/mongodb');

function initProcessor() {
    documentQueue.process(1, async (job) => {
        const { filePath, originalname, mimetype, uploadedBy } = job.data;

        try {
            // Validate file exists
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            const bucket = getBucket();
            if (!bucket) {
                throw new Error('MongoDB connection not ready');
            }

            // ── Step 1: Upload to GridFS (0→25%) ──
            await job.progress(0);

            const uploadStream = bucket.openUploadStream(originalname, {
                contentType: mimetype
            });
            const gridfsId = uploadStream.id.toString();

            await new Promise((resolve, reject) => {
                fs.createReadStream(filePath)
                    .pipe(uploadStream)
                    .on('error', reject)
                    .on('finish', resolve);
            });

            await job.progress(25);

            // ── Step 2: Generate Hashes (25→50%) ──
            const fileHash = hasher.generateFileHash(filePath);
            const prevHash = hasher.getLastBlockHash(db);
            const timestamp = new Date().toISOString();
            const blockHash = hasher.generateBlockHash(fileHash, prevHash, timestamp);

            await job.progress(50);

            // ── Step 3: AI Analysis — OCR, Forensics, Signature (50→75%) ──
            let ocrText = null;
            let ocrHash = null;
            let forensicScore = null;
            let signatureScore = null;

            if (/png|jpg|jpeg/.test(mimetype)) {
                ocrText = await ocr.extractText(filePath);
                if (ocrText) ocrHash = crypto.createHash('sha256').update(ocrText).digest('hex');

                const forensicReport = await forensics.analyzeImage(filePath);
                const sigReport = await signature.detectSignature(filePath);

                if (!sigReport.signature_found) {
                    forensicReport.flags.push('No signature detected in typical signing areas');
                }

                forensicScore = JSON.stringify(forensicReport);
                signatureScore = JSON.stringify(sigReport);
            }

            await job.progress(75);

            // ── Step 4: Store in SQLite + Audit Log (75→100%) ──
            const insertDoc = db.prepare(`
                INSERT INTO documents (filename, file_type, uploaded_by, upload_timestamp, file_hash, prev_hash, block_hash, ocr_text, ocr_hash, forensic_score, signature_score, storage_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const result = insertDoc.run(originalname, mimetype, uploadedBy, timestamp, fileHash, prevHash, blockHash, ocrText, ocrHash, forensicScore, signatureScore, gridfsId);
            const documentId = result.lastInsertRowid;

            db.prepare(`INSERT INTO audit_log (document_id, action, actor, details) VALUES (?, ?, ?, ?)`)
                .run(documentId, 'UPLOAD', uploadedBy, `File ${originalname} processed via batch queue`);

            // Cleanup temp file
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

            await job.progress(100);

            console.log(`[PROCESSOR] ✓ Job #${job.id} completed → Block #${documentId} (${originalname})`);

            return {
                document_id: documentId,
                block_hash: blockHash,
                gridfs_id: gridfsId,
                filename: originalname
            };

        } catch (error) {
            // Cleanup temp file on failure
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            console.error(`[PROCESSOR] ✗ Job #${job.id} failed (${originalname}):`, error.message);
            throw error; // Bull marks the job as failed
        }
    });

    documentQueue.on('completed', (job, result) => {
        console.log(`[QUEUE] Job #${job.id} completed:`, result.filename);
    });

    documentQueue.on('failed', (job, err) => {
        console.error(`[QUEUE] Job #${job.id} failed:`, err.message);
    });

    console.log('[PROCESSOR] Queue processor initialized (concurrency: 1)');
}

module.exports = { initProcessor };
