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

// Quick Verification via Hash
router.get('/:hash', async (req, res) => {
    try {
        const hash = req.params.hash;
        const doc = db.prepare('SELECT * FROM documents WHERE block_hash = ?').get(hash);

        if (!doc) {
            return res.status(404).json({ success: false, status: 'invalid', error: 'Hash not found in chain' });
        }

        if (doc.is_tampered) {
            return res.json({ success: true, status: 'tampered', block_index: doc.block_index });
        }

        // ── Safe Async Traversal ──
        const MAX_DEPTH = 150;
        const visited = new Set();
        let currentHash = doc.prev_hash;
        let checked = 0;

        for (let depth = 0; depth < MAX_DEPTH && currentHash && currentHash !== '0000000000000000'; depth++) {
            if (visited.has(currentHash)) {
                return res.json({ success: true, status: "invalid", reason: "CYCLE_DETECTED", checked_blocks: checked });
            }
            visited.add(currentHash);

            const current = db.prepare("SELECT * FROM documents WHERE block_hash = ?").get(currentHash);
            if (!current) {
                return res.json({ success: true, status: "invalid", reason: "BROKEN_CHAIN", checked_blocks: checked });
            }
            if (current.is_tampered) {
                return res.json({ success: true, status: "invalid", reason: "HISTORICAL_TAMPER", checked_blocks: checked, tampered_block: current.block_index });
            }

            checked++;
            currentHash = current.prev_hash;
            if (current.checkpoint_hash) break;
            await new Promise(resolve => setImmediate(resolve));
        }

        if (checked >= MAX_DEPTH) {
            return res.json({ 
                success: true, 
                status: "invalid", 
                reason: "MAX_DEPTH_EXCEEDED", 
                checked_blocks: checked 
            });
        }

        res.json({ 
            success: true, 
            status: 'valid', 
            block_index: doc.block_index,
            checked_blocks: checked,
            is_checkpoint: !!doc.checkpoint_hash
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

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

        // ── Digital Signature Verification (Origin Proof) ──
        if (!doc.signature) {
            if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
            return res.json({ status: "invalid", reason: "SIGNATURE_MISSING" });
        }

        const public_key = process.env.PUBLIC_KEY ? process.env.PUBLIC_KEY.replace(/\\n/g, '\n') : '';
        const is_sig_valid = crypto.createVerify("SHA256")
            .update(doc.file_hash)
            .verify(public_key, doc.signature, "hex");

        if (!is_sig_valid) {
            if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
            return res.json({ status: "invalid", reason: "SIGNATURE_INVALID" });
        }

        // 1 & 2. Run extraction ONCE at the top and store in currentOcrText
        let currentOcrText = '';
        if (tmpPath && fs.existsSync(tmpPath)) {
            if (/png|jpg|jpeg/.test(doc.file_type)) {
                currentOcrText = await ocr.extractText(tmpPath);
            } else if (doc.file_type === 'text/plain' || doc.filename.endsWith('.txt')) {
                currentOcrText = fs.readFileSync(tmpPath, 'utf8');
            }
        }

        let current_ocr_text = (!currentOcrText || currentOcrText.trim().length === 0) ? 'extraction_failed' : currentOcrText.trim();

        // 3. Deep Analysis
        let ocr_valid = null;
        let ocr_tampered = null;
        let ocr_change_detected = null;
        
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

        // 4. Backward Chain Validation (Safe Async Step Loop)
        const MAX_DEPTH = 150;
        const visited = new Set();
        let currentHash = doc.prev_hash;
        let checked = 0;

        try {
            for (let depth = 0; depth < MAX_DEPTH && currentHash && currentHash !== '0000000000000000'; depth++) {

                // 1. Cycle check BEFORE query
                if (visited.has(currentHash)) {
                    if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
                    return res.json({ status: "invalid", reason: "CYCLE_DETECTED", checked_blocks: checked });
                }
                visited.add(currentHash);

                // 2. Safe DB fetch
                const current = db.prepare("SELECT * FROM documents WHERE block_hash = ?").get(currentHash);

                if (!current) {
                    if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
                    return res.json({ status: "invalid", reason: "BROKEN_CHAIN", checked_blocks: checked });
                }

                if (current.is_tampered) {
                    if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
                    return res.json({ status: "invalid", reason: "HISTORICAL_TAMPER", checked_blocks: checked, tampered_block: current.block_index });
                }

                checked++;

                // 3. Move pointer
                currentHash = current.prev_hash;

                // Stop if we hit a checkpoint
                if (current.checkpoint_hash) {
                    break;
                }

                // 4. Yield control (CRITICAL)
                await new Promise(resolve => setImmediate(resolve));
            }

            if (checked >= MAX_DEPTH) {
                if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
                return res.json({ status: "invalid", reason: "MAX_DEPTH_EXCEEDED", checked_blocks: checked });
            }

        } catch (chainError) {
            console.error('[CHAIN_TRAVERSAL_ERROR]', chainError);
            if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
            return res.status(500).json({ success: false, error: 'Chain traversal failed' });
        }

        // 5. Final Result
        const isTampered = !verificationResult.valid || (ocr_tampered === true) || 
                          (forensic_comparison && forensic_comparison.suspicious_change) || 
                          (signature_comparison && signature_comparison.status_change);

        if (isTampered) {
            db.prepare('UPDATE documents SET is_tampered = 1 WHERE block_index = ?').run(doc.block_index);
        }

        if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);

        return res.json({ 
            status: isTampered ? "tampered" : "valid", 
            valid: !isTampered,
            verdict: isTampered ? "TAMPERED" : "ORIGINAL",
            document_id: doc.block_index,
            checked_blocks: checked,
            ocr_valid,
            forensic_comparison,
            signature_comparison
        });

    } catch (error) {
        console.error('[VERIFY_ERROR]', error);
        if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;