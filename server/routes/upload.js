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
const gemini = require('../utils/gemini');
const signature = require('../utils/signature');
const crypto = require('crypto');
const { getBucket } = require('../db/mongodb');

const documentQueue = require('../utils/queue');
const { processDocument } = require('../utils/processor');
const apiKey = require('../middleware/apiKey');
const { uploadLimiter } = require('../middleware/limiters');
const { recordSignal } = require('../utils/abuse');

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

router.post('/', uploadLimiter, (req, res) => {
    // Record upload attempt for abuse scoring
    if (req.user) recordSignal(req.user.id, 'RAPID_UPLOAD');

    upload.single('file')(req, res, async (err) => {
        if (err) return res.status(400).json({ success: false, error: err.message });

        const tmpFilePath = req.file ? path.resolve(req.file.path) : null;

        try {
            if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

            const bucket = getBucket();
            if (!bucket) {
                return res.status(503).json({ success: false, error: 'Database connection not ready.' });
            }

            // Identity checks
            const uploadedBy = req.user?.name || 'Anonymous';
            const uploaderEmail = req.user?.email || 'anonymous@dover.io';
            
            let userDept = req.body.department || 'General';

            // Calculate hash
            const fileHash = await hasher.generateFileHashAsync(tmpFilePath);

            // Versioning logic
            let parent_document_id = (req.body.parent_document_id && req.body.parent_document_id !== 'undefined') ? parseInt(req.body.parent_document_id) : null;
            let version_number = 1;
            const version_note = req.body.version_note || null;

            if (parent_document_id) {
                const parent = db.prepare('SELECT version_number FROM documents WHERE block_index = ?').get(parent_document_id);
                if (parent) version_number = (parent.version_number || 1) + 1;
            }

            // GridFS Upload
            const uploadStream = bucket.openUploadStream(req.file.originalname, {
                contentType: req.file.mimetype,
                metadata: { uploadedBy, uploaderEmail, fileHash }
            });

            const gridfsId = uploadStream.id;
            fs.createReadStream(tmpFilePath).pipe(uploadStream);

            await new Promise((resolve, reject) => {
                uploadStream.on('finish', resolve);
                uploadStream.on('error', reject);
            });

            // Cleanup local temp file after GridFS upload
            if (tmpFilePath && fs.existsSync(tmpFilePath)) {
                fs.unlinkSync(tmpFilePath);
            }

            // Processing via Queue with Sync Fallback
            const jobData = {
                storageId: gridfsId.toString(),
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                uploadedBy,
                uploaderEmail,
                department: userDept,
                version_number,
                parent_document_id,
                version_note,
                fileHash
            };

            const isQueueReady = documentQueue.client && documentQueue.client.status === 'ready';

            if (isQueueReady) {
                const job = await documentQueue.add(jobData);
                return res.json({
                    success: true,
                    message: 'Document queued for processing.',
                    job_id: job.id,
                    status: 'processing'
                });
            } else {
                console.warn('[UPLOAD] Redis offline — instant processing fallback');
                const result = await processDocument(jobData);
                return res.json({
                    success: true,
                    message: 'Document processed instantly (Redis offline).',
                    ...result,
                    status: 'completed'
                });
            }

        } catch (error) {
            console.error('[UPLOAD_ERROR]', error);
            if (tmpFilePath && fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

router.post('/batch-upload', uploadLimiter, (req, res) => {
    upload.array('files', 20)(req, res, async (err) => {
        if (err) return res.status(400).json({ success: false, error: err.message });

        try {
            if (!req.files || req.files.length === 0) return res.status(400).json({ success: false, error: 'No files uploaded' });

            const uploadedBy = req.user?.name || 'Anonymous';
            const uploaderEmail = req.user?.email || 'anonymous@dover.io';
            const documentCategory = req.body.department || 'General';

            const batchId = Date.now();
            const jobIds = [];
            const results = [];
            const isQueueReady = documentQueue.client && documentQueue.client.status === 'ready';

            for (const file of req.files) {
                const jobData = {
                    filePath: path.resolve(file.path),
                    originalname: file.originalname,
                    mimetype: file.mimetype,
                    uploadedBy,
                    uploaderEmail,
                    department: documentCategory,
                    batch_id: batchId
                };

                if (isQueueReady) {
                    const job = await documentQueue.add(jobData);
                    jobIds.push(job.id);
                } else {
                    const result = await processDocument(jobData);
                    results.push(result);
                }
            }

            // Cleanup all batch files from temp storage
            for (const file of req.files) {
                const batchTmpPath = path.resolve(file.path);
                if (fs.existsSync(batchTmpPath)) {
                    fs.unlinkSync(batchTmpPath);
                }
            }

            res.json({
                success: true,
                batch_id: batchId,
                total_files: req.files.length,
                job_ids: jobIds,
                results: results,
                status: isQueueReady ? 'queued' : 'completed_instantly'
            });
        } catch (error) {
            console.error('[BATCH_ERROR]', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

router.get('/status/:job_id', async (req, res) => {
    try {
        const job = await documentQueue.getJob(req.params.job_id);
        if (!job) return res.status(404).json({ error: 'Job not found' });
        const state = await job.getState();
        res.json({ id: job.id, state, progress: job._progress, result: job.returnvalue });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get job status' });
    }
});

module.exports = router;
