<!-- generated-by: gsd-doc-writer -->
# Coding Conventions

This document outlines the coding patterns, architectural decisions, and UX standards followed in the DoVER project.

## Modular Route Structure

The project uses a modular routing pattern to keep the Express application organized and maintainable. Each major functional area has its own route file.

- **Location:** `server/routes/`
- **Pattern:** Each module exports an Express Router which is then mounted in `server/app.js`.
- **Modules:**
  - `auth.js`: User authentication and Google OAuth.
  - `upload.js`: Document upload and initial processing.
  - `verify.js`: Core verification logic and forensic analysis.
  - `chain.js`: Blockchain-related operations and batch anchoring.
  - `stats.js`: System-wide statistics.
  - `admin.js`: Administrative controls and role-based access.

## Local Registry with better-sqlite3

For high-performance local metadata storage and document indexing, the project uses `better-sqlite3`. This serves as the authoritative local registry for document hashes and processing status.

- **Implementation:** `server/db/db.js`
- **Schema:** Managed via `server/db/schema.sql`.
- **Why:** `better-sqlite3` provides a synchronous, zero-latency API for local operations, which is ideal for the rapid indexing required during batch processing.

## Background Job Processing with Bull

Asynchronous tasks such as OCR, forensic analysis, and blockchain anchoring are handled using `Bull`, a Redis-based queue system.

- **Implementation:**
  - `server/utils/queue.js`: Queue definition and configuration.
  - `server/utils/processor.js`: Background worker logic.
- **Benefits:**
  - **Resilience:** Jobs are retried on failure.
  - **Scalability:** Multiple workers can process the queue in parallel.
  - **Monitoring:** Job status can be tracked from creation to completion.
- **Dependency:** Requires a running Redis instance (`REDIS_URL`).

## "Trust Journey" UX Pattern

The verification process follows the "Trust Journey" UX pattern, which provides transparency to the user by visualizing each step of the document audit.

- **Frontend Implementation:** `public/app.js` (within the `verify` route handler).
- **Journey Steps:**
  1. **Hash Generation:** Creating a unique digital fingerprint of the document.
  2. **AI Forensic Analysis:** Using vision models to detect tampering or texture anomalies.
  3. **Multi-Lingual OCR:** Transcribing text for content verification.
  4. **Blockchain Validation:** Checking the document's ancestry against the Polygon network.
  5. **Generative AI Audit:** Using Gemini to provide a final summary and integrity score.
- **Visuals:** Steps are presented with real-time progress indicators and success markers, turning a complex backend process into a clear, trustworthy experience for the user.

## Error Handling & Logging

- **Server-side:** Use `try/catch` blocks in all async route handlers and utility functions.
- **Prefixing:** Log messages are prefixed with the module name in brackets, e.g., `[OCR]`, `[POLYGON]`, `[IPFS]`.
- **API Responses:** Standardized JSON response format:
  ```json
  {
    "success": true,
    "data": { ... }
  }
  ```
  or
  ```json
  {
    "success": false,
    "error": "Descriptive error message"
  }
  ```
