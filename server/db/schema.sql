CREATE TABLE IF NOT EXISTS documents (
    block_index INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    uploaded_by TEXT NOT NULL,
    uploader_email TEXT,
    department TEXT DEFAULT 'General',
    upload_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    file_hash TEXT NOT NULL,
    prev_hash TEXT NOT NULL,
    block_hash TEXT NOT NULL,
    ocr_text TEXT,
    ocr_hash TEXT,
    forensic_score TEXT,
    signature_score TEXT,
    storage_id TEXT,
    ipfs_cid TEXT,
    signature TEXT,
    signer_fingerprint TEXT,
    merkle_root TEXT,
    merkle_proof TEXT,
    parent_document_id INTEGER,
    version_number INTEGER DEFAULT 1,
    version_note TEXT,
    checkpoint_hash TEXT,
    ai_summary TEXT,
    polygon_txid TEXT,
    is_tampered BOOLEAN DEFAULT 0,
    last_checked_at DATETIME
);

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    details TEXT
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    google_id TEXT UNIQUE,
    name TEXT,
    email TEXT,
    picture TEXT,
    role TEXT DEFAULT 'citizen',
    department TEXT DEFAULT 'General',
    api_secret TEXT,
    last_login DATETIME
);

CREATE TABLE IF NOT EXISTS key_registry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issuer_id TEXT NOT NULL,
    fingerprint TEXT UNIQUE,
    public_key TEXT,
    serial_number TEXT,
    status TEXT DEFAULT 'active',
    verified_by TEXT,
    verification_method TEXT,
    issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    revoked_at DATETIME,
    FOREIGN KEY(issuer_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS key_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    business_name TEXT NOT NULL,
    business_reg_no TEXT,
    request_note TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,
    processed_by TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
