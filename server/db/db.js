const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database('db.sqlite');

const schemaPath = path.join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

// Always attempt to execute schema for new tables
db.exec(schema);

/**
 * Migration helper to safely add columns if they don't exist
 */
function addColumn(table, column, type) {
    try {
        db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
        console.log(`[DB_MIGRATE] ✓ Added ${column} to ${table}`);
    } catch (err) {
        if (!err.message.includes('duplicate column name')) {
            console.error(`[DB_MIGRATE] ✗ Error adding ${column} to ${table}:`, err.message);
        }
    }
}

// Ensure all production columns exist for documents table
const docColumns = [
    ['uploader_email', 'TEXT'],
    ['department', 'TEXT DEFAULT "General"'],
    ['ocr_text', 'TEXT'],
    ['ocr_hash', 'TEXT'],
    ['forensic_score', 'TEXT'],
    ['signature_score', 'TEXT'],
    ['ipfs_cid', 'TEXT'],
    ['signature', 'TEXT'],
    ['signer_fingerprint', 'TEXT'],
    ['merkle_root', 'TEXT'],
    ['merkle_proof', 'TEXT'],
    ['parent_document_id', 'INTEGER'],
    ['version_number', 'INTEGER DEFAULT 1'],
    ['version_note', 'TEXT'],
    ['checkpoint_hash', 'TEXT'],
    ['ai_summary', 'TEXT'],
    ['is_tampered', 'BOOLEAN DEFAULT 0'],
    ['last_checked_at', 'DATETIME']
];

docColumns.forEach(([col, type]) => addColumn('documents', col, type));

module.exports = db;
