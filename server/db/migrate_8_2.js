const Database = require('better-sqlite3');
const path = require('path');

// Open the existing database
const dbPath = path.resolve(__dirname, '..', '..', 'db.sqlite');
const db = new Database(dbPath);

console.log('Starting Phase 8-2 migration: Hardening Users table...');

try {
    const tableInfo = db.prepare("PRAGMA table_info(users)").all();
    const existingColumns = tableInfo.map(col => col.name);

    if (!existingColumns.includes('api_secret')) {
        db.prepare("ALTER TABLE users ADD COLUMN api_secret TEXT").run();
        console.log('✓ api_secret column added to users table.');
    }

    if (!existingColumns.includes('is_flagged')) {
        db.prepare("ALTER TABLE users ADD COLUMN is_flagged BOOLEAN DEFAULT 0").run();
        console.log('✓ is_flagged column added to users table.');
    }

    if (!existingColumns.includes('abuse_score')) {
        db.prepare("ALTER TABLE users ADD COLUMN abuse_score INTEGER DEFAULT 0").run();
        console.log('✓ abuse_score column added to users table.');
    }

    console.log('Migration completed successfully.');
} catch (error) {
    console.error('Migration failed:', error.message);
} finally {
    db.close();
}
