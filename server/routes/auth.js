const express = require('express');
const router = express.Router();
const passport = require('../utils/passport');

// Initiate Google Login
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}));

// Google Auth Callback
router.get('/google/callback', 
    passport.authenticate('google', { failureRedirect: '/?error=auth_failed' }),
    (req, res) => {
        res.redirect('/?authenticated=true');
    }
);

// Logout
router.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        res.redirect('/');
    });
});

// Get Current User
router.get('/me', (req, res) => {
    if (req.isAuthenticated()) {
        const user = req.user;
        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            picture: user.picture,
            role: user.role || 'user',
            department: user.department || null,
            api_secret: user.api_secret || null
        });
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

module.exports = router;
