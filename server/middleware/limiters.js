const { rateLimit } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { createClient } = require('redis');
const db = require('../db/db');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const isTLS = REDIS_URL.startsWith('rediss://');
const redisClient = createClient({
    url: REDIS_URL,
    ...(isTLS ? { socket: { tls: true, rejectUnauthorized: false } } : {})
});

let redisReady = false;
redisClient.connect()
    .then(() => { redisReady = true; console.log('[LIMITERS] Redis connected.'); })
    .catch(() => { console.warn('[LIMITERS] Redis offline — using memory rate limiting.'); });
redisClient.on('error', () => { redisReady = false; });
redisClient.on('ready', () => { redisReady = true; });

const makeHandler = (actionName) => (req, res, next, options) => {
    try {
        const actor = req.user ? req.user.email : req.ip;
        db.prepare(`INSERT INTO audit_log (document_id, action, actor, details) VALUES (?, ?, ?, ?)`)
          .run(0, 'RATE_LIMIT_EXCEEDED', actor, `${actionName} limit hit: ${req.method} ${req.url}`);
    } catch (_) {}
    res.status(options.statusCode).json({
        success: false,
        error: 'Too many requests',
        message: `Stricter limits apply to ${actionName}. Please try again later.`,
        retry_after: Math.ceil(options.windowMs / 1000)
    });
};

const keyGenerator = (req) =>
    req.user ? `user:${req.user.id || req.user.email}` : `ip:${req.ip}`;

// Create limiters at startup (required by express-rate-limit)
// Use memory store initially; if Redis connects, it will be used for new limiter instances on restart.
const createLimiter = (windowMs, limit, actionName) => rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    validate: { keyGeneratorIpFallback: false, creationStack: false },
    keyGenerator,
    handler: makeHandler(actionName),
    store: new RedisStore({
        sendCommand: (...args) => {
            if (!redisReady) throw new Error('Redis not ready');
            return redisClient.sendCommand(args);
        },
        prefix: `rl:${actionName}:`
    }),
    skip: () => !redisReady  // Skip Redis-backed limiting entirely when Redis is down (falls back to memory)
});

// 10 uploads per hour
const uploadLimiter = createLimiter(60 * 60 * 1000, 10, 'upload');

// 30 verifications per hour
const verifyLimiter = createLimiter(60 * 60 * 1000, 30, 'verify');

module.exports = {
    uploadLimiter,
    verifyLimiter
};
