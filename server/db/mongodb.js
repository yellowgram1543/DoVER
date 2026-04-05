const mongoose = require('mongoose');
const Grid = require('gridfs-stream');
require('dotenv').config();

const conn = mongoose.createConnection(process.env.MONGODB_URI || 'mongodb://localhost:27017/docvault');

let gfs;

conn.once('open', () => {
    // Initialize stream
    gfs = Grid(conn.db, mongoose.mongo);
    gfs.collection('uploads');
    console.log('MongoDB GridFS Connected');
});

module.exports = {
    getGfs: () => gfs,
    getConn: () => conn,
    mongoose: mongoose
};
