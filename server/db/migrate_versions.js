const Database = require('better-sqlite3');
const path = require('path');

// Open the existing database
const dbPath = path.resolve(__dirname, '..', '..', 'db.sqlite');
const db = new Database(dbPath);

console.log('Starting migration: Adding Document Versioning columns...');

const columns = [
    { name: 'version_number', type: 'INTEGER DEFAULT 1' },
    { name: 'parent_document_id', type: 'INTEGER DEFAULT NULL' },
    { name: 'version_note', type: 'TEXT DEFAULT NULL' }
];

try {
    const tableInfo = db.prepare("PRAGMA table_info(documents)").all();
    const existingColumns = tableInfo.map(col => col.name);

    for (const col of columns) {
        if (!existingColumns.includes(col.name)) {
            console.log(`Adding ${col.name} column...`);
            try {
                db.prepare(`ALTER TABLE documents ADD COLUMN ${col.name} ${col.type}`).run();
                console.log(`✓ ${col.name} added.`);
            } catch (err) {
                console.error(`✗ Failed to add ${col.name}:`, err.message);
            }
        } else {
            console.log(`- ${col.name} column already exists.`);
        }
    }

    console.log('Migration completed successfully.');
} catch (error) {
    console.error('Migration failed:', error.message);
} finally {
    db.close();
}
