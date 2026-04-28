/**
 * Middleware to ensure the request is authenticated via Passport.js
 */
function requireAuth(req, res, next) {
    // Standard Passport Check
    if (req.isAuthenticated() || req.user) {
        return next();
    }

    // Demo Mode Bypass: Check for the specific Hackathon Judge ID
    const demoUserId = req.headers['x-user-id'];
    if (demoUserId === 'demo-user') {
        // Mock a user object for the request
        req.user = {
            id: 'demo-user',
            name: 'Hackathon Judge',
            email: 'judge@hackathon.io',
            role: 'authority',
            api_secret: 'demo-secret-key-12345'
        };
        return next();
    }

    res.status(401).json({ error: "Login required" });
}

/**
 * Middleware to ensure the user has the 'authority' role.
 * Currently defaults to 'user' in the mock strategy, but prepared for expansion.
 */
function requireAuthority(req, res, next) {
    if (req.user && req.user.role === 'authority') {
        return next();
    }
    res.status(403).json({ error: "Authority access required" });
}

module.exports = {
    requireAuth,
    requireAuthority
};
