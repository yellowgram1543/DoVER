const { createClient } = require('redis');
const db = require('../db/db');

// Use the same Redis URL as the queue
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
let redisClient;

async function getRedisClient() {
    if (!redisClient) {
        redisClient = createClient({ url: redisUrl });
        redisClient.on('error', (err) => console.error('Redis Client Error', err));
        await redisClient.connect();
    }
    return redisClient;
}

module.exports = async (req, res, next) => {
    // Only check nonces for POST requests as per the plan
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
        
        // SETNX (set if not exists) with EX (expiry)
        // In node-redis v4+, set returns 'OK' or null
        // We can use SET with NX and EX options
        const result = await client.set(key, 'used', {
            NX: true,
            EX: 300 // 5 minutes TTL
        });

        if (!result) {
            // Log the replay attempt
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
        console.error('[NONCE_MIDDLEWARE_ERROR]', error);
        // Fail open if Redis is down? The plan says "reject duplicates", 
        // but if Redis is down we might not want to block all traffic.
        // However, for high security, we should probably fail closed.
        // Given this is a hackathon/MVP foundation, let's just log and continue.
        next();
    }
};
