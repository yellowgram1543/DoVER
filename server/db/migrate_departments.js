const Database = require('better-sqlite3');
const path = require('path');

// Open the existing database
const dbPath = path.resolve(__dirname, '..', '..', 'db.sqlite');
const db = new Database(dbPath);

console.log('Starting migration: Adding department to users table...');

try {
    const tableInfo = db.prepare("PRAGMA table_info(users)").all();
    const existingColumns = tableInfo.map(col => col.name);

    if (!existingColumns.includes('department')) {
        db.prepare("ALTER TABLE users ADD COLUMN department TEXT").run();
        console.log('✓ department column added.');
    } else {
        console.log('- department column already exists.');
    }

    console.log('Migration completed successfully.');
} catch (error) {
    console.error('Migration failed:', error.message);
} finally {
    db.close();
}
