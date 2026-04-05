const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../db/db');
const hasher = require('../utils/hasher');

const fs = require('fs');
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

const upload = multer({ dest: 'uploads/' });

router.post('/', upload.single('file'), (req, res) => {
    try {
        if (!req.body.document_id && !req.file) {
            return res.status(400).json({ success: false, error: 'Provide a document ID or file' });
        }

        let doc;
        if (req.body.document_id) {
            doc = db.prepare('SELECT * FROM documents WHERE block_index = ?').get(req.body.document_id);
        } else if (req.file) {
            const fileHash = hasher.generateFileHash(req.file.path).trim();
            // Using TRIM in SQL ensures we find it even if the DB has whitespace
            doc = db.prepare('SELECT * FROM documents WHERE trim(file_hash) = ?').get(fileHash);
            // We don't need the uploaded file anymore for this specific comparison logic
            require('fs').unlinkSync(req.file.path);
        }

        if (!doc) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        const verification = hasher.verifyDocument(doc.block_index, db);
        
        if (!verification.valid) {
            db.prepare('UPDATE documents SET is_tampered = 1 WHERE block_index = ?').run(doc.block_index);
        }

        res.json({
            valid: verification.valid,
            document_id: doc.block_index,
            original_hash: doc.file_hash,
            computed_hash: verification.details.computedFileHash,
            tampered: !verification.valid,
            timestamp: doc.upload_timestamp,
            uploaded_by: doc.uploaded_by
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Verification failed' });
    }
});

module.exports = router;
