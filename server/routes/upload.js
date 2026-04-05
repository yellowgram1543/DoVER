const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/db');
const hasher = require('../utils/hasher');
const QRCode = require('qrcode');
const ocr = require('../utils/ocr');
const forensics = require('../utils/forensics');
const crypto = require('crypto');
const { getBucket } = require('../db/mongodb');

// Configure multer for temp storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const tmpPath = 'tmp/';
        if (!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath);
        cb(null, tmpPath);
    },
    filename: (req, file, cb) => {
        cb(null, 'upload_' + Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedExt = /pdf|docx|png|jpg|jpeg|txt/;
        const allowedMime = /pdf|wordprocessingml|png|jpg|jpeg|text/; 
        const ext = allowedExt.test(path.extname(file.originalname).toLowerCase());
        const mime = allowedMime.test(file.mimetype);
        cb(ext && mime ? null : new Error('Invalid file type'), ext && mime);
    }
});

router.post('/', (req, res) => {
    upload.single('file')(req, res, async (err) => {
        if (err) return res.status(400).json({ success: false, error: err.message });
        
        const tmpFilePath = req.file ? path.resolve(req.file.path) : null;

        try {
            if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
            
            const bucket = getBucket();
            if (!bucket) {
                return res.status(503).json({ success: false, error: 'Database connection not ready.' });
            }

            if (req.file.size === 0) {
                if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
                return res.status(400).json({ success: false, error: 'Empty file not allowed' });
            }

            // 1. Stream to GridFS using modern Bucket API
            const uploadStream = bucket.openUploadStream(req.file.originalname, {
                contentType: req.file.mimetype
            });
            const gridfsId = uploadStream.id.toString();

            await new Promise((resolve, reject) => {
                fs.createReadStream(tmpFilePath)
                    .pipe(uploadStream)
                    .on('error', reject)
                    .on('finish', resolve);
            });

            // 2. Generate Hashes and Analysis using Temp File
            const fileHash = hasher.generateFileHash(tmpFilePath);
            const prevHash = hasher.getLastBlockHash(db);
            const timestamp = new Date().toISOString();
            const blockHash = hasher.generateBlockHash(fileHash, prevHash, timestamp);

            let ocrText = null;
            let ocrHash = null;
            let forensicScore = null;
            if (/png|jpg|jpeg/.test(req.file.mimetype)) {
                ocrText = await ocr.extractText(tmpFilePath);
                if (ocrText) ocrHash = crypto.createHash('sha256').update(ocrText).digest('hex');
                const forensicReport = await forensics.analyzeImage(tmpFilePath);
                forensicScore = JSON.stringify(forensicReport);
            }

            // 3. Store fileId in SQL
            const insertDoc = db.prepare(`
                INSERT INTO documents (filename, file_type, uploaded_by, upload_timestamp, file_hash, prev_hash, block_hash, ocr_text, ocr_hash, forensic_score)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const result = insertDoc.run(gridfsId, req.file.mimetype, req.body.user || 'anonymous', timestamp, fileHash, prevHash, blockHash, ocrText, ocrHash, forensicScore);
            const documentId = result.lastInsertRowid;

            // 4. Cleanup Temp File
            if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);

            // 5. Response
            const qrData = JSON.stringify({ document_id: documentId, block_hash: blockHash, filename: req.file.originalname, timestamp });
            const qrImageBase64 = await QRCode.toDataURL(qrData);

            res.json({
                success: true,
                document_id: documentId,
                block_index: documentId,
                block_hash: blockHash,
                gridfs_id: gridfsId,
                forensic_score: forensicScore ? JSON.parse(forensicScore) : null,
                qr_image_base64: qrImageBase64
            });

        } catch (error) {
            console.error('[UPLOAD_ERROR]', error);
            if (tmpFilePath && fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
            res.status(500).json({ success: false, error: error.message || 'Internal server error' });
        }
    });
});

module.exports = router;
