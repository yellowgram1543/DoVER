/**
 * server/routes/verify_public.js
 *
 * Public verification endpoints — no API key, no session required.
 *
 * Security properties
 * ───────────────────
 * 1. Rate-limited on every route via verifyLimiter.
 * 2. No raw key material, internal user IDs, or registry internals are
 *    returned.  All sensitive fields are filtered through buildPublicPayload().
 * 3. All registry/signature logic is delegated to verificationService —
 *    this file never touches key_registry or the crypto module directly.
 * 4. Mounted exclusively under /api/public/verify in app.js so it can
 *    never accidentally inherit auth middleware from the privileged router.
 */

'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../db/db');
const { verifyLimiter }         = require('../middleware/limiters');
const { resolveSignatureStatus, buildPublicPayload } = require('../utils/verificationService');

// ─────────────────────────────────────────────────────────────
// GET /api/public/verify/:hash
// Public hash-lookup — returns a minimal integrity summary.
// ─────────────────────────────────────────────────────────────
router.get('/:hash', verifyLimiter, async (req, res) => {
    try {
        const hash = req.params.hash;
        const doc  = db
            .prepare('SELECT * FROM documents WHERE block_hash = ?')
            .get(hash);

        if (!doc) {
            return res.json({ found: false, message: 'No record found' });
        }

        const { signature_status, issuer_name } = resolveSignatureStatus(doc);
        return res.json(buildPublicPayload(doc, signature_status, issuer_name));

    } catch (error) {
        console.error('[PUBLIC_VERIFY_ERROR]', error);
        return res.status(500).json({ success: false, error: 'Verification failed' });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /api/public/verify/qr/:hash
// QR-code verification — same data shape, dedicated path so QR
// payloads can be versioned independently in future.
// ─────────────────────────────────────────────────────────────
router.get('/qr/:hash', verifyLimiter, async (req, res) => {
    try {
        const hash = req.params.hash;
        const doc  = db
            .prepare('SELECT * FROM documents WHERE block_hash = ?')
            .get(hash);

        if (!doc) {
            return res.json({ found: false, message: 'No record found' });
        }

        const { signature_status, issuer_name } = resolveSignatureStatus(doc);
        return res.json(buildPublicPayload(doc, signature_status, issuer_name));

    } catch (error) {
        console.error('[PUBLIC_QR_VERIFY_ERROR]', error);
        return res.status(500).json({ success: false, error: 'Verification failed' });
    }
});

module.exports = router;