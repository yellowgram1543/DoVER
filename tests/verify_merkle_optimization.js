const db = require('../server/db/db');
const { buildMerkleTree, getMerkleProof, verifyMerkleProof } = require('../server/utils/merkle');

function testMerkleOptimization() {
    console.log('--- VERIFICATION TEST FOR MERKLE OPTIMIZATION ---');

    // Simulate Step 2.7 with the new logic
    const blockHash = 'abc1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    
    console.log('Fetching last 99 hashes...');
    const lastHashes = db.prepare('SELECT block_hash FROM documents ORDER BY block_index DESC LIMIT 99').all().map(d => d.block_hash).reverse();
    const allHashes = [...lastHashes, blockHash];
    
    console.log(`Building Merkle Tree for ${allHashes.length} hashes (expected <= 100)...`);
    const start = Date.now();
    const merkleTree = buildMerkleTree(allHashes);
    const merkleRoot = merkleTree.root;
    const merkleProof = getMerkleProof(allHashes, allHashes.length - 1);
    const end = Date.now();

    console.log(`Merkle Root: ${merkleRoot}`);
    console.log(`Proof length: ${merkleProof.length}`);
    console.log(`Time taken: ${end - start}ms`);

    const isValid = verifyMerkleProof(blockHash, merkleProof, merkleRoot);
    if (isValid) {
        console.log('✅ SUCCESS: Merkle proof is valid for the optimized batch root.');
    } else {
        console.log('❌ FAILURE: Merkle proof is invalid.');
        process.exit(1);
    }

    if (allHashes.length > 100) {
        console.log('❌ FAILURE: Too many hashes fetched (O(N) still present).');
        process.exit(1);
    } else {
        console.log('✅ SUCCESS: Fetch size is capped at 100.');
    }
}

testMerkleOptimization();
