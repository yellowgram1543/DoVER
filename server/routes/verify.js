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
        let newPath = null;
        if (req.file) {
            const ext = req.file.mimetype === 'image/png' ? '.png' : '.jpg';
            newPath = req.file.path + ext;
            fs.renameSync(req.file.path, newPath);
        }

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
            if (newPath && fs.existsSync(newPath)) fs.unlinkSync(newPath);
            return res.status(404).json({ success: false, error: 'No original record found for this document identity.' });
        }

        // 2. Perform Content Comparison
        let currentFileHash;
        let verificationResult;

        if (isComparisonVerify) {
            currentFileHash = hasher.generateFileHash(newPath);
            verificationResult = {
                valid: (currentFileHash.trim() === doc.file_hash.trim()),
                details: { computedFileHash: currentFileHash }
            };
            tmpPath = newPath; // Keep uploaded file for analysis
        } else {
            const bucket = getBucket();
            const storageId = doc.storage_id || doc.filename;
            
            if (!mongoose.Types.ObjectId.isValid(storageId)) {
                return res.status(400).json({ success: false, error: 'Invalid or legacy document ID' });
            }

            const extMap = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'text/plain': '.txt' };
            const ext = extMap[doc.file_type] || '';
            tmpPath = path.resolve('tmp', `verify_${Date.now()}_${storageId}${ext}`);
            
            const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(storageId));
            const writeStream = fs.createWriteStream(tmpPath);
            downloadStream.pipe(writeStream);

            await new Promise((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });

            verificationResult = hasher.verifyDocument(doc.block_index, db, tmpPath);
        }

        // 1 & 2. Run extraction ONCE at the top and store in currentOcrText
        let currentOcrText = '';
        if (tmpPath && fs.existsSync(tmpPath)) {
            console.log('Temp file path:', tmpPath);
            console.log('File exists:', fs.existsSync(tmpPath));
            console.log('File size:', fs.statSync(tmpPath).size);

            if (/png|jpg|jpeg/.test(doc.file_type)) {
                currentOcrText = await ocr.extractText(tmpPath);
                console.log('Raw OCR output:', currentOcrText);
            } else if (doc.file_type === 'text/plain' || doc.filename.endsWith('.txt')) {
                currentOcrText = fs.readFileSync(tmpPath, 'utf8');
            }
        }

        let current_ocr_text = (!currentOcrText || currentOcrText.trim().length === 0) ? 'extraction_failed' : currentOcrText.trim();

        // 3. Deep Analysis
        let ocr_valid = null;
        let ocr_tampered = null;
        let ocr_change_detected = null;
        
        // Pass currentOcrText directly into deep analysis
        let ocr_text = currentOcrText;
        let stored_ocr_text = doc.ocr_text;
        let forensic_comparison = null;
        let signature_comparison = null;

        if (doc.file_type === 'text/plain' || doc.filename.endsWith('.txt')) {
            if (stored_ocr_text) {
                const currentOcrHash = crypto.createHash('sha256').update(ocr_text).digest('hex');
                ocr_valid = (currentOcrHash.trim() === doc.ocr_hash.trim());
                ocr_tampered = !ocr_valid;
                ocr_change_detected = !ocr_valid;
            }
        } 
        else if (/png|jpg|jpeg/.test(doc.file_type)) {
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

        // 4. Backward Chain Validation (Recursive Integrity)
        // We traverse the chain backwards to the nearest checkpoint to ensure local history is intact.
        let chain_valid = true;
        let chain_error = null;
        try {
            let currentPointer = doc;
            while (currentPointer) {
                blocks_verified++;

                // If this is the current block being verified from disk, we already have verificationResult
                if (currentPointer.block_index !== doc.block_index) {
                    const recomputed = hasher.generateBlockHash(currentPointer.file_hash, currentPointer.prev_hash, currentPointer.upload_timestamp);
                    if (recomputed.trim() !== currentPointer.block_hash.trim()) {
                        chain_valid = false;
                        chain_error = `Chain broken at Block #${currentPointer.block_index}`;
                        break;
                    }
                }

                // ── Digital Signature Verification (Origin Proof) ──
                // Verify that this block was signed by the server's private key
                if (process.env.PUBLIC_KEY && currentPointer.signature) {
                    try {
                        const sigValid = hasher.verifySignature(currentPointer.block_hash, currentPointer.signature, process.env.PUBLIC_KEY.replace(/\\n/g, '\n'));
                        if (!sigValid) {
                            chain_valid = false;
                            chain_error = `Invalid digital signature for Block #${currentPointer.block_index}`;
                            break;
                        }
                    } catch (sigErr) {
                        console.error(`[SIG_VERIFY_ERROR] Block #${currentPointer.block_index}:`, sigErr.message);
                    }
                }

                // Stop if we hit a checkpoint (except for the block we just verified)
                if (currentPointer.checkpoint_hash && currentPointer.block_index !== doc.block_index) {
                    const tamperedPast = db.prepare('SELECT block_index FROM documents WHERE is_tampered = 1 AND block_index <= ? LIMIT 1').get(currentPointer.block_index);
                    if (tamperedPast) {
                        chain_valid = false;
                        chain_error = `Historical tamper detected at Block #${tamperedPast.block_index} below checkpoint`;
                    }
                    break; 
                }

                // Move to previous block
                if (currentPointer.prev_hash && currentPointer.prev_hash !== '0000000000000000') {
                    const prevDoc = db.prepare('SELECT * FROM documents WHERE block_hash = ?').get(currentPointer.prev_hash);
                    if (!prevDoc) {
                        chain_valid = false;
                        chain_error = `Previous block missing for Block #${currentPointer.block_index}`;
                        break;
                    }
                    currentPointer = prevDoc;
                } else {
                    // We are at Genesis block (Block #1 usually)
                    // We should still check if anything below this is tampered (though there shouldn't be)
                    const tamperedPast = db.prepare('SELECT block_index FROM documents WHERE is_tampered = 1 AND block_index <= ? LIMIT 1').get(currentPointer.block_index);
                    if (tamperedPast) {
                        chain_valid = false;
                        chain_error = `Historical tamper detected at Block #${tamperedPast.block_index} (Genesis/Near-Genesis)`;
                    }
                    break; 
                }
            }
        } catch (err) {
            console.error('[CHAIN_VERIFY_ERROR]', err);
            chain_valid = false;
            chain_error = 'Internal chain traversal error';
        }

        // 5. Final Logging and Cleanup
        const forensicTamper = forensic_comparison && forensic_comparison.suspicious_change;
        const signatureTamper = signature_comparison && signature_comparison.status_change;
        const isTampered = !verificationResult.valid || (ocr_tampered === true) || forensicTamper || signatureTamper || !chain_valid;

        if (isTampered) {
            db.prepare('UPDATE documents SET is_tampered = 1 WHERE block_index = ?').run(doc.block_index);
            db.prepare(`INSERT INTO audit_log (document_id, action, actor, details) VALUES (?, ?, ?, ?)`)
              .run(doc.block_index, 'TAMPER_DETECTED', 'SYSTEM_VERIFIER', `Verification failed. ${chain_error || 'Content mismatch.'}`);
        } else {
            db.prepare(`INSERT INTO audit_log (document_id, action, actor, details) VALUES (?, ?, ?, ?)`)
              .run(doc.block_index, 'VERIFIED', 'SYSTEM_VERIFIER', `Document verified successfully. Chain depth: ${blocks_verified}`);
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
            current_ocr_text,
            forensic_comparison,
            signature_comparison,
            chain_integrity: {
                valid: chain_valid,
                error: chain_error,
                blocks_traversed: blocks_verified
            }
        });

    } catch (error) {
        console.error('[VERIFY_ERROR]', error);
        if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        if (newPath && tmpPath !== newPath && fs.existsSync(newPath)) fs.unlinkSync(newPath);
        res.status(500).json({ success: false, error: 'Verification failed: ' + error.message });
    }
});

module.exports = router;
