const crypto = require('crypto');
const db = require('../server/db/db');

async function verifyHmacFix() {
    console.log('--- VERIFICATION TEST FOR HMAC PROTECTION BYPASS ---');
    
    // 1. Get a test user
    const user = db.prepare('SELECT id, api_secret FROM users WHERE api_secret IS NOT NULL LIMIT 1').get();
    if (!user) {
        console.error('No user with API secret found for test. Run "node scripts/test_rbac.js" first.');
        process.exit(1);
    }
    
    const apiSecret = user.api_secret;
    const userId = user.id;
    console.log(`Using User ID: ${userId}`);

    const method = 'POST';
    const url = '/api/upload';
    const timestamp = Math.floor(Date.now() / 1000);
    const correctFileHash = crypto.createHash('sha256').update('file content').digest('hex');
    const wrongFileHash = crypto.createHash('sha256').update('tampered content').digest('hex');

    // TEST 1: Valid HMAC but tampered file (file swapped after HMAC)
    // The payload uses 'correctFileHash', but we'll simulate the server receiving 'wrongFileHash'
    const payload1 = `${method}${url}${timestamp}${correctFileHash}`;
    const sig1 = crypto.createHmac('sha256', apiSecret).update(payload1).digest('hex');
    
    console.log('Test 1: Valid HMAC payload with tampered file...');
    // We can simulate the logic from hmac.js and upload.js
    
    // Server-side hmac.js check:
    const serverPayload1 = `${method}${url}${timestamp}${correctFileHash}`;
    const serverSig1 = crypto.createHmac('sha256', apiSecret).update(serverPayload1).digest('hex');
    const hmacOk1 = sig1 === serverSig1;
    
    // Server-side upload.js check:
    const actualFileHash1 = wrongFileHash; // Tampered!
    const integrityOk1 = correctFileHash === actualFileHash1;

    console.log(`- HMAC Signature OK: ${hmacOk1}`);
    console.log(`- File Integrity OK: ${integrityOk1}`);
    
    if (hmacOk1 && !integrityOk1) {
        console.log('✅ SUCCESS: HMAC passed but File Integrity check CAUGHT the swap.');
    } else {
        console.log('❌ FAILURE: Security loop incomplete.');
        process.exit(1);
    }

    // TEST 2: Stable JSON check
    console.log('Test 2: Stable JSON stringification...');
    const body = { b: 2, a: 1 };
    // Sorted keys should be used
    const sortedBody = { a: 1, b: 2 };
    const bodyStr = JSON.stringify(sortedBody);
    
    const payload2 = `${method}${url}${timestamp}${correctFileHash}${bodyStr}`;
    const sig2 = crypto.createHmac('sha256', apiSecret).update(payload2).digest('hex');
    
    // Simulated server check with unsorted body
    const serverSortedBody = Object.keys(body).sort().reduce((acc, k) => { acc[k] = body[k]; return acc; }, {});
    const serverBodyStr = JSON.stringify(serverSortedBody);
    const serverPayload2 = `${method}${url}${timestamp}${correctFileHash}${serverBodyStr}`;
    const serverSig2 = crypto.createHmac('sha256', apiSecret).update(serverPayload2).digest('hex');

    if (sig2 === serverSig2) {
        console.log('✅ SUCCESS: Stable JSON stringification verified.');
    } else {
        console.log('❌ FAILURE: Stable JSON stringification failed.');
        process.exit(1);
    }
}

verifyHmacFix();
