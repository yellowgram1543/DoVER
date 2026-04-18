# Architecture

**Analysis Date:** 2025-05-15

## Pattern Overview

**Overall:** Modular Monolith with Asynchronous Background Processing

**Key Characteristics:**
- **Blockchain-inspired Integrity**: Uses linked block hashes, Merkle roots, and digital signatures to ensure document immutability and provenance.
- **Asynchronous Processing**: Heavy image analysis and OCR are offloaded to a background queue to ensure API responsiveness.
- **Hybrid Storage**: Metadata and chain state are stored in a relational database (SQLite), while document binary data is stored in a distributed blob store (MongoDB GridFS).

## Layers

**API Layer:**
- Purpose: Handles HTTP requests, authentication, and job queuing.
- Location: `server/routes/`
- Contains: Express routers for upload, verify, chain, stats, and auth.
- Depends on: `middleware/`, `utils/queue.js`, `db/db.js`
- Used by: Frontend clients (web/mobile).

**Worker Layer:**
- Purpose: Executes long-running and CPU-intensive tasks.
- Location: `server/utils/processor.js` and `server/utils/analysis_worker.js`
- Contains: Job processing logic, OCR, Forensics, and Signature detection.
- Depends on: `utils/ocr.js`, `utils/forensics.js`, `utils/signature.js`, `db/mongodb.js`
- Used by: `server/app.js` (via `initProcessor()`).

**Data Access Layer:**
- Purpose: Manages persistence and data integrity.
- Location: `server/db/`
- Contains: SQLite connection (`db.js`), MongoDB connection (`mongodb.js`), and schema migrations.
- Depends on: `better-sqlite3`, `mongoose`
- Used by: API and Worker layers.

## Data Flow

**Document Upload Flow:**

1. **Upload**: User submits a file through `server/routes/upload.js`.
2. **Persistence**: `multer` stores the file temporarily in `tmp/`.
3. **Queueing**: Metadata and file path are pushed to the Bull queue (`server/utils/queue.js`).
4. **Processing**: The processor (`server/utils/processor.js`) picks up the job.
5. **Storage**: File is uploaded to MongoDB GridFS; local temporary file is deleted.
6. **Hashing**: System calculates file hash, block hash (chained to previous block), and updates the global Merkle Root.
7. **Analysis**: OCR (Tesseract) and heavy forensic/signature analysis (via `worker_threads`) are performed.
8. **Finalization**: Document metadata and hashes are committed to SQLite; an audit log entry is created.

**State Management:**
- **Metadata State**: Managed in `db.sqlite` using `better-sqlite3`.
- **Job State**: Managed in Redis via `bull` queue.
- **Session State**: Managed in MongoDB via `connect-mongo` and `express-session`.
- **File State**: Managed in MongoDB GridFS.

## Key Abstractions

**Document Blockchain:**
- Purpose: Represents the immutable chain of document entries.
- Examples: `server/utils/hasher.js`, `server/utils/merkle.js`
- Pattern: Chained cryptographic hashes (Block -> Previous Block).

**Queue Processor:**
- Purpose: Decouples file processing from the request-response cycle.
- Examples: `server/utils/processor.js`, `server/utils/queue.js`
- Pattern: Producer-Consumer (Bull/Redis).

## Entry Points

**Web Server:**
- Location: `server/app.js`
- Triggers: Node execution (`node server/app.js`).
- Responsibilities: Initializes Express, middleware, routes, database connections, and background workers.

**Background Watcher:**
- Location: `server/app.js` (inside `setInterval`)
- Triggers: Timer (every 30 seconds).
- Responsibilities: Performs periodic integrity sweeps of existing documents against their stored hashes.

## Error Handling

**Strategy:** Fail-safe processing with retry logic.

**Patterns:**
- **Job Retries**: Bull queue automatically retries failed processing jobs (configured in `processor.js`).
- **Cleanup**: `try...finally` blocks ensure temporary files are deleted from `tmp/` even on failure.

## Cross-Cutting Concerns

**Logging:** Standard console logging for server events and job progress.
**Validation:** `multer` file filters and manual identity checks in routes.
**Authentication:** Passport.js with session-based auth and custom API Key middleware.

---

*Architecture analysis: 2025-05-15*
