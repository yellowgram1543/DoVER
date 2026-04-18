const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../db.sqlite'));

try {
    db.prepare('ALTER TABLE documents ADD COLUMN ai_summary TEXT').run();
    console.log('[MIGRATE] ✓ Added ai_summary column to documents table');
} catch (err) {
    if (err.message.includes('duplicate column name')) {
        console.log('[MIGRATE] ℹ ai_summary column already exists');
    } else {
        console.error('[MIGRATE] ✗ Error adding ai_summary column:', err.message);
        process.exit(1);
    }
}

process.exit(0);
