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
const apiKey = require('../middleware/apiKey');
const { uploadLimiter } = require('../middleware/limiters');

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
    upload.single('file')(req, res, async (err) => {
        if (err) return res.status(400).json({ success: false, error: err.message });

        console.log('Upload request fields:', {
            filename: req.file?.originalname,
            uploaded_by: req.body.user || req.body.uploaded_by || 'anonymous',
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

            // STRICT IDENTITY: Use only the name and email from the verified session
            const uploadedBy = req.user.name;
            const uploaderEmail = req.user.email;
            
            if (!uploadedBy || !uploaderEmail) {
                if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
                return res.status(403).json({ success: false, error: 'Verified identity required' });
            }

            // DEPARTMENT LOCKING: Check if user has a department set
            let userDept = null;
            const userInDb = db.prepare('SELECT department FROM users WHERE email = ?').get(uploaderEmail);
            
            if (userInDb && userInDb.department) {
                userDept = userInDb.department;
            } else {
                // First upload or no department set, use provided department and LOCK it
                userDept = req.body.department || 'General';
                db.prepare('UPDATE users SET department = ? WHERE email = ?').run(userDept, uploaderEmail);
                console.log(`[AUTH] Department locked to "${userDept}" for user ${uploaderEmail}`);
            }
            
            // Calculate hash for duplicate pre-check
            const fileHash = await hasher.generateFileHashAsync(tmpFilePath);

            // Versioning logic
            let parent_document_id = (req.body.parent_document_id && req.body.parent_document_id !== 'undefined') ? parseInt(req.body.parent_document_id) : null;
            let version_number = 1;
            const version_note = req.body.version_note || null;

            if (parent_document_id && !isNaN(parent_document_id)) {
                const parent = db.prepare('SELECT version_number, uploader_email, department FROM documents WHERE block_index = ?').get(parent_document_id);
                if (!parent) {
                    if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
                    return res.status(404).json({ success: false, error: 'Parent document not found' });
                }

                // HIJACKING PROTECTION: Check ownership or department match
                const isOwner = parent.uploader_email === uploaderEmail;
                const isSameDept = parent.department === userDept;

                if (!isOwner && !isSameDept) {
                    if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
                    return res.status(403).json({ 
                        success: false, 
                        error: 'Permission Denied', 
                        message: 'You are not authorized to version this document. Only the original author or members of the same department can perform this action.' 
                    });
                }

                version_number = (parent.version_number || 1) + 1;
            } else {
                // Duplicate check ONLY for initial uploads
                // NEW: Check by file_hash AND uploaderEmail
                const existing = db.prepare('SELECT * FROM documents WHERE file_hash = ? AND uploader_email = ?').get(fileHash, uploaderEmail);
                if (existing) {
                    if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
                    return res.status(409).json({
                        success: false,
                        error: "Duplicate document content",
                        message: "This exact document content has already been registered by you.",
                        existing_document_id: existing.block_index,
                        existing_filename: existing.filename,
                        uploaded_at: existing.upload_timestamp
                    });
                }
            }

            // ── Async Processing via Queue ──
            const job = await documentQueue.add({
                filePath: tmpFilePath,
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                uploadedBy: uploadedBy,
                uploaderEmail: uploaderEmail,
                department: userDept,
                version_number,
                parent_document_id,
                version_note,
                fileHash // Pass the already calculated hash to avoid re-calculating
            });

            res.json({
                success: true,
                message: 'Document upload received and queued for secure processing.',
                job_id: job.id,
                filename: req.file.originalname,
                status: 'processing',
                version_number
            });

        } catch (error) {
            console.error('[UPLOAD_ERROR]', error);
            if (tmpFilePath && fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
            res.status(500).json({ success: false, error: error.message || 'Internal server error' });
        }
    });
});

// ── Batch Upload (Queue-Based) ──
router.post('/batch-upload', uploadLimiter, apiKey, (req, res) => {
    upload.array('files', 20)(req, res, async (err) => {
        if (err) return res.status(400).json({ success: false, error: err.message });

        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ success: false, error: 'No files uploaded' });
            }

            const uploadedBy = req.user.name;
            const uploaderEmail = req.user.email;
            if (!uploadedBy || !uploaderEmail) {
                req.files.forEach(f => {
                    const p = path.resolve(f.path);
                    if (fs.existsSync(p)) fs.unlinkSync(p);
                });
                return res.status(403).json({ success: false, error: 'Verified identity required' });
            }

            // DEPARTMENT LOCKING: Check if user has a department set
            let userDept = null;
            const userInDb = db.prepare('SELECT department FROM users WHERE email = ?').get(uploaderEmail);
            
            if (userInDb && userInDb.department) {
                userDept = userInDb.department;
            } else {
                // First upload or no department set, use provided department (from first file or general) and LOCK it
                userDept = req.body.department || 'General';
                db.prepare('UPDATE users SET department = ? WHERE email = ?').run(userDept, uploaderEmail);
                console.log(`[AUTH] Batch-upload: Department locked to "${userDept}" for user ${uploaderEmail}`);
            }

            const batchId = Date.now();
            const jobIds = [];

            for (const file of req.files) {
                const filePath = path.resolve(file.path);
                const job = await documentQueue.add({
                    filePath,
                    originalname: file.originalname,
                    mimetype: file.mimetype,
                    uploadedBy,
                    uploaderEmail: uploaderEmail,
                    department: userDept,
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

// ── Job Status Endpoint ──
router.get('/status/:job_id', async (req, res) => {
    try {
        const job = await documentQueue.getJob(req.params.job_id);
        if (!job) return res.status(404).json({ error: 'Job not found' });

        const state = await job.getState();
        const progress = job._progress;
        const result = job.returnvalue;

        res.json({
            id: job.id,
            state,
            progress,
            result,
            error: job.failedReason
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get job status' });
    }
});

module.exports = router;
