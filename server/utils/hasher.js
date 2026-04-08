const crypto = require('crypto');
const fs = require('fs');

const PRIVATE_KEY = `your_private_key_here`;
const PUBLIC_KEY = `your_public_key_here`;

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

function signData(data) {
  const sign = crypto.createSign('SHA256');
  sign.update(data);
  sign.end();
  return sign.sign(PRIVATE_KEY, 'hex');
}

function verifySignature(data, signature) {
  const verify = crypto.createVerify('SHA256');
  verify.update(data);
  verify.end();
  return verify.verify(PUBLIC_KEY, signature, 'hex');
}

module.exports = {
    generateFileHash,
    generateBlockHash,
    getLastBlockHash,
    verifyDocument,
    signData,
    verifySignature
};
