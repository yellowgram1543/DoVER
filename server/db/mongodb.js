const mongoose = require('mongoose');
require('dotenv').config();

const conn = mongoose.createConnection(process.env.MONGODB_URI || 'mongodb://localhost:27017/docvault');

let bucket;

conn.once('open', () => {
    // Initialize official GridFSBucket
    bucket = new mongoose.mongo.GridFSBucket(conn.db, {
        bucketName: 'uploads'
    });
    console.log('MongoDB GridFS Bucket Connected');
});

module.exports = {
    getBucket: () => bucket,
    getConn: () => conn,
    mongoose: mongoose
};
