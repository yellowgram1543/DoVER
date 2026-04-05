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
const { getGfs, mongoose } = require('../db/mongodb');

// Configure multer for memory storage (we will stream to GridFS)
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
        const allowedMime = /pdf|docx|png|jpg|jpeg|text/;
        const ext = allowedExt.test(path.extname(file.originalname).toLowerCase());
        const mime = allowedMime.test(file.mimetype);
        cb(ext && mime ? null : new Error('Invalid file type'), ext && mime);
    }
});

router.post('/', (req, res) => {
    upload.single('file')(req, res, async (err) => {
        if (err) return res.status(400).json({ success: false, error: err.message });
        
        try {
            if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
            if (req.file.size === 0) {
                if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                return res.status(400).json({ success: false, error: 'Empty file not allowed' });
            }

            const tmpFilePath = path.resolve(req.file.path);
            const gfs = getGfs();

            // 1. Stream to GridFS
            const writeStream = gfs.createWriteStream({
                filename: req.file.originalname,
                mode: 'w',
                content_type: req.file.mimetype
            });
            fs.createReadStream(tmpFilePath).pipe(writeStream);

            await new Promise((resolve, reject) => {
                writeStream.on('close', resolve);
                writeStream.on('error', reject);
            });

            const gridfsId = writeStream.id.toString();

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

            // 3. Store fileId in SQL (filename column now stores fileId)
            const insertDoc = db.prepare(`
                INSERT INTO documents (filename, file_type, uploaded_by, upload_timestamp, file_hash, prev_hash, block_hash, ocr_text, ocr_hash, forensic_score)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const result = insertDoc.run(gridfsId, req.file.mimetype, req.body.user || 'anonymous', timestamp, fileHash, prevHash, blockHash, ocrText, ocrHash, forensicScore);
            const documentId = result.lastInsertRowid;

            // 4. Cleanup Temp File
            if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);

            // 5. QR and Response
            const qrData = JSON.stringify({ document_id: documentId, block_hash: blockHash, filename: req.file.originalname, timestamp });
            const qrImageBase64 = await QRCode.toDataURL(qrData);

            res.json({
                success: true,
                document_id: documentId,
                block_index: documentId,
                gridfs_id: gridfsId,
                forensic_score: forensicScore ? JSON.parse(forensicScore) : null,
                qr_image_base64: qrImageBase64
            });

        } catch (error) {
            console.error(error);
            if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            res.status(500).json({ success: false, error: 'Storage or Analysis failure' });
        }
    });
});

module.exports = router;
