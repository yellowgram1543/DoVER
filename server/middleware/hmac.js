const crypto = require('crypto');
const db = require('../db/db');
const { recordAuthFailure } = require('../utils/abuse');

module.exports = async (req, res, next) => {
    const signature = req.header('X-Signature');
    const timestamp = req.header('X-Timestamp');

    if (!signature || !timestamp) {
        if (req.isAuthenticated && req.isAuthenticated()) {
            return next();
        }
        return res.status(401).json({ error: 'Missing X-Signature or X-Timestamp' });
    }

    // Check clock skew (5 minutes)
    const now = Math.floor(Date.now() / 1000);
    const requestTime = parseInt(timestamp);
    if (isNaN(requestTime) || Math.abs(now - requestTime) > 300) {
        return res.status(401).json({ error: 'Request timestamp expired or invalid' });
    }

    // Get user's API secret
    let user = req.user;
    if (!user) {
        const userId = req.header('X-User-ID');
        if (userId) {
            user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
            if (user) {
                req.user = user;
            }
        }
    }

    if (!user || !user.api_secret) {
        return res.status(401).json({ error: 'API Secret not configured' });
    }

    // Recompute HMAC
    // Payload: method + originalUrl + timestamp + fileHash + body
    const fileHash = req.header('X-File-Hash') || '';
    
    let bodyStr = '';
    if (req.method !== 'GET' && req.body && Object.keys(req.body).length > 0) {
        // Sort keys for stable stringification
        const sortedBody = Object.keys(req.body).sort().reduce((acc, key) => {
            acc[key] = req.body[key];
            return acc;
        }, {});
        bodyStr = JSON.stringify(sortedBody);
    }
    const nonce = req.header('X-Nonce') || '';
    const payload = `${req.method}${req.originalUrl}${timestamp}${fileHash}${nonce}${bodyStr}`;
    
    const hmac = crypto.createHmac('sha256', user.api_secret);
    hmac.update(payload);
    const computedSignature = hmac.digest('hex');

    try {
        if (crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(computedSignature, 'hex'))) {
            return next();
        }
    } catch (e) {
        // Handle length mismatch or other errors
    }

    await recordAuthFailure(req.ip);
    res.status(401).json({ error: 'Invalid HMAC signature' });
};
