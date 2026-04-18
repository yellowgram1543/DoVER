# Codebase Structure

**Analysis Date:** 2025-05-15

## Directory Layout

```
DoVER/
├── public/             # Static frontend assets (HTML, CSS, JS)
├── server/             # Backend Express application
│   ├── db/             # Database connection and migrations
│   ├── middleware/     # Custom Express middleware (auth, apiKey)
│   ├── routes/         # API endpoint definitions
│   ├── uploads/        # (Legacy) Local file storage
│   └── utils/          # Business logic and processing workers
├── src/                # Frontend source code (Service layer)
├── tmp/                # Temporary file storage for active processing
└── uploads/            # Root-level upload directory
```

## Directory Purposes

**server/:**
- Purpose: Contains the core backend logic.
- Contains: Node.js/Express server files.
- Key files: `server/app.js` (Entry point), `server/package.json`.

**server/routes/:**
- Purpose: Modular API endpoints.
- Contains: Route handlers for upload, verification, blockchain stats, and authentication.
- Key files: `server/routes/upload.js`, `server/routes/verify.js`.

**server/utils/:**
- Purpose: Heavy-lifting logic and background workers.
- Contains: Blockchain hashing, Merkle trees, OCR, Forensic analysis, and the Queue Processor.
- Key files: `server/utils/processor.js`, `server/utils/analysis_worker.js`, `server/utils/hasher.js`.

**public/:**
- Purpose: Serves the client-side application.
- Contains: Vanilla HTML/JS/CSS files that interact with the API.
- Key files: `public/index.html`, `public/app.js`.

**tmp/:**
- Purpose: Transient storage for files during the upload-to-analysis pipeline.
- Contains: Files uploaded via `multer` before they are moved to GridFS or deleted.

## Key File Locations

**Entry Points:**
- `server/app.js`: Main server entry point. Initializes all subsystems.
- `public/index.html`: Main frontend entry point.

**Configuration:**
- `.env`: (Ignored) Environment variables for Redis, MongoDB, and Secrets.
- `server/db/db.js`: SQLite database initialization and local migrations.
- `server/db/mongodb.js`: MongoDB/Mongoose connection setup.

**Core Logic:**
- `server/utils/processor.js`: The heart of the asynchronous processing engine.
- `server/utils/hasher.js`: Core blockchain logic for document integrity.

## Naming Conventions

**Files:**
- JavaScript: `camelCase.js` (e.g., `analysis_worker.js`, `apiKey.js`)
- SQL: `snake_case.sql` (e.g., `schema.sql`)

**Directories:**
- Folders: `lowercase` (e.g., `routes`, `middleware`, `utils`).

## Where to Add New Code

**New API Endpoint:**
- Primary code: `server/routes/` (Create a new router or add to an existing one).
- Registration: Register in `server/app.js`.

**New Analysis Tool (e.g., Metadata extraction):**
- Implementation: `server/utils/` (Create a new module).
- Integration: Call it within `server/utils/processor.js` or `server/utils/analysis_worker.js`.

**New Database Table:**
- Migration: Create a new migration script in `server/db/` (e.g., `migrate_metadata.js`).
- Schema: Update `server/db/schema.sql` for fresh installs.

## Special Directories

**.code-review-graph/:**
- Purpose: Contains metadata for the MCP code-review-graph tool.
- Generated: Yes
- Committed: No

**graphify-out/:**
- Purpose: Output from code analysis tools.
- Generated: Yes
- Committed: No

---

*Structure analysis: 2025-05-15*
