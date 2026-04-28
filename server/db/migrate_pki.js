const Database = require('better-sqlite3');
const path = require('path');

// Open the existing database
const dbPath = path.resolve(__dirname, '..', '..', 'db.sqlite');
const db = new Database(dbPath);

console.log('Starting Phase 9-1 migration: Creating key_registry table...');

const schema = `
CREATE TABLE IF NOT EXISTS key_registry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issuer_id TEXT NOT NULL,
    public_key_pem TEXT NOT NULL,
    fingerprint TEXT UNIQUE NOT NULL,
    issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    verified_by TEXT,
    verification_method TEXT,
    status TEXT DEFAULT 'pending', -- pending, active, revoked
    revoked_at DATETIME,
    revocation_reason TEXT,
    FOREIGN KEY(issuer_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS key_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    business_name TEXT NOT NULL,
    business_reg_no TEXT,
    request_note TEXT,
    status TEXT DEFAULT 'pending', -- pending, approved, rejected
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,
    processed_by TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
`;

try {
    db.exec(schema);
    console.log('✓ key_registry and key_requests tables created.');
    console.log('Migration completed successfully.');
} catch (error) {
    console.error('Migration failed:', error.message);
} finally {
    db.close();
}
