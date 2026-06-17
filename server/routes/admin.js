const express = require('express');
const router = express.Router();
const db = require('../db/db');
const { requireAuth, requireAuthority } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

const crypto = require('crypto');
const PKIUtils = require('../utils/pki');

/**
 * GET /api/admin/users
 * Returns a list of all users.
 * Restricted to authorities.
 */
router.get('/users', requireAuthority, (req, res) => {
    try {
        const users = db.prepare('SELECT id, name, email, role, last_login, created_at, department, is_flagged, abuse_score, api_secret FROM users ORDER BY created_at DESC').all();
        // Mask API secret
        const maskedUsers = users.map(u => ({
            ...u,
            api_secret: u.api_secret ? `${u.api_secret.substring(0, 4)}...${u.api_secret.substring(u.api_secret.length - 4)}` : null
        }));
        res.json(maskedUsers);
    } catch (error) {
        console.error('[ADMIN_USERS_ERROR]', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve users' });
    }
});

/**
 * ── Key Registry & Onboarding ──
 */

/**
 * GET /api/admin/keys/requests
 * Lists all business key requests.
 */
router.get('/keys/requests', requireAuthority, (req, res) => {
    try {
        const requests = db.prepare('SELECT * FROM key_requests ORDER BY created_at DESC').all();
        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch requests' });
    }
});

/**
 * GET /api/admin/keys/crl
 * GET /api/public/crl
 * Returns the current Certificate Revocation List (PEM).
 */
const getCRL = (req, res) => {
    try {
        const revoked = db.prepare("SELECT serial_number, revoked_at FROM key_registry WHERE status = 'revoked' AND serial_number IS NOT NULL").all();
        const certInfos = revoked.map(r => ({
            serialNumber: r.serial_number,
            revocationDate: r.revoked_at
        }));
        const crl = PKIUtils.generateCRL(certInfos);
        res.json(crl);
    } catch (error) {
        console.error('[CRL_GEN_ERROR]', error);
        res.status(500).json({ error: 'Failed to generate CRL' });
    }
};

router.get('/keys/crl', requireAuthority, getCRL);

/**
 * POST /api/admin/keys/request
 * Submit a request for a business signing key.
 *
 * Security requirements:
 *  - requireAuth:      The caller must be a logged-in user (session or demo bypass).
 *                      Without this the handler crashes on req.user.id when called
 *                      anonymously, and unauthenticated actors could insert arbitrary
 *                      rows into key_requests.
 *  - Authority guard:  Authorities already have signing capability; they must not be
 *                      able to self-issue key requests, which would bypass the review
 *                      workflow and constitute a privilege escalation.
 */
router.post('/keys/request', requireAuth, (req, res) => {
    // Authorities already hold signing keys issued through the admin approval flow.
    // Allowing them to submit new requests would let an authority self-approve a
    // second key under a different business name without independent review.
    if (req.user.role === 'authority') {
        return res.status(403).json({
            error: 'Authorities may not submit key requests. Use the admin approval workflow.'
        });
    }

    const { businessName, businessRegNo, note } = req.body;
    if (!businessName) return res.status(400).json({ error: 'Business name is required' });

    try {
        // Prevent duplicate pending requests from the same user for the same business.
        // A user who already has a pending request should not flood the review queue.
        const existing = db.prepare(`
            SELECT id FROM key_requests
            WHERE user_id = ? AND LOWER(business_name) = LOWER(?) AND status = 'pending'
        `).get(req.user.id, businessName);

        if (existing) {
            return res.status(409).json({
                error: 'A pending key request for this business already exists.',
                existing_request_id: existing.id
            });
        }

        db.prepare(`
            INSERT INTO key_requests (user_id, business_name, business_reg_no, request_note)
            VALUES (?, ?, ?, ?)
        `).run(req.user.id, businessName, businessRegNo || null, note || null);

        // Audit trail so administrators can see who requested a key and when.
        db.prepare(`INSERT INTO audit_log (document_id, action, actor, details) VALUES (?, ?, ?, ?)`)
            .run(0, 'KEY_REQUEST_SUBMITTED', req.user.email || req.user.id,
                `Key request submitted for business: ${businessName}`);

        res.json({ success: true, message: 'Key request submitted for review' });
    } catch (error) {
        console.error('[KEY_REQUEST_ERROR]', error);
        res.status(500).json({ error: 'Failed to submit request' });
    }
});

/**
 * POST /api/admin/keys/approve/:id
 * Admin approves a request and generates a P12 keypair.
 */
router.post('/keys/approve/:id', requireAuthority, async (req, res) => {
    const requestId = req.params.id;
    const { password } = req.body; // Password for the P12 file

    if (!password) return res.status(400).json({ error: 'Password for P12 is required' });

    try {
        const request = db.prepare('SELECT * FROM key_requests WHERE id = ?').get(requestId);
        if (!request) return res.status(404).json({ error: 'Request not found' });
        if (request.status !== 'pending') return res.status(400).json({ error: 'Request already processed' });

        // Generate Keypair
        const { p12Buffer, publicKeyPem, fingerprint, serialNumber } = PKIUtils.generateBusinessP12(request.business_name, password);

        // Save P12 to certs folder for the processor to use
        const certsDir = path.resolve(__dirname, '..', '..', 'certs');
        if (!fs.existsSync(certsDir)) fs.mkdirSync(certsDir);
        fs.writeFileSync(path.join(certsDir, `${fingerprint}.p12`), p12Buffer);
        
        // Securely encrypt the password before saving to disk
        const encryptedPassword = PKIUtils.encryptData(password);
        fs.writeFileSync(path.join(certsDir, `${fingerprint}.pwd`), encryptedPassword);

        // Update Registry
        db.prepare(`
            INSERT INTO key_registry (issuer_id, public_key, fingerprint, serial_number, verified_by, verification_method, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(request.user_id, publicKeyPem, fingerprint, serialNumber, req.user.id, 'admin_approval', 'active');

        // Mark request as approved
        db.prepare(`
            UPDATE key_requests 
            SET status = 'approved', processed_at = datetime('now'), processed_by = ? 
            WHERE id = ?
        `).run(req.user.id, requestId);

        // Audit Log
        db.prepare(`INSERT INTO audit_log (document_id, action, actor, details) VALUES (?, ?, ?, ?)`)
          .run(0, 'KEY_ISSUED', req.user.name, `Approved key for ${request.business_name} (Fingerprint: ${fingerprint})`);

        // Send P12
        res.setHeader('Content-Type', 'application/x-pkcs12');
        res.setHeader('Content-Disposition', `attachment; filename="${request.business_name.replace(/\s+/g, '_')}_cert.p12"`);
        res.send(p12Buffer);

    } catch (error) {
        console.error('[APPROVE_KEY_ERROR]', error);
        res.status(500).json({ error: 'Failed to approve request' });
    }
});

/**
 * POST /api/admin/keys/revoke/:id
 * Revokes an active signing key.
 */
router.post('/keys/revoke/:id', requireAuthority, (req, res) => {
    const keyId = req.params.id;
    const { reason } = req.body;

    try {
        const key = db.prepare('SELECT * FROM key_registry WHERE id = ?').get(keyId);
        if (!key) return res.status(404).json({ error: 'Key not found' });

        db.prepare(`
            UPDATE key_registry 
            SET status = 'revoked', revoked_at = datetime('now'), revocation_reason = ? 
            WHERE id = ?
        `).run(reason || 'Admin revocation', keyId);

        // Audit Log
        db.prepare(`INSERT INTO audit_log (document_id, action, actor, details) VALUES (?, ?, ?, ?)`)
          .run(0, 'KEY_REVOKED', req.user.name, `Revoked key ID ${keyId} (Fingerprint: ${key.fingerprint})`);

        res.json({ success: true, message: 'Key revoked successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to revoke key' });
    }
});

/**
 * POST /api/admin/generate-secret
 * Generates or resets a user's API secret.
 */
router.post('/generate-secret', requireAuthority, (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    try {
        const secret = crypto.randomBytes(32).toString('hex');
        db.prepare('UPDATE users SET api_secret = ? WHERE id = ?').run(secret, userId);
        
        res.json({ success: true, secret });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate secret' });
    }
});

/**
 * POST /api/admin/unflag
 * Clears the flagged status of a user.
 */
router.post('/unflag', requireAuthority, (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    try {
        db.prepare('UPDATE users SET is_flagged = 0, abuse_score = 0 WHERE id = ?').run(userId);
        res.json({ success: true, message: 'User unflagged' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to unflag user' });
    }
});

/**
 * POST /api/admin/promote
 * Promotes a user to a new role.
 * Restricted to authorities.
 */
router.post('/promote', requireAuthority, (req, res) => {
    const { userId, newRole } = req.body;

    if (!userId || !newRole) {
        return res.status(400).json({ success: false, error: 'userId and newRole are required' });
    }

    // Validate role
    const validRoles = ['user', 'authority'];
    if (!validRoles.includes(newRole)) {
        return res.status(400).json({ success: false, error: 'Invalid role' });
    }

    try {
        const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        db.prepare('UPDATE users SET role = ? WHERE id = ?').run(newRole, userId);

        // Audit log (using 0 for system-wide actions)
        db.prepare(`INSERT INTO audit_log (document_id, action, actor, details) VALUES (?, ?, ?, ?)`)
            .run(0, 'USER_PROMOTION', req.user.name, `Authority ${req.user.name} promoted ${user.name} to ${newRole}`);

        res.json({ success: true, message: `User ${user.name} promoted to ${newRole}` });
    } catch (error) {
        console.error('[ADMIN_PROMOTE_ERROR]', error);
        res.status(500).json({ success: false, error: 'Failed to promote user' });
    }
});

module.exports = router;
