const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../db/db');
const hasher = require('../utils/hasher');
const ocr = require('../utils/ocr');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
const upload = multer({ dest: 'uploads/' });

router.post('/', upload.single('file'), async (req, res) => {
    try {
        if (!req.body.document_id && !req.file) {
            return res.status(400).json({ success: false, error: 'Provide a document ID or file' });
        }

        let doc;
        if (req.body.document_id) {
            doc = db.prepare('SELECT * FROM documents WHERE block_index = ?').get(req.body.document_id);
        } else if (req.file) {
            const fileHash = hasher.generateFileHash(req.file.path).trim();
            doc = db.prepare('SELECT * FROM documents WHERE trim(file_hash) = ?').get(fileHash);
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        }

        if (!doc) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        const verification = hasher.verifyDocument(doc.block_index, db);
        
        // OCR-4: Implementation
        let ocr_valid = null;
        let ocr_tampered = null;
        let ocr_change_detected = null;
        let ocr_text = null;
        let stored_ocr_text = doc.ocr_text;

        if (doc.ocr_hash) {
            let targetPath = doc.filename;
            if (!path.isAbsolute(targetPath)) {
                targetPath = path.resolve(__dirname, '..', '..', 'uploads', targetPath);
            }

            if (fs.existsSync(targetPath)) {
                ocr_text = await ocr.extractText(targetPath);
                const currentOcrHash = crypto.createHash('sha256').update(ocr_text).digest('hex');
                
                ocr_valid = (currentOcrHash.trim() === doc.ocr_hash.trim());
                ocr_tampered = !ocr_valid;
                ocr_change_detected = !ocr_valid;
            }
        }

        // Final status and logging
        if (!verification.valid || ocr_tampered) {
            db.prepare('UPDATE documents SET is_tampered = 1 WHERE block_index = ?').run(doc.block_index);
            const detail = ocr_tampered ? 'OCR content mismatch detected.' : 'File hash mismatch detected.';
            db.prepare(`
                INSERT INTO audit_log (document_id, action, actor, details)
                VALUES (?, ?, ?, ?)
            `).run(doc.block_index, 'TAMPER_DETECTED', 'SYSTEM_VERIFIER', `Verification failed. ${detail}`);
        } else {
             db.prepare(`
                INSERT INTO audit_log (document_id, action, actor, details)
                VALUES (?, ?, ?, ?)
            `).run(doc.block_index, 'VERIFIED', 'SYSTEM_VERIFIER', `Document verified successfully.`);
        }

        res.json({
            valid: verification.valid,
            document_id: doc.block_index,
            original_hash: doc.file_hash,
            computed_hash: verification.details.computedFileHash,
            tampered: !verification.valid || (ocr_tampered === true),
            timestamp: doc.upload_timestamp,
            uploaded_by: doc.uploaded_by,
            ocr_valid,
            ocr_tampered,
            ocr_change_detected,
            ocr_text,
            stored_ocr_text
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Verification failed' });
    }
});

module.exports = router;
