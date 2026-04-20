const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '..', '..', 'db.sqlite');
const db = new Database(dbPath);

console.log('Starting migration: Adding ai_summary to documents table...');

try {
    const columns = db.prepare("PRAGMA table_info(documents)").all().map(c => c.name);
    if (!columns.includes('ai_summary')) {
        db.prepare("ALTER TABLE documents ADD COLUMN ai_summary TEXT").run();
        console.log('✓ ai_summary column added.');
    } else {
        console.log('- ai_summary column already exists.');
    }
    console.log('Migration completed successfully.');
} catch (error) {
    console.error('Migration failed:', error.message);
} finally {
    db.close();
}
