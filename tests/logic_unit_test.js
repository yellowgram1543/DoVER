const path = require('path');
const fs = require('fs');
const ocr = require('../server/utils/ocr');
const forensics = require('../server/utils/forensics');
const { buildMerkleTree, getMerkleProof, verifyMerkleProof } = require('../server/utils/merkle');

async function runLogicTest() {
    console.log('🧪 RUNNING COMPONENT LOGIC TEST (NON-DB)');
    
    const imagePath = path.resolve('C:/Users/anush/.gemini/tmp/dover/images/clipboard-1777358862396.png');
    if (!fs.existsSync(imagePath)) {
        console.error('❌ Test image not found.');
        return;
    }

    // 1. Test Optimized OCR Similarity (O(min(N,M)) + Caps)
    console.log('\n--- 1. OCR & Similarity Logic ---');
    const text1 = "Main Street Restaurant\n6332 Business Drive\nTotal: USD$ 29.01";
    const text2 = "Main Street Restaurant\n6332 Business Drive\nTotal: USD$ 29.00"; // Changed 1 cent
    
    const similarity = ocr.calculateSimilarity(text1, text2);
    console.log(`- Original Text: ${text1.replace(/\n/g, ' ')}`);
    console.log(`- Tampered Text: ${text2.replace(/\n/g, ' ')}`);
    console.log(`- Calculated Similarity: ${similarity.toFixed(2)}%`);
    
    if (similarity < 100 && similarity > 90) {
        console.log('✅ SUCCESS: Small change detected correctly.');
    } else {
        console.log('❌ FAILURE: Similarity logic mismatch.');
    }

    // 2. Test Smart Forensics (Digital vs Scan)
    console.log('\n--- 2. Forensic Analysis ---');
    console.log('Analyzing receipt image...');
    const forensicReport = await forensics.analyzeImage(imagePath);
    console.log('- Forensic Report:', JSON.stringify(forensicReport, null, 2));
    
    // Receipt should NOT be marked "CLEAN_DIGITAL" because it is a photo/scan
    if (forensicReport.recommendation !== 'CLEAN_DIGITAL') {
        console.log('✅ SUCCESS: Physical scan correctly identified as NOT clean digital.');
    } else {
        console.log('❌ FAILURE: False positive for digital origin.');
    }

    // 3. Test Optimized Merkle Logic
    console.log('\n--- 3. Merkle Optimization Logic ---');
    const hashes = Array.from({length: 100}, (_, i) => `hash_${i}`);
    const start = Date.now();
    const tree = buildMerkleTree(hashes);
    const proof = getMerkleProof(hashes, 99);
    const end = Date.now();
    
    console.log(`- Tree Root: ${tree.root}`);
    console.log(`- Built & Proof generated in ${end - start}ms`);
    
    const isValid = verifyMerkleProof(hashes[99], proof, tree.root);
    if (isValid) {
        console.log('✅ SUCCESS: Merkle batch logic verified.');
    } else {
        console.log('❌ FAILURE: Merkle verification failed.');
    }

    console.log('\n🏁 LOGIC TESTS COMPLETED');
}

runLogicTest();
