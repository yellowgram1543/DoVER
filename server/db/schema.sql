CREATE TABLE IF NOT EXISTS documents (
    block_index INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    uploaded_by TEXT NOT NULL,
    upload_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    file_hash TEXT NOT NULL,
    prev_hash TEXT NOT NULL,
    block_hash TEXT NOT NULL,
    storage_id TEXT,
    checkpoint_hash TEXT,
    ai_summary TEXT,
    signature TEXT,
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
