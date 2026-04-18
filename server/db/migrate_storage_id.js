const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '..', '..', 'db.sqlite');
const db = new Database(dbPath);

console.log('Starting migration: Adding polygon_txid to documents table...');

try {
    const columns = db.prepare("PRAGMA table_info(documents)").all().map(c => c.name);
    if (!columns.includes('polygon_txid')) {
        db.prepare("ALTER TABLE documents ADD COLUMN polygon_txid TEXT").run();
        console.log('✓ polygon_txid column added.');
    } else {
        console.log('- polygon_txid column already exists.');
    }
    console.log('Migration completed successfully.');
} catch (error) {
    console.error('Migration failed:', error.message);
} finally {
    db.close();
}
