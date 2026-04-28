const Database = require('better-sqlite3');
const path = require('path');

// Open the existing database
const dbPath = path.resolve(__dirname, '..', '..', 'db.sqlite');
const db = new Database(dbPath);

console.log('Starting Phase 9-1 migration: Adding signer_fingerprint to documents...');

try {
    db.prepare("ALTER TABLE documents ADD COLUMN signer_fingerprint TEXT").run();
    console.log('✓ signer_fingerprint column added to documents table.');
} catch (error) {
    if (error.message.includes('duplicate column name')) {
        console.log('- signer_fingerprint column already exists.');
    } else {
        console.error('Migration failed:', error.message);
    }
} finally {
    db.close();
}
