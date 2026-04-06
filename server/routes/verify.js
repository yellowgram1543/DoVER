const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../db/db');
const hasher = require('../utils/hasher');
const ocr = require('../utils/ocr');
const forensics = require('../utils/forensics');
const signature = require('../utils/signature');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getBucket, mongoose } = require('../db/mongodb');

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
if (!fs.existsSync('tmp')) fs.mkdirSync('tmp');

const upload = multer({ dest: 'tmp/' });

router.post('/', upload.single('file'), async (req, res) => {
    let tmpPath = '';
    try {
        if (!req.body.document_id && !req.file) {
            return res.status(400).json({ success: false, error: 'Provide a document ID or file' });
        }

        let doc;
        let isComparisonVerify = false;
        const compareWith = req.body.compare_with;

        // 1. Identify the document to verify against
        if (req.body.document_id) {
            doc = db.prepare('SELECT * FROM documents WHERE block_index = ?').get(req.body.document_id);
        } else if (req.file) {
            const originalName = req.file.originalname;
            if (compareWith) {
                doc = db.prepare('SELECT * FROM documents WHERE filename = ? AND uploaded_by = ? ORDER BY block_index ASC LIMIT 1').get(originalName, compareWith);
            } else {
                doc = db.prepare('SELECT * FROM documents WHERE filename = ? ORDER BY block_index ASC LIMIT 1').get(originalName);
            }
            isComparisonVerify = true;
        }

        if (!doc) {
            if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(404).json({ success: false, error: 'No original record found for this document identity.' });
        }

        // 2. Perform Content Comparison
        let currentFileHash;
        let verificationResult;

        if (isComparisonVerify) {
            currentFileHash = hasher.generateFileHash(req.file.path);
            verificationResult = {
                valid: (currentFileHash.trim() === doc.file_hash.trim()),
                details: { computedFileHash: currentFileHash }
            };
            tmpPath = req.file.path; // Keep uploaded file for analysis
        } else {
            const bucket = getBucket();
            const storageId = doc.storage_id || doc.filename;
            
            if (!mongoose.Types.ObjectId.isValid(storageId)) {
                return res.status(400).json({ success: false, error: 'Invalid or legacy document ID' });
            }

            tmpPath = path.resolve('tmp', `verify_${Date.now()}_${storageId}`);
            
            const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(storageId));
            const writeStream = fs.createWriteStream(tmpPath);
            downloadStream.pipe(writeStream);

            await new Promise((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });

            verificationResult = hasher.verifyDocument(doc.block_index, db, tmpPath);
        }

        // 3. Deep Analysis
        let ocr_valid = null;
        let ocr_tampered = null;
        let ocr_change_detected = null;
        let ocr_text = null;
        let stored_ocr_text = doc.ocr_text;
        let forensic_comparison = null;
        let signature_comparison = null;

        if (doc.file_type === 'text/plain' || doc.filename.endsWith('.txt')) {
            ocr_text = fs.readFileSync(tmpPath, 'utf8');
            if (stored_ocr_text) {
                const currentOcrHash = crypto.createHash('sha256').update(ocr_text).digest('hex');
                ocr_valid = (currentOcrHash.trim() === doc.ocr_hash.trim());
                ocr_tampered = !ocr_valid;
                ocr_change_detected = !ocr_valid;
            }
        } 
        else if (/png|jpg|jpeg/.test(doc.file_type)) {
            // Fix 5: Ensure OCR extraction happens before temp file deletion
            ocr_text = await ocr.extractText(tmpPath);
            
            if (doc.ocr_hash) {
                const currentOcrHash = crypto.createHash('sha256').update(ocr_text).digest('hex');
                ocr_valid = (currentOcrHash.trim() === doc.ocr_hash.trim());
                ocr_tampered = !ocr_valid;
                ocr_change_detected = !ocr_valid;
            }

            const currentForensic = await forensics.analyzeImage(tmpPath);
            const storedForensic = doc.forensic_score ? JSON.parse(doc.forensic_score) : null;
            if (storedForensic) {
                forensic_comparison = {
                    suspicious_change: (currentForensic.suspicious !== storedForensic.suspicious),
                    font_diff: Math.abs(currentForensic.font_consistency - storedForensic.font_consistency),
                    align_diff: Math.abs(currentForensic.alignment_score - storedForensic.alignment_score),
                    new_flags: currentForensic.flags.filter(f => !storedForensic.flags.includes(f))
                };
            }

            const currentSig = await signature.detectSignature(tmpPath);
            const storedSig = doc.signature_score ? JSON.parse(doc.signature_score) : null;
            if (storedSig) {
                signature_comparison = {
                    status_change: (currentSig.signature_found !== storedSig.signature_found || currentSig.seal_found !== storedSig.seal_found),
                    original_had_signature: storedSig.signature_found,
                    current_has_signature: currentSig.signature_found,
                    original_had_seal: storedSig.seal_found,
                    current_has_seal: currentSig.seal_found
                };
            }
        }

        // 4. Final Logging and Cleanup
        const forensicTamper = forensic_comparison && forensic_comparison.suspicious_change;
        const signatureTamper = signature_comparison && signature_comparison.status_change;
        const isTampered = !verificationResult.valid || (ocr_tampered === true) || forensicTamper || signatureTamper;

        if (isTampered) {
            db.prepare('UPDATE documents SET is_tampered = 1 WHERE block_index = ?').run(doc.block_index);
            db.prepare(`INSERT INTO audit_log (document_id, action, actor, details) VALUES (?, ?, ?, ?)`)
              .run(doc.block_index, 'TAMPER_DETECTED', 'SYSTEM_VERIFIER', `Comparison verify failed for ${doc.filename}.`);
        } else {
            db.prepare(`INSERT INTO audit_log (document_id, action, actor, details) VALUES (?, ?, ?, ?)`)
              .run(doc.block_index, 'VERIFIED', 'SYSTEM_VERIFIER', `Document verified successfully.`);
        }

        // FINAL Cleanup
        if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);

        res.json({
            valid: !isTampered,
            verdict: isTampered ? "TAMPERED" : "ORIGINAL",
            document_id: doc.block_index,
            filename: doc.filename,
            original_hash: doc.file_hash,
            computed_hash: verificationResult.details.computedFileHash,
            tampered: isTampered,
            timestamp: doc.upload_timestamp,
            uploaded_by: doc.uploaded_by,
            original_uploader: doc.uploaded_by,
            original_upload_date: doc.upload_timestamp,
            ocr_valid,
            ocr_tampered,
            ocr_change_detected,
            ocr_text,
            stored_ocr_text,
            forensic_comparison,
            signature_comparison
        });

    } catch (error) {
        console.error('[VERIFY_ERROR]', error);
        if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        res.status(500).json({ success: false, error: 'Verification failed: ' + error.message });
    }
});

module.exports = router;
