const Database = require('better-sqlite3');
const path = require('path');

// Open the existing database
const dbPath = path.resolve(__dirname, '..', '..', 'db.sqlite');
const db = new Database(dbPath);

console.log('Starting migration: Adding last_checked_at column...');

try {
    // Check if last_checked_at column exists
    const tableInfo = db.prepare("PRAGMA table_info(documents)").all();
    const columnNames = tableInfo.map(col => col.name);

    if (!columnNames.includes('last_checked_at')) {
        console.log('Adding last_checked_at column...');
        db.prepare("ALTER TABLE documents ADD COLUMN last_checked_at DATETIME").run();
        console.log('Migration completed successfully.');
    } else {
        console.log('last_checked_at column already exists.');
    }
} catch (error) {
    console.error('Migration failed:', error.message);
} finally {
    db.close();
}
