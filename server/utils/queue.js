require('dotenv').config();
const Queue = require('bull');

const documentQueue = new Queue('document-processing', process.env.REDIS_URL, {
    settings: {
        lockDuration: 180000, // 180 seconds (was 60s — OCR+forensics+Gemini can exceed 60s)
        lockRenewTime: 45000, // 45 seconds (renew more frequently)
        stalledInterval: 120000, // Check for stalled jobs every 120s
    }
});

module.exports = documentQueue;