require('dotenv').config();
const Queue = require('bull');

const documentQueue = new Queue('document-processing', process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    settings: {
        lockDuration: 180000, 
        lockRenewTime: 45000, 
        stalledInterval: 120000, 
    }
});

documentQueue.on('error', (error) => {
    console.error('[QUEUE_ERROR] Redis connection issue:', error.message);
});

module.exports = documentQueue;