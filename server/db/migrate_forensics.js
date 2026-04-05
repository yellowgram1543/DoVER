const Database = require('better-sqlite3');
const path = require('path');

// Open the existing database
const dbPath = path.resolve(__dirname, '..', '..', 'db.sqlite');
const db = new Database(dbPath);

console.log('Starting migration: Adding forensic_score column...');

try {
    // Check if forensic_score column exists
    const tableInfo = db.prepare("PRAGMA table_info(documents)").all();
    const columnNames = tableInfo.map(col => col.name);

    if (!columnNames.includes('forensic_score')) {
        console.log('Adding forensic_score column...');
        db.prepare("ALTER TABLE documents ADD COLUMN forensic_score TEXT").run();
        console.log('Migration completed successfully.');
    } else {
        console.log('forensic_score column already exists.');
    }
} catch (error) {
    console.error('Migration failed:', error.message);
} finally {
    db.close();
}
