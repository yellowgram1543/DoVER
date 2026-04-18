const path = require('path');
const { ethers } = require('ethers');

// Simple mock for ethers.js v6
// We'll override the Wallet.prototype.sendTransaction before requiring polygon.js
// but since it's already required in some places, we might need to be careful.
// Actually, in this test script, we are the first to require it if we don't require anything else.

const originalSendTransaction = ethers.Wallet.prototype.sendTransaction;

ethers.Wallet.prototype.sendTransaction = async function(tx) {
    console.log('[MOCK] Intercepted sendTransaction to:', tx.to);
    console.log('[MOCK] Data:', tx.data);
    
    // Verify it's sending to self
    if (tx.to !== this.address) {
        throw new Error(`Test failed: Expected transaction to self (${this.address}), but got ${tx.to}`);
    }

    return {
        hash: '0xmocktxid_12345',
        wait: async (conf) => {
            console.log('[MOCK] wait(1) called');
            return { hash: '0xmocktxid_12345' };
        }
    };
};

// Set dummy environment variables
process.env.POLYGON_PRIVATE_KEY = '0123456789012345678901234567890123456789012345678901234567890123';
process.env.POLYGON_RPC_URL = 'http://localhost:8545'; // dummy

const { anchorBatch } = require('../server/utils/polygon');

async function runTest() {
    console.log('--- Starting Polygon Anchoring Test ---');
    
    const merkleRoot = '0xabc123';
    const metadata = { startBlock: 1, endBlock: 10 };
    
    try {
        const txid = await anchorBatch(merkleRoot, metadata);
        
        console.log('Resulting TXID:', txid);
        
        if (txid === '0xmocktxid_12345') {
            console.log('✓ SUCCESS: anchorBatch returned the mocked TXID.');
        } else {
            console.log('✗ FAILURE: anchorBatch returned unexpected TXID:', txid);
            process.exit(1);
        }

        // Test payload decoding
        // Note: we can't easily grab the last tx from the mock without a side effect
        // but the mock already printed it.
        
    } catch (error) {
        console.error('✗ TEST CRASHED:', error);
        process.exit(1);
    }
}

runTest().then(() => {
    console.log('--- Test Completed ---');
    // Restore original if needed, but we're exiting
    process.exit(0);
});
