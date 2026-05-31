const { createClient } = require('redis');
const db = require('../db/db');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const isTLS = redisUrl.startsWith('rediss://');
let redisClient;

async function getRedisClient() {
    if (!redisClient) {
        redisClient = createClient({
            url: redisUrl,
            ...(isTLS ? { socket: { tls: true, rejectUnauthorized: false } } : {})
        });
        redisClient.on('error', (err) => console.error('Redis Client Error', err));
        await redisClient.connect();
    }
    return redisClient;
}

module.exports = async (req, res, next) => {
    // Only check nonces for POST requests
    if (req.method !== 'POST') {
        return next();
    }

    const nonce = req.header('X-Nonce');
    if (!nonce) {
        return res.status(400).json({
            success: false,
            error: 'Missing X-Nonce header'
        });
    }

    try {
        const client = await getRedisClient();
        const key = `nonce:${nonce}`;

        const result = await client.set(key, 'used', {
            NX: true,
            EX: 300 // 5-minute TTL
        });

        if (!result) {
            // Nonce already consumed — log and reject the replay attempt
            db.prepare(`INSERT INTO audit_log (document_id, action, actor, details) VALUES (?, ?, ?, ?)`)
              .run(0, 'REPLAY_ATTEMPT', req.user ? req.user.email : req.ip, `Duplicate nonce detected: ${nonce}`);

            return res.status(409).json({
                success: false,
                error: 'Duplicate request',
                message: 'This request has already been processed (Nonce Replay).'
            });
        }

        next();
    } catch (error) {
        // SECURITY: Fail CLOSED on Redis errors.
        //
        // Previously this block called next(), silently allowing requests
        // through when Redis was unavailable. Any attacker who can disrupt
        // Redis connectivity could therefore replay arbitrary POST requests
        // indefinitely, defeating the entire purpose of nonce validation.
        //
        // We now return 503 Service Unavailable. This is a deliberate
        // trade-off: a brief availability impact during Redis downtime is
        // far less harmful than the complete loss of replay protection.
        // Operators should configure Redis with high availability (Sentinel
        // / Cluster) to minimise this window.
        console.error('[NONCE_MIDDLEWARE_ERROR] Redis failure — rejecting request to prevent replay attack:', error.message);

        try {
            db.prepare(`INSERT INTO audit_log (document_id, action, actor, details) VALUES (?, ?, ?, ?)`)
              .run(0, 'NONCE_CHECK_FAILED', req.user ? req.user.email : req.ip,
                   `Nonce validation unavailable (Redis error): ${error.message}`);
        } catch (_) {}

        return res.status(503).json({
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            message: 'Request validation is temporarily unavailable. Please retry in a moment.'
        });
    }
};
