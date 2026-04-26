const { createClient } = require('redis');
const db = require('../db/db');

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

const SCORE_WEIGHTS = {
    FAILED_VERIFICATION: 2,
    RAPID_UPLOAD: 3,
    HASH_COLLISION: 1,
    AUTH_FAILURE: 5
};

const THRESHOLDS = {
    FLAG: 15,
    BLOCK: 30
};

async function recordSignal(userId, signalType) {
    if (!userId) return;

    try {
        const client = await getRedisClient();
        const key = `abuse:score:${userId}`;
        const weight = SCORE_WEIGHTS[signalType] || 1;

        // Increment score in Redis
        const newScore = await client.incrBy(key, weight);
        
        // Set TTL if it's a new key
        if (newScore === weight) {
            await client.expire(key, 3600); // 1 hour window
        }

        // Update DB if thresholds reached
        if (newScore >= THRESHOLDS.BLOCK) {
            db.prepare('UPDATE users SET is_flagged = 1, abuse_score = ? WHERE id = ?').run(newScore, userId);
            // We could also implement auto-block logic here (e.g. revoking sessions)
        } else if (newScore >= THRESHOLDS.FLAG) {
            db.prepare('UPDATE users SET is_flagged = 1, abuse_score = ? WHERE id = ?').run(newScore, userId);
        } else {
            // Regularly update the score in DB for visibility
            db.prepare('UPDATE users SET abuse_score = ? WHERE id = ?').run(newScore, userId);
        }

        return newScore;
    } catch (error) {
        console.error('[ABUSE_SIGNAL_ERROR]', error);
    }
}

async function recordAuthFailure(ip) {
    try {
        const client = await getRedisClient();
        const key = `abuse:auth_fail:${ip}`;
        const count = await client.incr(key);
        
        if (count === 1) {
            await client.expire(key, 900); // 15 minutes window
        }

        if (count >= 5) {
            const blockKey = `blocklist:${ip}`;
            await client.set(blockKey, '1', { EX: 900 }); // Block for 15 mins
            
            db.prepare(`INSERT INTO audit_log (document_id, action, actor, details) VALUES (?, ?, ?, ?)`)
              .run(0, 'IP_BLOCKED', ip, `IP ${ip} blocked after ${count} auth failures.`);
        }
        
        return count;
    } catch (error) {
        console.error('[AUTH_FAILURE_LOG_ERROR]', error);
    }
}

async function isIpBlocked(ip) {
    try {
        const client = await getRedisClient();
        const isBlocked = await client.get(`blocklist:${ip}`);
        return !!isBlocked;
    } catch (error) {
        return false;
    }
}

module.exports = {
    recordSignal,
    recordAuthFailure,
    isIpBlocked
};
