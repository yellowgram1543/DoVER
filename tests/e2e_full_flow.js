const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../server/db/db');
const PKIUtils = require('../server/utils/pki');
const { initProcessor } = require('../server/utils/processor');
const documentQueue = require('../server/utils/queue');
const { mongoose } = require('../server/db/mongodb');

async function runE2ETest() {
    console.log('🚀 STARTING END-TO-END SYSTEM TEST');

    const imagePath = path.resolve('C:/Users/anush/.gemini/tmp/dover/images/clipboard-1777358862396.png');
    if (!fs.existsSync(imagePath)) {
        console.error('❌ Test image not found at:', imagePath);
        return;
    }

    // 1. Bootstrap PKI and Mock User
    await PKIUtils.bootstrapCAs();
    const testSecret = 'test-e2e-secret-key-12345';
    db.prepare("INSERT OR REPLACE INTO users (id, name, email, role, api_secret) VALUES (?, ?, ?, ?, ?)").run(
        'e2e-tester', 'E2E Tester', 'e2e@dover.test', 'authority', testSecret
    );

    // 2. Prepare HMAC for Upload
    const fileBuffer = fs.readFileSync(imagePath);
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const timestamp = Math.floor(Date.now() / 1000);
    const method = 'POST';
    const url = '/api/upload';
    
    // We simulate the body as empty for this test
    const payload = `${method}${url}${timestamp}${fileHash}`;
    const signature = crypto.createHmac('sha256', testSecret).update(payload).digest('hex');

    console.log(`- File Hash: ${fileHash}`);
    console.log(`- HMAC Signature: ${signature}`);

    // 3. Manually Insert into GridFS and Queue (Simulating upload.js)
    // We need MongoDB connected
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dover');
    
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db);
    const uploadStream = bucket.openUploadStream('receipt.png');
    const storageId = uploadStream.id;
    
    fs.createReadStream(imagePath).pipe(uploadStream);
    await new Promise((resolve, reject) => {
        uploadStream.on('finish', resolve);
        uploadStream.on('error', reject);
    });

    console.log(`- GridFS Storage ID: ${storageId}`);

    // 4. Add to Job Queue
    const job = await documentQueue.add({
        storageId: storageId.toString(),
        originalname: 'receipt.png',
        mimetype: 'image/png',
        uploadedBy: 'E2E Tester',
        uploaderEmail: 'e2e@dover.test',
        department: 'Finance',
        fileHash: fileHash
    });
    console.log(`- Job Queued: #${job.id}`);

    // 5. Initialize Processor and Wait
    console.log('Initializing Background Processor...');
    initProcessor();

    console.log('Waiting for processing to complete (OCR + Forensics + Signing)...');
    
    return new Promise((resolve) => {
        const checkInterval = setInterval(async () => {
            const state = await job.getState();
            console.log(`  > Job Status: ${state} (${job._progress || 0}%)`);
            
            if (state === 'completed') {
                clearInterval(checkInterval);
                const result = job.returnvalue;
                console.log('✅ PROCESSING COMPLETE');
                console.log('  > Document ID:', result.document_id);
                console.log('  > Block Hash:', result.block_hash);
                
                // 6. Run Final Verification
                const verifyResult = db.prepare('SELECT * FROM documents WHERE block_index = ?').get(result.document_id);
                console.log('\n🔍 VERIFICATION REPORT:');
                console.log(`  - DB Integrity Status: ${verifyResult.is_tampered ? 'TAMPERED' : 'ORIGINAL'}`);
                console.log(`  - Merkle Root Present: ${!!verifyResult.merkle_root}`);
                console.log(`  - Signature Present: ${!!verifyResult.signature}`);
                console.log(`  - AI Summary Generated: ${!!verifyResult.ai_summary}`);
                
                if (verifyResult.is_tampered === 0 && verifyResult.signature) {
                    console.log('\n🏆 E2E TEST PASSED: Receipt secured and verified.');
                } else {
                    console.log('\n⚠️ E2E TEST INCOMPLETE: Check logs for forensic flags.');
                }
                
                mongoose.connection.close();
                resolve();
            } else if (state === 'failed') {
                clearInterval(checkInterval);
                console.error('❌ JOB FAILED:', job.failedReason);
                mongoose.connection.close();
                resolve();
            }
        }, 3000);
    });
}

runE2ETest().catch(err => {
    console.error('💥 TEST CRASHED:', err);
    process.exit(1);
});
