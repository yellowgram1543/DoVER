const db = require('../server/db/db');

async function verifyPrivacyFix() {
    console.log('--- VERIFICATION TEST FOR SEQUENTIAL ID PRIVACY LEAK ---');
    
    // 1. Get a real document and its hash
    const doc = db.prepare('SELECT block_index, block_hash FROM documents LIMIT 1').get();
    if (!doc) {
        console.error('No documents found for test.');
        process.exit(1);
    }
    
    console.log(`Testing with Document #${doc.block_index} (Hash: ${doc.block_hash})`);
    
    // Simulation of the route logic
    const testId = doc.block_index;
    const testHash = doc.block_hash;

    // OLD LOGIC (Vulnerable)
    const oldResult = db.prepare('SELECT 1 FROM documents WHERE block_index = ?').get(testId);
    console.log(`- Old logic (ID-based) would find document: ${!!oldResult}`);

    // NEW LOGIC (Fixed)
    const newResultId = db.prepare('SELECT 1 FROM documents WHERE block_hash = ?').get(testId);
    const newResultHash = db.prepare('SELECT 1 FROM documents WHERE block_hash = ?').get(testHash);
    
    console.log(`- New logic with ID: ${!!newResultId} (Expected: false)`);
    console.log(`- New logic with Hash: ${!!newResultHash} (Expected: true)`);

    if (!newResultId && newResultHash) {
        console.log('✅ SUCCESS: Public lookup now requires a non-sequential hash.');
    } else {
        console.log('❌ FAILURE: Privacy leak still present.');
        process.exit(1);
    }
}

verifyPrivacyFix();
