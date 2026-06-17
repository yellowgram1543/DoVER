require('dotenv').config();
const Queue = require('bull');
const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const isTLS = REDIS_URL.startsWith('rediss://');

// Bull (ioredis) connection logic for Upstash
const redisOptions = isTLS ? {
    tls: {},
    maxRetriesPerRequest: null,
    enableReadyCheck: false
} : {
    maxRetriesPerRequest: null,
};

const client = new Redis(REDIS_URL, redisOptions);
const subscriber = new Redis(REDIS_URL, redisOptions);

const documentQueue = new Queue('document-processing', {
    createClient: (type) => {
        switch (type) {
            case 'client': return client;
            case 'subscriber': return subscriber;
            default: return new Redis(REDIS_URL, redisOptions);
        }
    },
    settings: {
        lockDuration: 180000,
        stalledInterval: 120000,
    }
});

let queueErrorLogged = false;
documentQueue.on('error', (error) => {
    if (!queueErrorLogged) {
        console.warn('[QUEUE] Redis connection failed (falling back to sync):', error.message);
        queueErrorLogged = true;
    }
});

module.exports = documentQueue;