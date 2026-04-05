const crypto = require('crypto');
const fs = require('fs');

function generateFileHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

function generateBlockHash(fileHash, prevHash, timestamp) {
    const data = fileHash + prevHash + timestamp;
    return crypto.createHash('sha256').update(data).digest('hex');
}

function getLastBlockHash(db) {
    const row = db.prepare('SELECT block_hash FROM documents ORDER BY block_index DESC LIMIT 1').get();
    return row ? row.block_hash : '0000000000000000';
}

function verifyDocument(documentId, db) {
    const doc = db.prepare('SELECT * FROM documents WHERE block_index = ?').get();
    if (!doc) return { valid: false, details: 'Document not found' };

    // Recompute file hash (requires access to the file path, assuming same filename in uploads/)
    // Note: The prompt asks to recompute from original file.
    const currentFileHash = generateFileHash(`uploads/${doc.filename}`);
    const recomputedBlockHash = generateBlockHash(currentFileHash, doc.prev_hash, doc.upload_timestamp);

    const isValid = (currentFileHash === doc.file_hash) && (recomputedBlockHash === doc.block_hash);

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
