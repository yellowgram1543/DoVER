const Database = require('better-sqlite3');
const path = require('path');

// Open the existing database
const dbPath = path.resolve(__dirname, '..', '..', 'db.sqlite');
const db = new Database(dbPath);

console.log('Starting migration: Adding uploader_email to documents table...');

try {
    const tableInfo = db.prepare("PRAGMA table_info(documents)").all();
    const existingColumns = tableInfo.map(col => col.name);

    if (!existingColumns.includes('uploader_email')) {
        db.prepare("ALTER TABLE documents ADD COLUMN uploader_email TEXT").run();
        console.log('✓ uploader_email column added.');
    } else {
        console.log('- uploader_email column already exists.');
    }

    console.log('Migration completed successfully.');
} catch (error) {
    console.error('Migration failed:', error.message);
} finally {
    db.close();
}
