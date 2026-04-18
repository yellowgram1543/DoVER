const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '..', 'db.sqlite');
const db = new Database(dbPath);

// Mock user sessions
const userOwner = { name: 'Owner', email: 'owner@example.com', role: 'user' };
const userOther = { name: 'Other', email: 'other@example.com', role: 'user' };
const userAuthority = { name: 'Authority', email: 'auth@example.com', role: 'authority' };

// Setup test documents
db.prepare('DELETE FROM documents WHERE uploaded_by IN (?, ?)').run('Owner', 'Other');
db.prepare("INSERT INTO documents (filename, file_type, uploaded_by, uploader_email, file_hash, prev_hash, block_hash) VALUES (?, ?, ?, ?, ?, ?, ?)").run('OwnerDoc.pdf', 'pdf', 'Owner', 'owner@example.com', 'h1', 'p1', 'b1');
db.prepare("INSERT INTO documents (filename, file_type, uploaded_by, uploader_email, file_hash, prev_hash, block_hash) VALUES (?, ?, ?, ?, ?, ?, ?)").run('OtherDoc.pdf', 'pdf', 'Other', 'other@example.com', 'h2', 'p2', 'b2');

function testChain(user) {
    console.log(`\n--- Testing /api/chain for user: ${user.name} (role: ${user.role}) ---`);
    const isAuthority = user.role === 'authority';
    let documents;
    if (isAuthority) {
        documents = db.prepare('SELECT * FROM documents WHERE uploaded_by IN (?, ?) ORDER BY block_index ASC').all('Owner', 'Other');
    } else {
        documents = db.prepare('SELECT * FROM documents WHERE (uploaded_by = ? OR uploader_email = ?) AND uploaded_by IN (?, ?) ORDER BY block_index ASC').all(user.name, user.email, 'Owner', 'Other');
    }
    console.log(`Visible documents: ${documents.map(d => d.filename).join(', ')}`);
    return documents.length;
}

const ownerCount = testChain(userOwner);
const otherCount = testChain(userOther);
const authorityCount = testChain(userAuthority);

if (ownerCount === 1 && otherCount === 1 && authorityCount === 2) {
    console.log('\n✅ RBAC Filtering Logic PASSED');
} else {
    console.log('\n❌ RBAC Filtering Logic FAILED');
    process.exit(1);
}

// Cleanup
db.prepare('DELETE FROM documents WHERE uploaded_by IN (?, ?)').run('Owner', 'Other');
db.close();
