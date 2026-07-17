/**
 * server/routes/verify.js  —  Privileged verification endpoints
 *
 * Every route in this file is protected by at minimum:
 *   verifyLimiter  → rate-limit abuse
 *   apiKey         → valid X-Api-Key header
 *
 * The POST / and GET /:id/proof routes additionally require:
 *   hmacMiddleware + requireAuth  (applied at the app.js mount point)
 *
 * Public (unauthenticated) hash/QR lookups have been moved to
 *   server/routes/verify_public.js
 * which is mounted under /api/public/verify and never inherits
 * the middleware chain below.
 *
 * All key-registry queries and signature crypto have been moved to
 *   server/utils/verificationService.js
 * so that neither this router nor the public router duplicates that logic.
 */

'use strict';

const express   = require('express');
const router    = express.Router();
const multer    = require('multer');
const db        = require('../db/db');
const hasher    = require('../utils/hasher');
const ocr       = require('../utils/ocr');
const gemini    = require('../utils/gemini');
const forensics = require('../utils/forensics');
const signature = require('../utils/signature');
const crypto    = require('crypto');
const fs        = require('fs');
const path      = require('path');
const { getBucket, mongoose }   = require('../db/mongodb');
const { calculateSimilarity }   = require('../utils/ocr');
const apiKey                    = require('../middleware/apiKey');
const { verifyMerkleProof }     = require('../utils/merkle');
const { verifyLimiter }         = require('../middleware/limiters');
const { recordSignal }          = require('../utils/abuse');
const { resolveSignatureStatus } = require('../utils/verificationService');

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
if (!fs.existsSync('tmp'))     fs.mkdirSync('tmp');

const upload = multer({ dest: 'tmp/' });

/**
 * Determines whether a user is permitted to access the full proof bundle for a document.
 *
 * Access is granted when ANY of the following is true:
 *  1. The user holds the 'authority' role (platform-wide admin/authority access).
 *  2. The user's email matches the uploader_email stored on the document (case-insensitive).
 *  3. The user's display name matches the uploaded_by field — covers legacy records that
 *     pre-date the uploader_email column and therefore have no email on the document.
 *
 * The function deliberately returns false for any falsy user value so it can safely be
 * called without an additional null-guard at the call site.
 *
 * @param {object|null|undefined} user - The req.user object populated by Passport / auth middleware.
 * @param {object} document            - The document row from the SQLite `documents` table.
 * @returns {boolean}
 */
function canAccessProof(user, document) {
    if (!user) return false;

    // Authority role: platform-level access, may audit any document.
    if (user.role === 'authority') return true;

    // Primary ownership check: email comparison (case-insensitive).
    // Both sides must be non-empty strings to avoid false positives when either is NULL/undefined.
    if (
        document.uploader_email &&
        user.email &&
        document.uploader_email.toLowerCase() === user.email.toLowerCase()
    ) {
        return true;
    }

    // Fallback ownership check: display-name comparison for legacy documents that were
    // recorded before the uploader_email column was added (see migrate_email.js).
    // Only used when the document has no uploader_email stored at all.
    if (
        !document.uploader_email &&
        document.uploaded_by &&
        user.name &&
        document.uploaded_by === user.name
    ) {
        return true;
    }

    return false;
}

// ─────────────────────────────────────────────────────────────
// GET /:id/proof  — download a full proof bundle (privileged)
// Requires: verifyLimiter + apiKey (+ hmac + auth from app.js)
// ─────────────────────────────────────────────────────────────
router.get('/:id/proof', verifyLimiter, apiKey, (req, res) => {
    try {
        const id  = req.params.id;
        const doc = db
            .prepare('SELECT * FROM documents WHERE block_index = ?')
            .get(id);

        if (!doc) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        // ── Ownership / Role Check ────────────────────────────────────────────────
        // req.user is populated by the requireAuth middleware that app.js wraps this
        // route in (see the '/api/verify' mount block).  The apiKey middleware alone
        // does NOT set req.user, so an unauthenticated API-key-only caller will always
        // reach this branch and be rejected.
        if (!canAccessProof(req.user, doc)) {
            // Audit the denial so administrators can detect enumeration attempts.
            try {
                db.prepare(
                    `INSERT INTO audit_log (document_id, action, actor, details) VALUES (?, ?, ?, ?)`
                ).run(
                    doc.block_index,
                    'PROOF_ACCESS_DENIED',
                    req.user ? (req.user.email || req.user.id || 'unknown') : 'unauthenticated',
                    `Attempted proof download for document owned by ${doc.uploader_email || doc.uploaded_by}`
                );
            } catch (auditErr) {
                console.error('[PROOF_AUDIT_ERROR]', auditErr);
            }
            return res.status(403).json({ success: false, error: 'Permission denied' });
        }

        // ── Build Proof Bundle ────────────────────────────────────────────────────
        // NOTE: The authority's public key is deliberately excluded from the proof
        // bundle.  It is a server-side infrastructure secret; embedding it in a
        // downloadable file would expose key material to any party who later receives
        // the proof document.  Verifiers who need the public key should fetch it from
        // the canonical /api/public/crl or key-registry endpoints instead.
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
            signer_fingerprint: doc.signer_fingerprint || null,
            ocr_text_stored: doc.ocr_text,
            forensic_score: doc.forensic_score ? JSON.parse(doc.forensic_score) : null,
            verified_at: new Date().toISOString()
        };

        // Audit successful proof downloads for compliance / access-log purposes.
        try {
            db.prepare(
                `INSERT INTO audit_log (document_id, action, actor, details) VALUES (?, ?, ?, ?)`
            ).run(
                doc.block_index,
                'PROOF_DOWNLOADED',
                req.user.email || req.user.id || 'unknown',
                `Proof bundle downloaded by ${req.user.role || 'user'}`
            );
        } catch (auditErr) {
            console.error('[PROOF_AUDIT_ERROR]', auditErr);
        }

        res.setHeader('Content-Disposition', 'attachment; filename=proof_' + id + '.json');
        return res.json(proof);

    } catch (error) {
        console.error('[PROOF_ERROR]', error);
        return res.status(500).json({ success: false, error: 'Failed to generate proof' });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /:hash  — quick chain verification (privileged)
// Requires: verifyLimiter + apiKey
// ─────────────────────────────────────────────────────────────
router.get('/:hash', verifyLimiter, apiKey, async (req, res) => {
    try {
        const hash = req.params.hash;
        const doc  = db
            .prepare('SELECT * FROM documents WHERE block_hash = ?')
            .get(hash);

        if (!doc) {
            return res.status(404).json({ success: false, status: 'invalid', error: 'Hash not found in chain' });
        }

        if (doc.is_tampered) {
            return res.json({ success: true, status: 'tampered', block_index: doc.block_index });
        }

        // ── Digital Signature Verification (via service layer) ──
        const { signature_status } = resolveSignatureStatus(doc);

        if (signature_status === 'NO_KEY_CONFIGURED') {
            return res.json({ success: true, status: 'invalid', reason: 'PUBLIC_KEY_MISSING' });
        }

        // ── Safe Async Chain Traversal ──
        const MAX_DEPTH = 10000;
        const visited   = new Set();
        let currentHash = doc.prev_hash;
        let checked     = 0;

        for (
            let depth = 0;
            depth < MAX_DEPTH && currentHash && currentHash !== '0000000000000000';
            depth++
        ) {
            if (visited.has(currentHash)) {
                return res.json({
                    success: true,
                    status: 'invalid',
                    reason: 'CYCLE_DETECTED',
                    checked_blocks: checked,
                });
            }
            visited.add(currentHash);

            const current = db
                .prepare('SELECT * FROM documents WHERE block_hash = ?')
                .get(currentHash);

            if (!current) break;

            if (current.is_tampered) {
                return res.json({
                    success: true,
                    status: 'invalid',
                    reason: 'HISTORICAL_TAMPER',
                    checked_blocks: checked,
                    tampered_block: current.block_index,
                });
            }

            checked++;
            currentHash = current.prev_hash;

            if (current.checkpoint_hash) {
                console.log(`[VERIFY] Trust anchor reached at Block #${current.block_index}`);
                break;
            }

            if (depth % 50 === 0) await new Promise(resolve => setImmediate(resolve));
        }

        if (checked >= MAX_DEPTH) {
            return res.json({
                success: true,
                status: 'invalid',
                reason: 'MAX_DEPTH_EXCEEDED',
                checked_blocks: checked,
            });
        }

        return res.json({
            success:         true,
            status:          signature_status === 'INVALID' ? 'tampered' : 'valid',
            block_index:     doc.block_index,
            checked_blocks:  checked,
            signature_status,
            is_checkpoint:   !!doc.checkpoint_hash,
        });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

// ─────────────────────────────────────────────────────────────
// POST /  — deep file verification (privileged)
// Requires: verifyLimiter + apiKey (+ hmac + auth from app.js)
// ─────────────────────────────────────────────────────────────
router.post('/', verifyLimiter, apiKey, upload.single('file'), async (req, res) => {
    let tmpPath = '';
    try {
        let newPath = null;
        if (req.file) {
            const ext = req.file.mimetype === 'image/png' ? '.png' : '.jpg';
            newPath   = req.file.path + ext;
            fs.renameSync(req.file.path, newPath);
        }

        if (!req.body.document_id && !req.file) {
            return res.status(400).json({ success: false, error: 'Provide a document ID or file' });
        }

        let doc;
        let isComparisonVerify = false;
        const compareWith = req.body.compare_with;

        // Compute hash early (before any DB lookup) to avoid filename-spoofing attacks.
        let currentFileHash;
        if (req.file && newPath) {
            currentFileHash = hasher.generateFileHash(newPath);
        }

        // 1. Identify the document to verify against.
        if (req.body.document_id) {
            console.log('[TRACE] Received document_id:', req.body.document_id);
            doc = db
                .prepare('SELECT * FROM documents WHERE block_index = ?')
                .get(req.body.document_id);
            if (req.file) isComparisonVerify = true;

        } else if (req.file) {
            if (compareWith) {
                doc = db
                    .prepare(
                        'SELECT * FROM documents WHERE file_hash = ? AND LOWER(uploader_email) = LOWER(?) ORDER BY block_index DESC LIMIT 1'
                    )
                    .get(currentFileHash, compareWith);
            } else {
                doc = db
                    .prepare(
                        'SELECT * FROM documents WHERE file_hash = ? ORDER BY block_index DESC LIMIT 1'
                    )
                    .get(currentFileHash);
            }
            isComparisonVerify = true;
        }

        if (!doc) {
            if (newPath && fs.existsSync(newPath)) fs.unlinkSync(newPath);
            return res.status(404).json({
                success: false,
                error: 'No original record found for this document identity.',
            });
        }

        // 2. Perform Content Comparison.
        let verificationResult;

        if (isComparisonVerify) {
            verificationResult = {
                valid:   currentFileHash.trim() === doc.file_hash.trim(),
                details: { computedFileHash: currentFileHash },
            };
            tmpPath = newPath;
        } else {
            const bucket    = getBucket();
            const storageId = doc.storage_id || doc.filename;

            if (!mongoose.Types.ObjectId.isValid(storageId)) {
                return res.status(400).json({ success: false, error: 'Invalid or legacy document ID' });
            }

            const extMap = {
                'image/png':  '.png',
                'image/jpeg': '.jpg',
                'image/jpg':  '.jpg',
                'text/plain': '.txt',
            };
            const ext = extMap[doc.file_type] || '';
            tmpPath   = path.resolve('tmp', `verify_${Date.now()}_${storageId}${ext}`);

            const downloadStream = bucket.openDownloadStream(
                new mongoose.Types.ObjectId(storageId)
            );
            const writeStream = fs.createWriteStream(tmpPath);
            downloadStream.pipe(writeStream);

            await new Promise((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error',  reject);
            });

            console.log('Calling verifyDocument with:', tmpPath);
            verificationResult = hasher.verifyDocument(doc.block_index, db, tmpPath);
        }

        // ── Digital Signature Verification (via service layer) ──
        const { signature_status } = resolveSignatureStatus(doc);
        const signature_mismatch   = signature_status === 'INVALID';

        if (signature_status === 'NO_KEY_CONFIGURED') {
            if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
            return res.json({ status: 'invalid', reason: 'PUBLIC_KEY_MISSING' });
        }

        if (signature_status === 'ERROR') {
            if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
            return res.json({ status: 'invalid', reason: 'SIGNATURE_VERIFICATION_FAILED' });
        }

        // 3. OCR Extraction (run once and reuse).
        let current_ocr_text        = '';
        let currentOcrLowConfidence = false;

        if (tmpPath && fs.existsSync(tmpPath)) {
            if (/png|jpg|jpeg/.test(doc.file_type)) {
                const ocrResult         = await ocr.extractText(tmpPath);
                current_ocr_text        = ocrResult.text;
                currentOcrLowConfidence = ocrResult.lowConfidence;
            } else if (doc.file_type === 'text/plain' || doc.filename.endsWith('.txt')) {
                current_ocr_text        = fs.readFileSync(tmpPath, 'utf8');
                currentOcrLowConfidence = false;
            }
        }

        current_ocr_text = (!current_ocr_text || current_ocr_text.trim().length === 0)
            ? 'extraction_failed'
            : current_ocr_text.trim();

        // 4. Deep Analysis.
        const OCR_THRESHOLD = 95;
        let ocr_similarity  = 100;
        let ocr_tampered    = false;
        let forensic_comparison  = null;
        let signature_comparison = null;

        if (doc.ocr_text && !currentOcrLowConfidence) {
            ocr_similarity = calculateSimilarity(doc.ocr_text, current_ocr_text);
            ocr_tampered   = ocr_similarity < OCR_THRESHOLD;
        } else if (currentOcrLowConfidence) {
            console.log('[VERIFY] Low OCR confidence — skipping similarity check.');
            ocr_similarity = null;
        }

        if (/png|jpg|jpeg/.test(doc.file_type)) {
            const currentForensic = await forensics.analyzeImage(tmpPath);
            const storedForensic  = doc.forensic_score ? JSON.parse(doc.forensic_score) : null;
            if (storedForensic) {
                forensic_comparison = {
                    suspicious_change: currentForensic.suspicious !== storedForensic.suspicious,
                    font_diff:  Math.abs(currentForensic.font_consistency - storedForensic.font_consistency),
                    align_diff: Math.abs(currentForensic.alignment_score  - storedForensic.alignment_score),
                    new_flags:  currentForensic.flags.filter(f => !storedForensic.flags.includes(f)),
                };
            }

            const currentSig = await signature.detectSignature(tmpPath);
            const storedSig  = doc.signature_score ? JSON.parse(doc.signature_score) : null;
            if (storedSig) {
                const statusChanged = (
                    !!currentSig.signature_found !== !!storedSig.signature_found ||
                    !!currentSig.seal_found      !== !!storedSig.seal_found
                );
                signature_comparison = {
                    status_change:           statusChanged,
                    original_had_signature:  !!storedSig.signature_found,
                    current_has_signature:   !!currentSig.signature_found,
                    original_had_seal:       !!storedSig.seal_found,
                    current_has_seal:        !!currentSig.seal_found,
                };
            }
        }

        // 5. Backward Chain Validation.
        const MAX_DEPTH = 10000;
        const visited   = new Set();
        let currentHash = doc.prev_hash;
        let checked     = 0;
        let historical_tamper_detected = false;
        let tampered_block_id          = null;

        try {
            for (
                let depth = 0;
                depth < MAX_DEPTH && currentHash && currentHash !== '0000000000000000';
                depth++
            ) {
                if (visited.has(currentHash)) break;
                visited.add(currentHash);

                const current = db
                    .prepare('SELECT * FROM documents WHERE block_hash = ?')
                    .get(currentHash);
                if (!current) break;

                if (current.is_tampered) {
                    historical_tamper_detected = true;
                    tampered_block_id          = current.block_index;
                    break;
                }

                checked++;
                currentHash = current.prev_hash;

                if (current.checkpoint_hash) {
                    console.log(`[VERIFY-POST] Trust anchor reached at Block #${current.block_index}`);
                    break;
                }

                if (depth % 50 === 0) await new Promise(resolve => setImmediate(resolve));
            }
        } catch (chainError) {
            console.error('[CHAIN_TRAVERSAL_ERROR]', chainError);
        }

        // 5.5 Merkle Verification.
        let merkle_valid        = null;
        let merkle_status       = 'VERIFIED';
        let merkle_proof_length = 0;

        if (!doc.merkle_proof) {
            merkle_status = 'NOT_COMPUTED';
        } else {
            try {
                const proof       = JSON.parse(doc.merkle_proof);
                merkle_proof_length = proof.length;
                merkle_valid      = verifyMerkleProof(doc.block_hash, proof, doc.merkle_root);
                merkle_status     = merkle_valid ? 'VERIFIED' : 'INVALID';
            } catch (err) {
                console.error('[MERKLE_VERIFY_ERROR]', err);
                merkle_status = 'ERROR';
            }
        }

        // 6. Final Verdict.
        const tamper_reasons = [];
        const fileHashValid  = !!verificationResult.valid;

        if (!fileHashValid) {
            tamper_reasons.push('File hash mismatch');
            if (ocr_tampered) tamper_reasons.push('OCR text similarity below threshold');
            if (forensic_comparison && forensic_comparison.suspicious_change)
                tamper_reasons.push('Forensic analysis detected modifications');
            if (signature_comparison && signature_comparison.status_change)
                tamper_reasons.push('Signature/Seal presence changed');
        }

        if (signature_mismatch) {
            tamper_reasons.push('Signature mismatch');
        }

        const isTampered = tamper_reasons.length > 0;

        console.log(`\n┌── Verification Results for Block #${doc.block_index}`);
        console.log(`│ - File Hash Match: ${fileHashValid ? 'YES' : 'NO'}`);
        console.log(`│ - OCR Similarity: ${ocr_similarity !== null ? ocr_similarity.toFixed(2) + '%' : 'SKIPPED (Low Confidence)'}`);
        console.log(`│ - Forensic Suspicious: ${forensic_comparison ? (forensic_comparison.suspicious_change ? 'YES (CHANGE)' : 'NO CHANGE') : 'N/A'}`);
        console.log(`│ - Signature Valid: ${!signature_mismatch}`);
        console.log(`│ - Chain Status: ${historical_tamper_detected ? '⚠️  WARNING (Historical Tamper at #' + tampered_block_id + ')' : '✅ SECURE'}`);
        console.log(`│ - Final Verdict: ${isTampered ? '🔴 TAMPERED' : '✅ ORIGINAL'}`);
        if (tamper_reasons.length > 0) {
            console.log(`│ - Reasons: ${tamper_reasons.join(', ')}`);
        }
        console.log(`└── Verification Cycle Complete\n`);

        if (isTampered && req.user) {
            recordSignal(req.user.id, 'FAILED_VERIFICATION');
        }

        if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);

        // 6.5 Gemini AI Integrity Report.
        let ai_report = null;
        if (!currentOcrLowConfidence && current_ocr_text !== 'extraction_failed') {
            console.log('[VERIFY] Generating AI Integrity Report via Gemini...');
            ai_report = await gemini.generateDocumentSummary(
                current_ocr_text,
                verificationResult.forensics || {}
            );
        }

        const merkle_warning = merkle_valid === false
            ? 'Merkle proof mismatch (legacy data)'
            : null;
        const chain_warning  = historical_tamper_detected
            ? `Historical tamper detected in ancestry (Block #${tampered_block_id}). Current version integrity verified independently.`
            : null;

        return res.json({
            status:              isTampered ? 'tampered' : 'valid',
            valid:               !isTampered,
            verdict:             isTampered ? 'TAMPERED' : 'ORIGINAL',
            document_id:         doc.block_index,
            block_index:         doc.block_index,
            checked_blocks:      checked,
            signature_status,
            merkle_status,
            merkle_root:         doc.merkle_root,
            merkle_proof_length,
            tamper_reasons:      isTampered ? tamper_reasons : [],
            ocr_similarity_score: ocr_similarity,
            ocr_threshold:       OCR_THRESHOLD,
            ocr_tampered,
            forensic_comparison,
            signature_comparison,
            merkle_warning,
            chain_warning,
            ai_report,
        });

    } catch (error) {
        console.error('[VERIFY_ERROR]', error);
        if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        return res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;