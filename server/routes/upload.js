const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/db');
const hasher = require('../utils/hasher');

// Configure multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'uploads/';
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath);
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

router.post('/', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const filePath = req.file.path;
        const filename = req.file.filename;
        const fileType = req.file.mimetype;
        const uploadedBy = req.body.user || 'anonymous';
        
        // 1. Generate SHA-256 hash of the file
        const fileHash = hasher.generateFileHash(filePath);

        // 2. Get previous block's hash from DB
        const prevHash = hasher.getLastBlockHash(db);

        // 3. Generate block_hash
        const timestamp = new Date().toISOString();
        const blockHash = hasher.generateBlockHash(fileHash, prevHash, timestamp);

        // 4. Store in documents table
        const insertDoc = db.prepare(`
            INSERT INTO documents (filename, file_type, uploaded_by, upload_timestamp, file_hash, prev_hash, block_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        const result = insertDoc.run(filename, fileType, uploadedBy, timestamp, fileHash, prevHash, blockHash);
        const documentId = result.lastInsertRowid;

        // 5. Log action in audit_log
        const insertAudit = db.prepare(`
            INSERT INTO audit_log (document_id, action, actor, details)
            VALUES (?, ?, ?, ?)
        `);
        insertAudit.run(documentId, 'UPLOAD', uploadedBy, `File ${filename} uploaded and hashed`);

        // 6. Generate QR code string
        const qrData = JSON.stringify({ id: documentId, block_hash: blockHash });

        // 7. Return response
        res.json({
            success: true,
            document_id: documentId,
            block_hash: blockHash,
            block_index: documentId, // In our schema, block_index is the PK/ID
            qr_data: qrData
        });

    } catch (error) {
        console.error(error);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ success: false, error: 'Database or System failure' });
    }
});

module.exports = router;
