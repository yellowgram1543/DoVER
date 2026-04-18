# Coding Conventions

**Analysis Date:** 2025-03-24

## Naming Patterns

**Files:**
- **Server-side Logic:** Mix of `camelCase` (e.g., `apiKey.js`, `app.js`) and short descriptive names (e.g., `auth.js`, `db.js`).
- **Scripts/Utilities:** Often use `snake_case` for standalone scripts (e.g., `migrate_ocr.js`, `analysis_worker.js`, `generate_keys.js`).
- **Client-side:** `camelCase` (e.g., `app.js`).

**Functions:**
- **General:** `camelCase` is standard (e.g., `extractText`, `calculateSimilarity`, `requireAuth`).
- **Database:** `camelCase` for better-sqlite3 prepared statements where assigned to variables.

**Variables:**
- **General:** `camelCase` (e.g., `tmpFilePath`, `fileHash`, `uploadedBy`).
- **Constants:** `UPPER_CASE` for configuration and environment variables (e.g., `PORT`, `MAX_DEPTH`, `OCR_THRESHOLD`, `API_KEY`).

**Types:**
- **Database Schema:** `snake_case` for table columns (e.g., `block_index`, `file_hash`, `is_tampered`).

## Code Style

**Formatting:**
- No automated formatting tool (like Prettier) configured in `package.json`.
- Manual formatting follows standard JavaScript indentations (mostly 2 or 4 spaces).

**Linting:**
- No ESLint or other linting tools detected in project configuration.

## Import Organization

**Order:**
1. Built-in modules (`fs`, `path`, `crypto`)
2. Third-party dependencies (`express`, `multer`, `mongoose`)
3. Local modules/utilities (`../db/db`, `../utils/hasher`)

**Path Aliases:**
- Not used. Relative paths (e.g., `../utils/...`) are standard.

## Error Handling

**Patterns:**
- **API Routes:** Wrapped in `try/catch` blocks. On error, return specific HTTP status codes (400, 403, 404, 500) and a JSON response: `{ success: false, error: "Error message" }`.
- **Utility Functions:** Often use "fail-soft" patterns where an error is caught, logged with `console.error`, and a safe default value is returned (e.g., `extractText` returns `''` on failure).
- **Background Processes:** `setInterval` loops use `try/catch` to prevent process crashes, sometimes silently handling errors like "database busy".

## Logging

**Framework:** `console.log` and `console.error`.

**Patterns:**
- Request logging: `console.log("REQUEST_RECEIVED:", req.method, req.url)` in `app.js`.
- Error logging: Prefixing logs with the area of failure, e.g., `[OCR_ERROR]`, `[UPLOAD_ERROR]`, `[BG_WATCHER]`.

## Comments

**When to Comment:**
- Complexity: Used to explain complex forensic logic or blockchain-like traversal.
- JSDoc/TSDoc: High usage in `server/utils/*.js` files to define parameters and return types.

**Usage pattern:**
```javascript
/**
 * [Description]
 * @param {Type} name - description
 * @returns {Type} - description
 */
```

## Function Design

**Size:** Mixed. Route handlers can become large (100+ lines) due to inline logic. Utility functions are generally focused and concise.

**Parameters:** Standard positional parameters.

**Return Values:** Mixed. Async functions return `Promises`. Results are often objects (e.g., `{ valid: true, details: ... }`) or primitive types.

## Module Design

**Exports:** CommonJS `module.exports` is used exclusively on the server.

**Barrel Files:** Not used.

## Validation Patterns

**Standard Patterns:**
1. **Multer Middleware:** Used in `server/routes/upload.js` and `verify.js` for file metadata validation (extension, mimetype, size).
2. **Manual Identity Verification:** Routes check `req.user` (populated by Passport) for `name` and `email` before proceeding.
3. **Existence Checks:** Every ID or Hash provided in request params is checked against the database before use.
4. **Logical Integrity:** Duplicate content check via `file_hash` comparison before adding new records.
5. **Authorization:** Ownership or Department matching in `server/routes/upload.js` for document versioning.

---

*Convention analysis: 2025-03-24*
