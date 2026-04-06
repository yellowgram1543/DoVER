const Database = require('better-sqlite3');
const path = require('path');

// Open the existing database
const dbPath = path.resolve(__dirname, '..', '..', 'db.sqlite');
const db = new Database(dbPath);

console.log('Starting migration: Adding storage_id column and restoring filenames...');

try {
    const tableInfo = db.prepare("PRAGMA table_info(documents)").all();
    const columnNames = tableInfo.map(col => col.name);

    if (!columnNames.includes('storage_id')) {
        console.log('Adding storage_id column...');
        db.prepare("ALTER TABLE documents ADD COLUMN storage_id TEXT").run();
        
        // Migrate existing MongoDB IDs from filename to storage_id
        // (Only for those that are 24-char hex strings)
        const docs = db.prepare('SELECT block_index, filename FROM documents').all();
        const updateStmt = db.prepare('UPDATE documents SET storage_id = ?, filename = ? WHERE block_index = ?');
        
        for (const doc of docs) {
            if (/^[0-9a-fA-F]{24}$/.test(doc.filename)) {
                // This was a MongoDB ID stored in filename column
                // We'll set it as storage_id, and for filename we'll use a placeholder or ID
                updateStmt.run(doc.filename, `cloud_file_${doc.block_index}`, doc.block_index);
            }
        }
        console.log('Migration and data transfer completed.');
    } else {
        console.log('storage_id column already exists.');
    }
} catch (error) {
    console.error('Migration failed:', error.message);
} finally {
    db.close();
}
