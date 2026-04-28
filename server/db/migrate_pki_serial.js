const Database = require('better-sqlite3');
const path = require('path');

// Open the existing database
const dbPath = path.resolve(__dirname, '..', '..', 'db.sqlite');
const db = new Database(dbPath);

console.log('Starting Phase 9-2 migration: Adding serial_number to key_registry...');

try {
    db.prepare("ALTER TABLE key_registry ADD COLUMN serial_number TEXT").run();
    console.log('✓ serial_number column added to key_registry table.');
} catch (error) {
    if (error.message.includes('duplicate column name')) {
        console.log('- serial_number column already exists.');
    } else {
        console.error('Migration failed:', error.message);
    }
} finally {
    db.close();
}
