require('dotenv').config();
const Queue = require('bull');

const documentQueue = new Queue('document-processing', process.env.REDIS_URL);

module.exports = documentQueue;