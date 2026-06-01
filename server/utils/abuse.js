const { createClient } = require('redis');
const db = require('../db/db');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const isTLS = redisUrl.startsWith('rediss://');
let redisClient;
let redisClientFactory = createClient;

class MemoryAbuseStore {
    constructor() {
        this.entries = new Map();
    }

    now() {
        return Date.now();
    }

    cleanupExpired() {
        const now = this.now();
        for (const [key, entry] of this.entries.entries()) {
            if (entry.expiresAt && entry.expiresAt <= now) {
                this.entries.delete(key);
            }
        }
    }

    getEntry(key) {
        const entry = this.entries.get(key);
        if (!entry) return null;
        if (entry.expiresAt && entry.expiresAt <= this.now()) {
            this.entries.delete(key);
            return null;
        }
        return entry;
    }

    async incrBy(key, amount) {
        const entry = this.getEntry(key);
        const value = Number(entry?.value || 0) + amount;
        this.entries.set(key, { value, expiresAt: entry?.expiresAt || null });
        return value;
    }

    async incr(key) {
        return this.incrBy(key, 1);
    }

    async expire(key, seconds) {
        const entry = this.getEntry(key);
        if (!entry) return false;
        entry.expiresAt = this.now() + seconds * 1000;
        this.entries.set(key, entry);
        return true;
    }

    async set(key, value, options = {}) {
        const expiresAt = options.EX ? this.now() + options.EX * 1000 : null;
        this.entries.set(key, { value, expiresAt });
        return 'OK';
    }

    async get(key) {
        const entry = this.getEntry(key);
        return entry ? entry.value : null;
    }

    reset() {
        this.entries.clear();
    }
}

const memoryStore = new MemoryAbuseStore();
const cleanupTimer = setInterval(() => memoryStore.cleanupExpired(), 5 * 60 * 1000);
if (cleanupTimer.unref) cleanupTimer.unref();

async function getRedisClient() {
    if (!redisClient || !redisClient.isOpen) {
        redisClient = redisClientFactory({
            url: redisUrl,
            ...(isTLS ? { socket: { tls: true, rejectUnauthorized: false } } : {})
        });
        redisClient.on('error', (err) => console.error('Redis Client Error', err));
        await redisClient.connect();
    }
    return redisClient;
}

async function withAbuseStore(operation, label) {
    try {
        const client = await getRedisClient();
        return await operation(client);
    } catch (error) {
        console.warn(`[${label}_REDIS_FALLBACK] Using in-memory abuse store:`, error.message);
        return operation(memoryStore);
    }
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
        const weight = SCORE_WEIGHTS[signalType] || 1;
        const newScore = await withAbuseStore(async (store) => {
            const key = `abuse:score:${userId}`;
            const score = await store.incrBy(key, weight);
            if (score === weight) {
                await store.expire(key, 3600); // 1 hour window
            }
            return score;
        }, 'ABUSE_SIGNAL');

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
        const count = await withAbuseStore(async (store) => {
            const key = `abuse:auth_fail:${ip}`;
            const failures = await store.incr(key);
            if (failures === 1) {
                await store.expire(key, 900); // 15 minutes window
            }
            if (failures >= 5) {
                await store.set(`blocklist:${ip}`, '1', { EX: 900 }); // Block for 15 mins
            }
            return failures;
        }, 'AUTH_FAILURE');

        if (count >= 5) {
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
        const isBlocked = await withAbuseStore(
            (store) => store.get(`blocklist:${ip}`),
            'IP_BLOCKLIST'
        );
        return !!isBlocked;
    } catch (error) {
        return false;
    }
}

async function recordUploadVelocity(userId) {
    if (!userId) return;
    try {
        const count = await withAbuseStore(async (store) => {
            const key = `velocity:upload:${userId}`;
            const uploads = await store.incr(key);
            if (uploads === 1) {
                await store.expire(key, 10); // 10 second window
            }
            return uploads;
        }, 'UPLOAD_VELOCITY');
        
        // If they upload more than 2 files in 10 seconds, it's considered rapid and abusive
        if (count > 2) {
            await recordSignal(userId, 'RAPID_UPLOAD');
        }
    } catch (error) {
        console.error('[VELOCITY_ERROR]', error);
    }
}

module.exports = {
    recordSignal,
    recordAuthFailure,
    isIpBlocked,
    recordUploadVelocity,
    __test: {
        memoryStore,
        setRedisClientFactory(factory) {
            redisClient = undefined;
            redisClientFactory = factory;
        },
        resetRedisClientFactory() {
            redisClient = undefined;
            redisClientFactory = createClient;
        }
    }
};
