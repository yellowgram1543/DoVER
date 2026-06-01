/**
 * verificationService.js
 *
 * Centralised, route-agnostic verification logic.
 *
 * Why this module exists
 * ──────────────────────
 * Previously, signature checking and key-registry queries were duplicated
 * (with subtle differences) across three separate route handlers inside
 * verify.js.  That made it easy to introduce regressions and meant that
 * public endpoints were directly touching internal DB primitives without
 * any filtering layer.
 *
 * This module is the single source of truth for:
 *   • resolving the public key for a document (registry-aware)
 *   • verifying the cryptographic signature
 *   • checking CRL / revocation status
 *
 * Public routes call the "safe" helpers that return only the information
 * an unauthenticated consumer should see (no raw key material, no internal
 * DB row data).  Privileged routes can call the same helpers because the
 * service itself controls what is returned — the route no longer needs to
 * know *how* to talk to the registry.
 */

'use strict';

const crypto = require('crypto');
const db     = require('../db/db');

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

/**
 * Resolve the PEM public key and issuer name for a document.
 *
 * Returns { publicKey: string|null, issuerName: string, keyStatus: string }
 * keyStatus values: 'ok' | 'revoked' | 'revoked_by_crl' | 'unknown_key' | 'no_key_configured'
 *
 * @param {object} doc - Full document row from the `documents` table.
 */
function _resolvePublicKey(doc) {
    let publicKey  = null;
    let issuerName = 'DoVER Authority';
    let keyStatus  = 'ok';

    if (doc.signer_fingerprint) {
        // Document was signed with a named key — look it up in the registry.
        const keyRecord = db
            .prepare('SELECT * FROM key_registry WHERE fingerprint = ?')
            .get(doc.signer_fingerprint);

        if (!keyRecord) {
            return { publicKey: null, issuerName, keyStatus: 'unknown_key' };
        }

        if (keyRecord.status !== 'active') {
            return { publicKey: null, issuerName, keyStatus: 'revoked' };
        }

        // Registry status is 'active' — also verify against CRL for defence-in-depth.
        if (keyRecord.serial_number) {
            const isRevoked = db
                .prepare(
                    "SELECT 1 FROM key_registry WHERE serial_number = ? AND status = 'revoked'"
                )
                .get(keyRecord.serial_number);

            if (isRevoked) {
                return { publicKey: null, issuerName, keyStatus: 'revoked_by_crl' };
            }
        }

        publicKey = keyRecord.public_key_pem || keyRecord.public_key || null;

        // Resolve human-readable issuer name without leaking the full user row.
        if (keyRecord.issuer_id) {
            const issuer = db
                .prepare('SELECT name FROM users WHERE id = ?')
                .get(keyRecord.issuer_id);
            if (issuer) issuerName = issuer.name;
        }
    } else {
        // Fallback: use the authority key from environment (unsigned by a named key).
        if (process.env.PUBLIC_KEY_B64) {
            publicKey = Buffer.from(process.env.PUBLIC_KEY_B64, 'base64').toString('utf8');
        } else if (process.env.PUBLIC_KEY) {
            publicKey = process.env.PUBLIC_KEY.replace(/\\n/g, '\n');
        } else {
            return { publicKey: null, issuerName, keyStatus: 'no_key_configured' };
        }
    }

    return { publicKey, issuerName, keyStatus };
}

/**
 * Run the raw crypto verification.
 *
 * Returns 'VERIFIED' | 'INVALID' | 'ERROR'
 */
function _cryptoVerify(blockHash, signatureHex, publicKeyPem) {
    try {
        const verifier = crypto.createVerify('SHA256');
        verifier.update(blockHash);
        return verifier.verify(publicKeyPem, signatureHex, 'hex')
            ? 'VERIFIED'
            : 'INVALID';
    } catch (_) {
        return 'ERROR';
    }
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Determine the signature status for a document.
 *
 * Returns an object safe for both public and privileged consumers:
 * {
 *   signature_status : 'NOT_SIGNED' | 'VERIFIED' | 'INVALID' | 'REVOKED_KEY'
 *                    | 'REVOKED_BY_CRL' | 'UNKNOWN_KEY' | 'ERROR' | 'NO_KEY_CONFIGURED'
 *   issuer_name      : string
 * }
 *
 * No raw public key material or internal DB rows are included.
 *
 * @param {object} doc - Full document row from the `documents` table.
 */
function resolveSignatureStatus(doc) {
    if (!doc.signature) {
        return { signature_status: 'NOT_SIGNED', issuer_name: 'DoVER Authority' };
    }

    const { publicKey, issuerName, keyStatus } = _resolvePublicKey(doc);

    // Map key-resolution failures straight to a status code.
    const failureMap = {
        revoked:          'REVOKED_KEY',
        revoked_by_crl:   'REVOKED_BY_CRL',
        unknown_key:      'UNKNOWN_KEY',
        no_key_configured:'NO_KEY_CONFIGURED',
    };

    if (failureMap[keyStatus]) {
        return {
            signature_status: failureMap[keyStatus],
            issuer_name: issuerName,
        };
    }

    // publicKey is available and the registry check passed.
    const signature_status = _cryptoVerify(doc.block_hash, doc.signature, publicKey);
    return { signature_status, issuer_name: issuerName };
}

/**
 * Build the minimal, safe payload for unauthenticated (public) consumers.
 *
 * Deliberately omits fields that would help an attacker enumerate the
 * registry, probe keys, or fingerprint internal infrastructure:
 *   – signer_fingerprint
 *   – uploaded_by (internal user ID / email)
 *   – ipfs_cid (may expose storage topology)
 *   – raw is_tampered boolean (verdict string is enough)
 *
 * @param {object} doc              - Document row.
 * @param {string} signature_status - Result from resolveSignatureStatus().
 * @param {string} issuer_name      - Human-readable issuer.
 */
function buildPublicPayload(doc, signature_status, issuer_name) {
    return {
        found:             true,
        document_id:       doc.block_index,
        filename:          doc.filename,
        issuer_name,
        upload_timestamp:  doc.upload_timestamp,
        block_index:       doc.block_index,
        block_hash:        doc.block_hash,
        signature_status,
        verdict:           doc.is_tampered ? 'TAMPERED' : 'ORIGINAL',
        forensic_summary:  doc.is_tampered
            ? 'Potential anomalies detected in document structure.'
            : 'No forensic anomalies detected. Document integrity verified.',
    };
}

module.exports = {
    resolveSignatureStatus,
    buildPublicPayload,
};