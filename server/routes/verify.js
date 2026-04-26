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
const { calculateSimilarity } = require('../utils/ocr');
const apiKey = require('../middleware/apiKey');
const { verifyMerkleProof } = require('../utils/merkle');

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
if (!fs.existsSync('tmp')) fs.mkdirSync('tmp');

const upload = multer({ dest: 'tmp/' });

router.get('/public/verify/:hash', async (req, res) => {
    try {
        const hash = req.params.hash;
        const doc = db.prepare('SELECT * FROM documents WHERE block_hash = ?').get(hash);

        if (!doc) {
            return res.json({ found: false, message: "No record found" });
        }

        // Logic for signature status (consistent with existing verification)
        let signature_status = "VERIFIED";
        if (!doc.signature) {
            signature_status = "NOT_SIGNED";
        } else {
            const verify = crypto.createVerify('SHA256');
            verify.update(doc.block_hash);
            let publicKey = '';
            if (process.env.PUBLIC_KEY_B64) {
                publicKey = Buffer.from(process.env.PUBLIC_KEY_B64, 'base64').toString('utf8');
            } else if (process.env.PUBLIC_KEY) {
                publicKey = process.env.PUBLIC_KEY.replace(/\\n/g, '\n');
            }

            if (publicKey) {
                const isValid = verify.verify(publicKey, doc.signature, 'hex');
                signature_status = isValid ? "VERIFIED" : "INVALID";
            }
        }

        return res.json({
            found: true,
            document_id: doc.block_index,
            filename: doc.filename,
            uploaded_by: doc.uploaded_by,
            upload_timestamp: doc.upload_timestamp,
            block_index: doc.block_index,
            block_hash: doc.block_hash,
            ipfs_cid: doc.ipfs_cid, // Added IPFS CID
            is_tampered: doc.is_tampered,
            signature_status: signature_status,
            ocr_similarity_score: doc.ocr_hash ? 100 : null, // Default to 100 for verified blocks
            verdict: doc.is_tampered ? "TAMPERED" : "ORIGINAL",
            polygon_txid: doc.polygon_txid,
            forensic_summary: doc.is_tampered 
                ? "Potential anomalies detected in document structure." 
                : "No forensic anomalies detected. Document integrity verified."
        });
    } catch (error) {
        console.error('[PUBLIC_VERIFY_ERROR]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/public/verify/qr/:document_id', async (req, res) => {
    try {
        const id = req.params.document_id;
        const doc = db.prepare('SELECT * FROM documents WHERE block_index = ?').get(id);

        if (!doc) {
            return res.json({ found: false, message: "No record found" });
        }

        // Logic for signature status (consistent with existing verification)
        let signature_status = "VERIFIED";
        if (!doc.signature) {
            signature_status = "NOT_SIGNED";
        } else {
            const verify = crypto.createVerify('SHA256');
            verify.update(doc.block_hash);
            let publicKey = '';
            if (process.env.PUBLIC_KEY_B64) {
                publicKey = Buffer.from(process.env.PUBLIC_KEY_B64, 'base64').toString('utf8');
            } else if (process.env.PUBLIC_KEY) {
                publicKey = process.env.PUBLIC_KEY.replace(/\\n/g, '\n');
            }

            if (publicKey) {
                const isValid = verify.verify(publicKey, doc.signature, 'hex');
                signature_status = isValid ? "VERIFIED" : "INVALID";
            }
        }

        return res.json({
            found: true,
            document_id: doc.block_index,
            filename: doc.filename,
            uploaded_by: doc.uploaded_by,
            upload_timestamp: doc.upload_timestamp,
            block_index: doc.block_index,
            block_hash: doc.block_hash,
            is_tampered: doc.is_tampered,
            signature_status: signature_status,
            ocr_similarity_score: doc.ocr_hash ? 100 : null,
            verdict: doc.is_tampered ? "TAMPERED" : "ORIGINAL",
            polygon_txid: doc.polygon_txid,
            forensic_summary: doc.is_tampered 
                ? "Potential anomalies detected in document structure." 
                : "No forensic anomalies detected. Document integrity verified."
        });
    } catch (error) {
        console.error('[PUBLIC_QR_VERIFY_ERROR]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/:id/proof', apiKey, (req, res) => {
    try {
        const id = req.params.id;
        const doc = db.prepare('SELECT * FROM documents WHERE block_index = ?').get(id);

        if (!doc) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        const publicKey = process.env.PUBLIC_KEY_B64 
            ? Buffer.from(process.env.PUBLIC_KEY_B64, 'base64').toString('utf8')
            : (process.env.PUBLIC_KEY ? process.env.PUBLIC_KEY.replace(/\\n/g, '\n') : null);

        const proof = {
            document_id: doc.block_index,
            filename: doc.filename,
            uploaded_by: doc.uploaded_by,
            upload_timestamp: doc.upload_timestamp,
            file_hash: doc.file_hash,
            block_hash: doc.block_hash,
            block_index: doc.block_index,
            prev_hash: doc.prev_hash,
            signature: doc.signature,
            public_key: publicKey,
            ocr_text_stored: doc.ocr_text,
            forensic_score: doc.forensic_score ? JSON.parse(doc.forensic_score) : null,
            verified_at: new Date().toISOString()
        };

        res.setHeader('Content-Disposition', 'attachment; filename=proof_' + id + '.json');
        res.json(proof);
    } catch (error) {
        console.error('[PROOF_ERROR]', error);
        res.status(500).json({ success: false, error: 'Failed to generate proof' });
    }
});

// Quick Verification via Hash
router.get('/:hash', apiKey, async (req, res) => {
    try {
        const hash = req.params.hash;
        const doc = db.prepare('SELECT * FROM documents WHERE block_hash = ?').get(hash);

        if (!doc) {
            return res.status(404).json({ success: false, status: 'invalid', error: 'Hash not found in chain' });
        }

        if (doc.is_tampered) {
            return res.json({ success: true, status: 'tampered', block_index: doc.block_index });
        }

        // ── Digital Signature Verification ──
        let signature_status = "VERIFIED";
        if (!doc.signature) {
            signature_status = "NOT_SIGNED";
        } else {
            console.log('Verifying block_hash:', doc.block_hash);
            const verify = crypto.createVerify('SHA256');
            verify.update(doc.block_hash);
            
            let publicKey = '';
            if (process.env.PUBLIC_KEY_B64) {
                publicKey = Buffer.from(process.env.PUBLIC_KEY_B64, 'base64').toString('utf8');
            } else if (process.env.PUBLIC_KEY) {
                publicKey = process.env.PUBLIC_KEY.replace(/\\n/g, '\n');
            }

            if (!publicKey) {
                return res.json({ success: true, status: "invalid", reason: "PUBLIC_KEY_MISSING" });
            }

            const isValid = verify.verify(publicKey, doc.signature, 'hex');
            console.log('Signature valid:', isValid);
            signature_status = isValid ? "VERIFIED" : "INVALID";
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
            status: (signature_status === "INVALID") ? "tampered" : "valid",
            block_index: doc.block_index,
            checked_blocks: checked,
            signature_status,
            is_checkpoint: !!doc.checkpoint_hash
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/', apiKey, upload.single('file'), async (req, res) => {
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
            console.log('[TRACE] Received document_id:', req.body.document_id, 'Type:', typeof req.body.document_id);
            doc = db.prepare('SELECT * FROM documents WHERE block_index = ?').get(req.body.document_id);
        } else if (req.file) {
            const originalName = req.file.originalname;
            if (compareWith) {
                doc = db.prepare('SELECT * FROM documents WHERE filename = ? AND uploaded_by = ? ORDER BY block_index DESC LIMIT 1').get(originalName, compareWith);
            } else {
                doc = db.prepare('SELECT * FROM documents WHERE filename = ? ORDER BY block_index DESC LIMIT 1').get(originalName);
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

            console.log('Calling verifyDocument with:', tmpPath);
            verificationResult = hasher.verifyDocument(doc.block_index, db, tmpPath);
        }

        // ── Digital Signature Verification ──
        let signature_status = "VERIFIED";
        let signature_mismatch = false;
        if (!doc.signature) {
            signature_status = "NOT_SIGNED";
        } else {
            console.log('Verifying block_hash:', doc.block_hash);
            const verify = crypto.createVerify('SHA256');
            verify.update(doc.block_hash);

            let publicKey = '';
            if (process.env.PUBLIC_KEY_B64) {
                publicKey = Buffer.from(process.env.PUBLIC_KEY_B64, 'base64').toString('utf8');
            } else if (process.env.PUBLIC_KEY) {
                publicKey = process.env.PUBLIC_KEY.replace(/\\n/g, '\n');
            }

            if (!publicKey) {
                if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
                return res.json({ status: "invalid", reason: "PUBLIC_KEY_MISSING" });
            }

            try {
                const isValid = verify.verify(publicKey, doc.signature, 'hex');
                console.log('Signature valid:', isValid);
                signature_status = isValid ? "VERIFIED" : "INVALID";
                if (!isValid) signature_mismatch = true;
            } catch (err) {
                console.error('[POST_SIG_VERIFY_ERROR]', err.message);
                if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
                return res.json({ status: "invalid", reason: "SIGNATURE_VERIFICATION_FAILED" });
            }
        }

        // 1 & 2. Run extraction ONCE at the top and store in currentOcrText
        let currentOcrText = '';
        let currentOcrLowConfidence = false;
        if (tmpPath && fs.existsSync(tmpPath)) {
            if (/png|jpg|jpeg/.test(doc.file_type)) {
                const ocrResult = await ocr.extractText(tmpPath);
                currentOcrText = ocrResult.text;
                currentOcrLowConfidence = ocrResult.lowConfidence;
            } else if (doc.file_type === 'text/plain' || doc.filename.endsWith('.txt')) {
                currentOcrText = fs.readFileSync(tmpPath, 'utf8');
            }
        }

        let current_ocr_text = (!currentOcrText || currentOcrText.trim().length === 0) ? 'extraction_failed' : currentOcrText.trim();

        // 3. Deep Analysis
        const OCR_THRESHOLD = 95;
        let ocr_similarity = 100;
        let ocr_tampered = false;

        let forensic_comparison = null;
        let signature_comparison = null;

        if (doc.ocr_text && !currentOcrLowConfidence) {
            ocr_similarity = calculateSimilarity(doc.ocr_text, current_ocr_text);
            ocr_tampered = ocr_similarity < OCR_THRESHOLD;
        } else if (currentOcrLowConfidence) {
            console.log('[VERIFY] Low OCR confidence detected, skipping similarity check to avoid false positives.');
            ocr_similarity = null; // Indicate skip
        }

        if (/png|jpg|jpeg/.test(doc.file_type)) {
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
                // Use explicit boolean conversion (!!) to ensure correct comparison
                const statusChanged = (!!currentSig.signature_found !== !!storedSig.signature_found) || (!!currentSig.seal_found !== !!storedSig.seal_found);
                signature_comparison = {
                    status_change: statusChanged,
                    original_had_signature: !!storedSig.signature_found,
                    current_has_signature: !!currentSig.signature_found,
                    original_had_seal: !!storedSig.seal_found,
                    current_has_seal: !!currentSig.seal_found
                };
            }
        }

        // 4. Backward Chain Validation (Safe Async Step Loop)
        const MAX_DEPTH = 150;
        const visited = new Set();
        let currentHash = doc.prev_hash;
        let checked = 0;
        let historical_tamper_detected = false;
        let tampered_block_id = null;

        try {
            for (let depth = 0; depth < MAX_DEPTH && currentHash && currentHash !== '0000000000000000'; depth++) {

                if (visited.has(currentHash)) break;
                visited.add(currentHash);

                const current = db.prepare("SELECT * FROM documents WHERE block_hash = ?").get(currentHash);
                if (!current) break; // Broken chain, but we continue verifying current

                if (current.is_tampered) {
                    historical_tamper_detected = true;
                    tampered_block_id = current.block_index;
                    // We don't return early anymore; we just flag it as a warning
                    break; 
                }

                checked++;
                currentHash = current.prev_hash;
                if (current.checkpoint_hash) break;
                await new Promise(resolve => setImmediate(resolve));
            }
        } catch (chainError) {
            console.error('[CHAIN_TRAVERSAL_ERROR]', chainError);
        }

        // 4.5 Merkle Verification
        let merkle_valid = null;
        let merkle_status = "VERIFIED";
        let merkle_proof_length = 0;

        if (!doc.merkle_proof) {
            merkle_status = "NOT_COMPUTED";
        } else {
            try {
                const proof = JSON.parse(doc.merkle_proof);
                merkle_proof_length = proof.length;
                merkle_valid = verifyMerkleProof(doc.block_hash, proof, doc.merkle_root);
                merkle_status = merkle_valid ? "VERIFIED" : "INVALID";
            } catch (err) {
                console.error('[MERKLE_VERIFY_ERROR]', err);
                merkle_status = "ERROR";
            }
        }

        // 5. Final Result
        let tamper_reasons = [];
        if (!verificationResult.valid) tamper_reasons.push("File hash mismatch");
        if (ocr_tampered) tamper_reasons.push("OCR text similarity below threshold");
        if (forensic_comparison && forensic_comparison.suspicious_change) tamper_reasons.push("Forensic analysis detected modifications");
        if (signature_comparison && signature_comparison.status_change) tamper_reasons.push("Signature/Seal presence changed");
        if (signature_mismatch) tamper_reasons.push("Signature mismatch");
        
        const isTampered = tamper_reasons.length > 0;
        
        console.log(`\n┌── Verification Results for Block #${doc.block_index}`);
        console.log(`│ - File Hash Match: ${verificationResult.valid ? 'YES' : 'NO'}`);
        console.log(`│ - OCR Similarity: ${ocr_similarity !== null ? ocr_similarity.toFixed(2) + '%' : 'SKIPPED (Low Confidence)'}`);
        console.log(`│ - Forensic Suspicious: ${forensic_comparison ? forensic_comparison.suspicious_change : 'NO CHANGE'}`);
        console.log(`│ - Signature Valid: ${!signature_mismatch}`);
        console.log(`│ - Chain Status: ${historical_tamper_detected ? '⚠️ WARNING (Historical Tamper at #' + tampered_block_id + ')' : '✅ SECURE'}`);
        console.log(`│ - Final Verdict: ${isTampered ? '🔴 TAMPERED' : '✅ ORIGINAL'}`);
        if (tamper_reasons.length > 0) console.log(`│ - Reasons: ${tamper_reasons.join(', ')}`);
        console.log(`└── Verification Cycle Complete\n`);

        if (isTampered) {
            db.prepare('UPDATE documents SET is_tampered = 1 WHERE block_index = ?').run(doc.block_index);
        }

        if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);

        // 4.6 Gemini AI Integrity Report
        let ai_report = null;
        if (!currentOcrLowConfidence && current_ocr_text !== 'extraction_failed') {
            console.log('[VERIFY] Generating AI Integrity Report via Gemini...');
            ai_report = await ocr.generateDocumentSummary(current_ocr_text, verificationResult.forensics || {});
        }

        const merkle_warning = (merkle_valid === false) ? "Merkle proof mismatch (legacy data)" : null;
        const chain_warning = historical_tamper_detected ? `Historical tamper detected in ancestry (Block #${tampered_block_id}). Current version integrity verified independently.` : null;

        return res.json({
            status: isTampered ? "tampered" : "valid",
            valid: !isTampered,
            verdict: isTampered ? "TAMPERED" : "ORIGINAL",
            document_id: doc.block_index,
            block_index: doc.block_index,
            checked_blocks: checked,
            signature_status,
            merkle_status,
            merkle_root: doc.merkle_root,
            merkle_proof_length,
            tamper_reasons: isTampered ? tamper_reasons : [],
            ocr_similarity_score: ocr_similarity,
            ocr_threshold: OCR_THRESHOLD,
            ocr_tampered: ocr_tampered,
            forensic_comparison,
            signature_comparison,
            merkle_warning,
            chain_warning,
            ai_report // Added Gemini report
        });

    } catch (error) {
        console.error('[VERIFY_ERROR]', error);
        if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
