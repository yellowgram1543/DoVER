const crypto = require('crypto');
const fs = require('fs');

function generateFileHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

function generateBlockHash(fileHash, prevHash, timestamp) {
    const data = fileHash.trim() + prevHash.trim() + timestamp;
    return crypto.createHash('sha256').update(data).digest('hex');
}

function getLastBlockHash(db) {
    const row = db.prepare('SELECT block_hash FROM documents ORDER BY block_index DESC LIMIT 1').get();
    return row ? row.block_hash : '0000000000000000';
}

function verifyDocument(documentId, db) {
    const doc = db.prepare('SELECT * FROM documents WHERE block_index = ?').get(documentId);
    if (!doc) return { valid: false, details: 'Document not found' };

    // Recompute file hash (stored filename is now absolute path)
    const currentFileHash = generateFileHash(doc.filename);
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
    generateBlockHash,
    getLastBlockHash,
    verifyDocument
};
