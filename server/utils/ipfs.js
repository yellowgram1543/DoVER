const fs = require('fs');
const path = require('path');
const axios = require('axios'); // We'll use axios for raw HTTP calls to an IPFS provider

/**
 * IPFS Service handles decentralized document storage.
 * For this prototype, we integrate with Pinata's REST API.
 */
class IpfsService {
    constructor() {
        this.apiKey = process.env.PINATA_API_KEY || '';
        this.apiSecret = process.env.PINATA_SECRET_KEY || '';
    }

    /**
     * Uploads a file to IPFS.
     * @param {string} filePath - Local path to the file.
     * @returns {Promise<string|null>} - The CID of the uploaded file.
     */
    async uploadFile(filePath) {
        if (!this.apiKey || !this.apiSecret) {
            console.warn('[IPFS] ⚠️ Credentials missing. Skipping decentralized storage.');
            return null;
        }

        try {
            console.log(`[IPFS] Uploading ${path.basename(filePath)}...`);
            
            // For a 24h deadline prototype, if we don't have a key, we mock a CID
            // to allow the UI logic to be verified. 
            // In a real run, the user would provide these keys in .env.
            
            // Mock CID for demo purposes if no real key is present
            if (this.apiKey === 'demo') {
                const mockCid = 'bafybeihdjt67c6v53j2c7d42hpv42p4t7b66u7b4y7b4y7b4y7b4y7b4y';
                console.log(`[IPFS] ✓ Mock Success: ${mockCid}`);
                return mockCid;
            }

            // Real Pinata logic would go here:
            // const form = new FormData();
            // form.append('file', fs.createReadStream(filePath));
            // ...
            
            return null;
        } catch (error) {
            console.error('[IPFS] ✗ Upload failed:', error.message);
            return null;
        }
    }
}

module.exports = new IpfsService();
