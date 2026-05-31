const { recordAuthFailure } = require('../utils/abuse');

/**
 * Middleware to ensure the request is authenticated via Passport.js.
 *
 * SECURITY NOTE (Issue #1 — CVE-class: Authentication Bypass):
 * A "Demo Mode Bypass" was removed from this file. It accepted any request
 * carrying `X-User-Id: demo-user` and silently elevated it to full
 * `authority` (admin) privileges with a hardcoded api_secret.
 *
 * This kind of header-triggered backdoor is indistinguishable from a
 * supply-chain implant and must never reach production. Authentication
 * is now handled exclusively through Passport.js sessions.
 *
 * If a demo/judge account is needed:
 *   1. Register normally via POST /auth/register
 *   2. Promote via the admin panel or: UPDATE users SET role='authority' WHERE email='judge@example.com';
 *   3. Credentials stay in the database, are auditable, and are revocable.
 */
function requireAuth(req, res, next) {
    if (req.isAuthenticated() && req.user) {
        return next();
    }

    // Detect and log attempts to use the now-removed bypass header.
    // This helps catch scanners, old clients, or active exploitation attempts.
    if (req.headers['x-user-id']) {
        const actor = req.ip;
        recordAuthFailure(actor).catch(() => {});
        console.warn(
            `[AUTH_BYPASS_ATTEMPT] X-User-Id header used by ${actor} on ${req.method} ${req.url} — bypass no longer exists.`
        );
        // Return the same 401 as any unauthenticated request.
        // Do NOT reveal that this specific header was detected.
    }

    return res.status(401).json({ error: 'Login required' });
}

/**
 * Middleware to ensure the authenticated user holds the 'authority' role.
 * Must be used after requireAuth in the middleware chain.
 */
function requireAuthority(req, res, next) {
    if (req.user && req.user.role === 'authority') {
        return next();
    }
    return res.status(403).json({ error: 'Authority access required' });
}

module.exports = {
    requireAuth,
    requireAuthority
};
