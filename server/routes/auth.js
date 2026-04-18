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
        const { id, displayName, emails, photos } = req.user;
        res.json({
            id,
            name: displayName,
            email: emails && emails[0]?.value,
            picture: photos && photos[0]?.value,
            role: 'user'
        });
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

module.exports = router;
