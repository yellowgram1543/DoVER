const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/docvault';

let bucket;
let conn;

function connect() {
    conn = mongoose.createConnection(MONGO_URI, {
        serverSelectionTimeoutMS: 10000,  // Give up connecting after 10s
        socketTimeoutMS: 45000,           // Close socket after 45s of inactivity
        maxPoolSize: 10,
        retryWrites: true,
        retryReads: true,
    });

    conn.once('open', () => {
        bucket = new mongoose.mongo.GridFSBucket(conn.db, { bucketName: 'uploads' });
        console.log('MongoDB GridFS Bucket Connected');
    });

    conn.on('error', (err) => {
        console.error('[MONGODB_ERROR]', err.message);
        // Attempt reconnect after 5s
        setTimeout(() => {
            console.log('[MONGODB] Attempting reconnect...');
            connect();
        }, 5000);
    });

    conn.on('disconnected', () => {
        console.warn('[MONGODB] Disconnected. Attempting reconnect...');
        bucket = null; // Clear stale bucket
    });

    conn.on('reconnected', () => {
        console.log('[MONGODB] Reconnected.');
        bucket = new mongoose.mongo.GridFSBucket(conn.db, { bucketName: 'uploads' });
    });
}

connect();

module.exports = {
    getBucket: () => bucket,
    getConn: () => conn,
    mongoose: mongoose
};
