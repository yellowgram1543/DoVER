const Database = require('better-sqlite3');
const path = require('path');

// Open the existing database
const dbPath = path.resolve(__dirname, '..', '..', 'db.sqlite');
const db = new Database(dbPath);

console.log('Starting migration: Adding Merkle Tree columns...');

try {
    // Check existing columns
    const tableInfo = db.prepare("PRAGMA table_info(documents)").all();
    const columnNames = tableInfo.map(col => col.name);

    if (!columnNames.includes('merkle_root')) {
        console.log('Adding merkle_root column...');
        db.prepare("ALTER TABLE documents ADD COLUMN merkle_root TEXT DEFAULT NULL").run();
    } else {
        console.log('merkle_root column already exists.');
    }

    if (!columnNames.includes('merkle_proof')) {
        console.log('Adding merkle_proof column...');
        db.prepare("ALTER TABLE documents ADD COLUMN merkle_proof TEXT DEFAULT NULL").run();
    } else {
        console.log('merkle_proof column already exists.');
    }

    console.log('Migration completed successfully.');
} catch (error) {
    console.error('Migration failed:', error.message);
} finally {
    db.close();
}
