const express = require('express');
const router = express.Router();
const db = require('../db/db');
const { requireAuthority } = require('../middleware/auth');

/**
 * GET /api/admin/users
 * Returns a list of all users.
 * Restricted to authorities.
 */
router.get('/users', requireAuthority, (req, res) => {
    try {
        const users = db.prepare('SELECT id, name, email, role, last_login, created_at, department FROM users ORDER BY created_at DESC').all();
        res.json(users);
    } catch (error) {
        console.error('[ADMIN_USERS_ERROR]', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve users' });
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
