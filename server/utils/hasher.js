const crypto = require('crypto');
const fs = require('fs');

function generateFileHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    return hash;
}

// Stream-based version for larger files or to avoid blocking (preferred in production)
async function generateFileHashAsync(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', data => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

function generateBlockHash(fileHash, prevHash, timestamp) {
    const data = fileHash + prevHash + timestamp;
    return crypto.createHash('sha256').update(data).digest('hex');
}

function getLastBlockHash(db) {
    const row = db.prepare('SELECT block_hash FROM documents ORDER BY block_index DESC LIMIT 1').get();
    return row ? row.block_hash : '0000000000000000';
}

function verifyDocument(documentId, db, manualFilePath) {
    if (!manualFilePath) throw new Error("manualFilePath required - system uses GridFS");
    
    const doc = db.prepare('SELECT * FROM documents WHERE block_index = ?').get(documentId);
    if (!doc) return { valid: false, details: 'Document not found' };

    const currentFileHash = generateFileHash(manualFilePath);
    const recomputedBlockHash = generateBlockHash(currentFileHash, doc.prev_hash, doc.upload_timestamp);

    const isValid = (currentFileHash.trim() === doc.file_hash.trim()) && (recomputedBlockHash.trim() === doc.block_hash.trim());

    return {
        valid: isValid,
        details: {
            storedFileHash: doc.file_hash,
            computedFileHash: currentFileHash,
            storedBlockHash: doc.block_hash,
            computedBlockHash: recomputedBlockHash
        }
    };
}

module.exports = {
    generateFileHash,
    generateFileHashAsync,
    generateBlockHash,
    getLastBlockHash,
    verifyDocument
};
