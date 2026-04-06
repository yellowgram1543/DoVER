const mongoose = require('mongoose');
const db = require('./server/db/db');
const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp');
require('dotenv').config();

async function hackAnything(blockIndex) {
    console.log(`--- Starting Cloud Forgery Simulation for Block #${blockIndex} ---`);
    
    // 1. Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });

    // 2. Get Metadata from SQL
    const doc = db.prepare('SELECT filename, file_type FROM documents WHERE block_index = ?').get(blockIndex);
    if (!doc) {
        console.error('Block not found in database.');
        process.exit(1);
    }
    const fileId = new mongoose.Types.ObjectId(doc.filename);
    const isImage = /png|jpg|jpeg/.test(doc.file_type);
    const isText = /text|plain/.test(doc.file_type) || doc.file_type === 'txt';

    // 3. Download from Cloud
    const tmpPath = path.resolve('./hacked_file_temp');
    const downloadStream = bucket.openDownloadStream(fileId);
    const writeStream = fs.createWriteStream(tmpPath);
    downloadStream.pipe(writeStream);

    await new Promise((resolve) => writeStream.on('finish', resolve));
    console.log(`✅ File type [${doc.file_type}] downloaded.`);

    // 4. Perform Forgery based on type
    if (isImage) {
        const image = await Jimp.read(tmpPath);
        image.scan({ x: 0, y: 0, width: 100, height: 100 }, function(x, y, idx) {
            this.bitmap.data[idx + 0] = 0; // Black box
            this.bitmap.data[idx + 1] = 0;
            this.bitmap.data[idx + 2] = 0;
        });
        await image.write(tmpPath);
        console.log('✅ Image forged (pixel modification).');
    } else if (isText) {
        let content = fs.readFileSync(tmpPath, 'utf8');
        content = "FORGED CONTENT: " + content.toUpperCase();
        fs.writeFileSync(tmpPath, content);
        console.log('✅ Text forged (content modification).');
    } else {
        // PDF/DOCX: Just append "corrupted" bytes to break the hash
        fs.appendFileSync(tmpPath, "\n--TAMPERED--");
        console.log('✅ Binary file forged (hash broken).');
    }

    // 5. Replace in Cloud
    await bucket.delete(fileId);
    const uploadStream = bucket.openUploadStreamWithId(fileId, 'hacked_document');
    fs.createReadStream(tmpPath).pipe(uploadStream);

    await new Promise((resolve) => uploadStream.on('finish', resolve));
    console.log('🔥 FORGERY UPLOADED TO CLOUD. Vault integrity compromised.');

    // Cleanup
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    await mongoose.disconnect();
    console.log('\nGo verify this ID in the browser!');
}

const index = process.argv[2];
if (!index) {
    console.log('Usage: node tamper_files_cloud.js <BlockIndex>');
} else {
    hackAnything(index);
}
