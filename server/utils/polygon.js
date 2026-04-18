const { ethers } = require('ethers');

const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || 'https://rpc-amoy.polygon.technology';
const PRIVATE_KEY = process.env.POLYGON_PRIVATE_KEY;

let provider;
let wallet;

if (PRIVATE_KEY) {
    try {
        provider = new ethers.JsonRpcProvider(POLYGON_RPC_URL);
        wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        console.log('[POLYGON] Wallet initialized:', wallet.address);
    } catch (error) {
        console.error('[POLYGON] Initialization error:', error.message);
    }
} else {
    console.warn('[POLYGON] No POLYGON_PRIVATE_KEY found. Anchoring will be skipped.');
}

/**
 * Anchors a Merkle Root and metadata to Polygon.
 * @param {string} merkleRoot - The Merkle Root to anchor.
 * @param {Object} metadata - Metadata (e.g., startBlock, endBlock).
 * @returns {Promise<string|null>} - Transaction hash (TXID) or null.
 */
async function anchorBatch(merkleRoot, metadata) {
    if (!wallet) {
        console.warn('[POLYGON] Anchoring skipped: No wallet initialized.');
        return null;
    }

    try {
        // Create a data payload: MerkleRoot + Metadata JSON
        const payload = JSON.stringify({
            root: merkleRoot,
            ...metadata,
            timestamp: new Date().toISOString(),
            service: 'DoVER'
        });

        // Convert payload to hex
        const hexData = ethers.hexlify(ethers.toUtf8Bytes(payload));

        // Send transaction to self (as an anchor)
        const tx = {
            to: wallet.address,
            data: hexData,
            value: 0
        };

        console.log('[POLYGON] Sending anchor transaction...');
        const response = await wallet.sendTransaction(tx);
        
        // Wait for 1 confirmation
        const receipt = await response.wait(1);
        console.log('[POLYGON] ⚓ Batch Anchored! TXID:', receipt.hash);

        return receipt.hash;
    } catch (error) {
        console.error('[POLYGON] Anchoring failed:', error.message);
        return null;
    }
}

module.exports = {
    anchorBatch
};
