const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/db');
const hasher = require('../utils/hasher');
const qr = require('../utils/qr');
const ocr = require('../utils/ocr');
const forensics = require('../utils/forensics');
const signature = require('../utils/signature');
const crypto = require('crypto');
const { Jimp } = require('jimp');
const { rgbaToInt } = require('@jimp/utils');
const { getBucket } = require('../db/mongodb');
const documentQueue = require('../utils/queue');

// Configure multer for temp storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const tmpPath = 'tmp/';
        if (!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath);
        cb(null, tmpPath);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.random().toString(36).slice(2) + '-' + file.originalname;
        cb(null, uniqueName);
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
        
        console.log('Upload request fields:', {
            filename: req.file?.originalname,
            uploaded_by: req.body.uploaded_by,
            department: req.body.department
        });

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

            const uploadedBy = req.body.uploaded_by || req.body.user || 'anonymous';
            const existing = db.prepare('SELECT * FROM documents WHERE filename = ? AND uploaded_by = ?').get(req.file.originalname, uploadedBy);
            
            if (existing) {
                if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
                return res.status(409).json({
                    success: false,
                    error: "Duplicate document",
                    message: "A document with this filename already exists under this legal name",
                    existing_document_id: existing.id || existing.block_index,
                    uploaded_at: existing.upload_timestamp
                });
            }

            // ── Async Processing via Queue ──
            // We add the job to the documentQueue which has concurrency=1
            // This ensures hashes are generated and inserted sequentially, preventing race conditions.
            const job = await documentQueue.add({
                filePath: tmpFilePath, // Unique temp path
                originalname: req.file.originalname, // Original name for DB
                mimetype: req.file.mimetype,
                uploadedBy: uploadedBy,
                department: req.body.department
            });

            res.json({
                success: true,
                message: 'Document upload received and queued for secure processing.',
                job_id: job.id,
                filename: req.file.originalname,
                status: 'processing'
            });

        } catch (error) {
            console.error('[UPLOAD_ERROR]', error);
            if (tmpFilePath && fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
            res.status(500).json({ success: false, error: error.message || 'Internal server error' });
        }
    });
});

// ── Batch Upload (Queue-Based) ──
router.post('/batch-upload', (req, res) => {
    upload.array('files', 20)(req, res, async (err) => {
        if (err) return res.status(400).json({ success: false, error: err.message });

        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ success: false, error: 'No files uploaded' });
            }

            const uploadedBy = req.body.user || 'anonymous';
            const batchId = Date.now();
            const jobIds = [];

            for (const file of req.files) {
                const filePath = path.resolve(file.path);
                const job = await documentQueue.add({
                    filePath,
                    originalname: file.originalname,
                    mimetype: file.mimetype,
                    uploadedBy,
                    batch_id: batchId
                });
                jobIds.push(job.id);
            }

            res.json({
                batch_id: batchId,
                total_files: req.files.length,
                job_ids: jobIds,
                status: 'queued'
            });
        } catch (error) {
            console.error('[BATCH_UPLOAD_ERROR]', error);
            // Cleanup any temp files on failure
            if (req.files) {
                req.files.forEach(f => {
                    const p = path.resolve(f.path);
                    if (fs.existsSync(p)) fs.unlinkSync(p);
                });
            }
            res.status(500).json({ success: false, error: error.message || 'Batch upload failed' });
        }
    });
});

module.exports = router;
