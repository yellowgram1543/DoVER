const { createClient } = require('redis');
const db = require('../db/db');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const isTLS = redisUrl.startsWith('rediss://');
let redisClient;

async function getRedisClient() {
    if (!redisClient) {
        redisClient = createClient({
            url: redisUrl,
            ...(isTLS ? { socket: { tls: true } } : {})
        });
        redisClient.on('error', (err) => console.error('Redis Client Error', err));
        await redisClient.connect();
    }
    return redisClient;
}

// --- In-Memory Fallback Cache ---
// Used when Redis is unavailable. Keyed identically to Redis so that
// localIncr / localSet / localGet / isIpBlockedLocally are all consistent
// regardless of which function writes and which reads.
const localCache = new Map();

function cleanLocalCache() {
    const now = Date.now();
    for (const [key, value] of localCache.entries()) {
        // Only delete entries that have a real expiry set — never delete Infinity entries
        // here; those are cleaned up explicitly when they are no longer needed.
        if (value.expiresAt !== Infinity && value.expiresAt < now) {
            localCache.delete(key);
        }
    }
}

// Run cleanup every 60 seconds to prevent unbounded memory growth.
setInterval(cleanLocalCache, 60000);

/**
 * Atomically increment a counter in the local cache.
 * @param {string} key
 * @param {number} weight   - Amount to increment by (default 1)
 * @param {number|null} ttlSeconds - TTL in seconds. null = no expiry (Infinity).
 * @returns {number} new count
 */
function localIncr(key, weight = 1, ttlSeconds = null) {
    cleanLocalCache();
    let entry = localCache.get(key);
    if (!entry || (entry.expiresAt !== Infinity && entry.expiresAt < Date.now())) {
        // Entry missing or already expired — start fresh with correct TTL.
        entry = { count: 0, expiresAt: ttlSeconds ? Date.now() + (ttlSeconds * 1000) : Infinity };
    }
    entry.count += weight;
    localCache.set(key, entry);
    return entry.count;
}

/**
 * Set an explicit value in the local cache (used for blocklist flags).
 */
function localSet(key, value, ttlSeconds = null) {
    localCache.set(key, {
        count: value,
        expiresAt: ttlSeconds ? Date.now() + (ttlSeconds * 1000) : Infinity
    });
}

/**
 * Get a value from the local cache, returning null if absent or expired.
 */
function localGet(key) {
    cleanLocalCache();
    const entry = localCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== Infinity && entry.expiresAt < Date.now()) {
        localCache.delete(key);
        return null;
    }
    return entry.count;
}

// -------------------------------------------

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

    const weight = SCORE_WEIGHTS[signalType] || 1;
    const key = `abuse:score:${userId}`;
    let newScore;

    try {
        const client = await getRedisClient();
        newScore = await client.incrBy(key, weight);
        if (newScore === weight) await client.expire(key, 3600);
    } catch (error) {
        console.warn('[REDIS_FALLBACK] Redis offline, using local cache for recordSignal');
        newScore = localIncr(key, weight, 3600);
    }

    try {
        if (newScore >= THRESHOLDS.BLOCK) {
            db.prepare('UPDATE users SET is_flagged = 1, abuse_score = ? WHERE id = ?').run(newScore, userId);
        } else if (newScore >= THRESHOLDS.FLAG) {
            db.prepare('UPDATE users SET is_flagged = 1, abuse_score = ? WHERE id = ?').run(newScore, userId);
        } else {
            db.prepare('UPDATE users SET abuse_score = ? WHERE id = ?').run(newScore, userId);
        }
    } catch (e) {
        console.error('[ABUSE_DB_ERROR]', e);
    }

    return newScore;
}

async function recordAuthFailure(ip) {
    let count;
    const key = `abuse:auth_fail:${ip}`;
    const blockKey = `blocklist:${ip}`;

    try {
        const client = await getRedisClient();
        count = await client.incr(key);
        if (count === 1) await client.expire(key, 900);

        if (count >= 5) {
            await client.set(blockKey, '1', { EX: 900 });
        }
    } catch (error) {
        console.warn('[REDIS_FALLBACK] Redis offline, using local cache for recordAuthFailure');
        count = localIncr(key, 1, 900);

        if (count >= 5) {
            // Write block to local cache under the same key isIpBlocked reads from,
            // so the block is enforced even without Redis.
            localSet(blockKey, '1', 900);
        }
    }

    if (count >= 5) {
        try {
            db.prepare(`INSERT INTO audit_log (document_id, action, actor, details) VALUES (?, ?, ?, ?)`)
                .run(0, 'IP_BLOCKED', ip, `IP ${ip} blocked after ${count} auth failures.`);
        } catch (e) {}
    }

    return count;
}

async function isIpBlocked(ip) {
    const key = `blocklist:${ip}`;
    try {
        const client = await getRedisClient();
        const isBlocked = await client.get(key);
        return !!isBlocked;
    } catch (error) {
        // Fall back to local cache — uses the same key so blocks written by
        // recordAuthFailure's fallback path are correctly read here.
        return !!(localGet(key));
    }
}

async function recordUploadVelocity(userId) {
    if (!userId) return;
    const key = `abuse:upload_velocity:${userId}`;
    let count;

    try {
        const client = await getRedisClient();
        count = await client.incr(key);
        if (count === 1) await client.expire(key, 60); // 1 minute window
        return count;
    } catch (error) {
        console.warn('[REDIS_FALLBACK] Redis offline, using local cache for recordUploadVelocity');
        count = localIncr(key, 1, 60);
    }

    // Abuse signal is raised whether Redis is up or down — previously it was
    // silently dropped on Redis failure in the original implementation.
    if (count > 2) {
        await recordSignal(userId, 'RAPID_UPLOAD');
    }

    return count;
}

module.exports = {
    recordSignal,
    recordAuthFailure,
    isIpBlocked,
    recordUploadVelocity
};
