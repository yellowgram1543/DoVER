const { Jimp } = require('jimp');
const mongoose = require('mongoose');
const db = require('./server/db/db');
require('dotenv').config();

async function hackCloud(blockIndex) {
    console.log(`--- Starting Cloud Forgery Simulation for Block #${blockIndex} ---`);
    
    // 1. Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });

    // 2. Get File ID from SQL
    const doc = db.prepare('SELECT filename FROM documents WHERE block_index = ?').get(blockIndex);
    if (!doc) {
        console.error('Block not found in database.');
        process.exit(1);
    }
    const fileId = new mongoose.Types.ObjectId(doc.filename);

    // 3. Download from Cloud to local temp
    const tmpPath = './hacked_file.png';
    const downloadStream = bucket.openDownloadStream(fileId);
    const fs = require('fs');
    const writeStream = fs.createWriteStream(tmpPath);
    downloadStream.pipe(writeStream);

    await new Promise((resolve) => writeStream.on('finish', resolve));
    console.log('✅ Document downloaded from cloud.');

    // 4. "Forge" the document using Jimp
    const image = await Jimp.read(tmpPath);
    // Draw a "forged" black box over the content
    image.scan(10, 10, 200, 100, function(x, y, idx) {
        this.bitmap.data[idx + 0] = 0; // Black out
        this.bitmap.data[idx + 1] = 0;
        this.bitmap.data[idx + 2] = 0;
    });
    await image.write(tmpPath);
    console.log('✅ Document modified locally (Forgery complete).');

    // 5. Replace in Cloud (Delete old, Upload new with same ID metadata)
    await bucket.delete(fileId);
    const uploadStream = bucket.openUploadStreamWithId(fileId, 'hacked_doc.png');
    fs.createReadStream(tmpPath).pipe(uploadStream);

    await new Promise((resolve) => uploadStream.on('finish', resolve));
    console.log('🔥 FORGERY UPLOADED TO CLOUD. The vault is now compromised.');

    // Cleanup
    fs.unlinkSync(tmpPath);
    await mongoose.disconnect();
    console.log('\nGo to your browser and click Verify or check the Audit Log!');
}

// Pass the Block Index as a command line argument
const index = process.argv[2];
if (!index) {
    console.log('Usage: node tamper_cloud.js <BlockIndex>');
} else {
    hackCloud(index);
}
