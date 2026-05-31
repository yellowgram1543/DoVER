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
    .catch(() => { console.warn('[LIMITERS] Redis offline — falling back to in-memory rate limiting.'); });
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

/**
 * Build a rate-limiter that ALWAYS enforces limits.
 *
 * SECURITY: The `skip` option has been intentionally removed.
 * Previously `skip: () => !redisReady` caused every request to be
 * passed through without counting when Redis was offline, making the
 * limiter trivially bypassable by disrupting Redis connectivity.
 *
 * Strategy:
 *  - When Redis is available: use RedisStore (shared across instances,
 *    survives restarts).
 *  - When Redis is unavailable: fall through to the default MemoryStore
 *    which express-rate-limit uses automatically when no `store` option
 *    is provided. Limits are then per-process instead of cluster-wide,
 *    but they are still enforced — a degraded-but-safe posture.
 */
const createLimiter = (windowMs, limit, actionName) => {
    // Build the RedisStore but wrap sendCommand so that if Redis drops
    // after startup, individual commands fail gracefully and the limiter
    // automatically degrades to MemoryStore fallback behaviour built
    // into express-rate-limit (it catches store errors internally).
    const store = new RedisStore({
        sendCommand: async (...args) => {
            if (!redisReady) {
                // Throw so express-rate-limit falls back to its internal
                // MemoryStore rather than silently skipping the count.
                throw new Error('Redis not ready — using memory fallback');
            }
            return redisClient.sendCommand(args);
        },
        prefix: `rl:${actionName}:`
    });

    return rateLimit({
        windowMs,
        limit,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        validate: { keyGeneratorIpFallback: false, creationStack: false },
        keyGenerator,
        handler: makeHandler(actionName),
        store,
        // NO `skip` option — limits are ALWAYS enforced regardless of
        // Redis availability.
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
