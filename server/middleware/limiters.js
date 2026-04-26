const { rateLimit } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { createClient } = require('redis');
const db = require('../db/db');

const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://127.0.0.1:6379' });
redisClient.connect().catch(console.error);

const createLimiter = (windowMs, limit, actionName) => {
    return rateLimit({
        windowMs,
        limit,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        validate: { keyGeneratorIpFallback: false },
        keyGenerator: (req) => {
            // Use user ID if authenticated, otherwise fallback to IP
            return req.user ? `user:${req.user.id || req.user.email}` : `ip:${req.ip}`;
        },
        store: new RedisStore({
            sendCommand: (...args) => redisClient.sendCommand(args),
            prefix: `rl:${actionName}:`
        }),
        handler: (req, res, next, options) => {
            const actor = req.user ? req.user.email : req.ip;
            db.prepare(`INSERT INTO audit_log (document_id, action, actor, details) VALUES (?, ?, ?, ?)`)
              .run(0, 'RATE_LIMIT_EXCEEDED', actor, `${actionName} limit hit: ${req.method} ${req.url}`);
            
            res.status(options.statusCode).json({
                success: false,
                error: 'Too many requests',
                message: `Stricter limits apply to ${actionName}. Please try again later.`,
                retry_after: Math.ceil(options.windowMs / 1000)
            });
        }
    });
};

// 10 uploads per hour
const uploadLimiter = createLimiter(60 * 60 * 1000, 10, 'upload');

// 30 verifications per hour
const verifyLimiter = createLimiter(60 * 60 * 1000, 30, 'verify');

module.exports = {
    uploadLimiter,
    verifyLimiter
};
