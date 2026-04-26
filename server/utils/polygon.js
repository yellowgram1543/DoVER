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
    // ── Simulated Fallback for Prototype Demo ──
    if (!wallet) {
        console.warn('[POLYGON] ⚠️ No private key found. Running in SIMULATED ANCHOR mode for demo.');
        const mockTxid = '0x' + require('crypto').randomBytes(32).toString('hex');
        console.log(`[POLYGON] ⚓ Simulated Anchor Success! TXID: ${mockTxid}`);
        return mockTxid;
    }

    try {
        console.log('[POLYGON] Fetching network fee data (EIP-1559)...');
        const feeData = await provider.getFeeData();

        // Create a data payload: MerkleRoot + Metadata JSON
        const payload = JSON.stringify({
            root: merkleRoot,
            ...metadata,
            timestamp: new Date().toISOString(),
            service: 'DoVER-Vault'
        });

        // Convert payload to hex
        const hexData = ethers.hexlify(ethers.toUtf8Bytes(payload));

        const tx = {
            to: wallet.address,
            data: hexData,
            value: 0,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
            maxFeePerGas: feeData.maxFeePerGas
        };

        console.log('[POLYGON] Publishing Merkle Root to live chain...');
        const response = await wallet.sendTransaction(tx);
        
        // Wait for 1 confirmation (don't block the queue too long)
        const receipt = await response.wait(1);
        console.log('[POLYGON] ⚓ Live Chain Anchor Success! TXID:', receipt.hash);

        return receipt.hash;
    } catch (error) {
        console.error('[POLYGON] ✗ Anchoring failed:', error.message);
        return null;
    }
}

module.exports = {
    anchorBatch
};
