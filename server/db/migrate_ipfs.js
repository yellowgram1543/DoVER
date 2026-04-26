const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '..', '..', 'db.sqlite');
const db = new Database(dbPath);

console.log('--- Migrating for Phase 7-1: IPFS Support ---');

try {
    const tableInfo = db.prepare("PRAGMA table_info(documents)").all();
    const hasIpfsCid = tableInfo.some(col => col.name === 'ipfs_cid');

    if (!hasIpfsCid) {
        console.log('Adding ipfs_cid column to documents table...');
        db.prepare('ALTER TABLE documents ADD COLUMN ipfs_cid TEXT').run();
        console.log('✅ Column added successfully.');
    } else {
        console.log('ℹ️ ipfs_cid column already exists.');
    }
    
    console.log('✅ Migration Complete.');
} catch (error) {
    console.error('❌ Migration Failed:', error.message);
} finally {
    db.close();
}
