const Database = require('better-sqlite3');
const path = require('path');

// Open the existing database
const dbPath = path.resolve(__dirname, '..', '..', 'db.sqlite');
const db = new Database(dbPath);

console.log('Starting migration: Adding OCR columns...');

try {
    // Check if ocr_text column exists
    const tableInfo = db.prepare("PRAGMA table_info(documents)").all();
    const columnNames = tableInfo.map(col => col.name);

    if (!columnNames.includes('ocr_text')) {
        console.log('Adding ocr_text column...');
        db.prepare("ALTER TABLE documents ADD COLUMN ocr_text TEXT").run();
    } else {
        console.log('ocr_text column already exists.');
    }

    if (!columnNames.includes('ocr_hash')) {
        console.log('Adding ocr_hash column...');
        db.prepare("ALTER TABLE documents ADD COLUMN ocr_hash TEXT").run();
    } else {
        console.log('ocr_hash column already exists.');
    }

    console.log('Migration completed successfully.');
} catch (error) {
    console.error('Migration failed:', error.message);
} finally {
    db.close();
}
