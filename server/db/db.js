const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database('db.sqlite');

const schemaPath = path.join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

db.exec(schema);

// Migration: Ensure checkpoint_hash column exists
try {
    db.prepare('ALTER TABLE documents ADD COLUMN checkpoint_hash TEXT').run();
    console.log('[DB_MIGRATE] ✓ Added checkpoint_hash column');
} catch (err) {
    if (!err.message.includes('duplicate column name')) {
        console.error('[DB_MIGRATE] ✗ Error adding checkpoint_hash column:', err.message);
    }
}

try {
    db.prepare('ALTER TABLE documents ADD COLUMN signature TEXT').run();
    console.log('[DB_MIGRATE] ✓ Added signature column');
} catch (err) {
    if (!err.message.includes('duplicate column name')) {
        console.error('[DB_MIGRATE] ✗ Error adding signature column:', err.message);
    }
}

module.exports = db;
