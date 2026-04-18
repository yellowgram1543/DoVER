require('dotenv').config();
const Queue = require('bull');

const documentQueue = new Queue('document-processing', process.env.REDIS_URL, {
    settings: {
        lockDuration: 60000, // 60 seconds (up from 30s)
        lockRenewTime: 15000, // 15 seconds (renew more frequently)
        stalledInterval: 60000, // Check for stalled jobs every 60s
    }
});

module.exports = documentQueue;