# Codebase Concerns

**Analysis Date:** 2025-05-15

## Tech Debt

**Identity and API Access Conflict:**
- Issue: The `upload.js` route requires both `requireAuth` (Passport session) and `apiKey` middleware. However, the logic inside `upload.js` relies strictly on `req.user` being populated by the session to enforce identity. 
- Files: `server/routes/upload.js`, `server/app.js`
- Impact: Headless API clients (using only an API key) cannot upload documents because they lack a session, resulting in `req.user` being undefined and the request being rejected or crashing.
- Fix approach: Modify `upload.js` to handle both session-based identity and API-key-based identity (perhaps by associating API keys with specific system accounts or requiring identity headers when using an API key).

**Worker Thread Performance Overhead:**
- Issue: A new `Worker` instance is spawned for every single image analysis job in the queue. Additionally, the worker reads the same image file from disk multiple times (up to 4 times) for different analysis steps.
- Files: `server/utils/processor.js`, `server/utils/analysis_worker.js`
- Impact: High CPU and I/O overhead. Large images will cause significant delays and resource exhaustion under moderate load.
- Fix approach: Implement a Worker Pool (using `piscina` or similar) to reuse threads. Refactor `analysis_worker.js` to read the image into memory once and pass the buffer/bitmap to the individual analysis functions.

**Hardcoded Environment Values:**
- Issue: The QR code generation logic hardcodes `http://localhost:3000`.
- Files: `server/utils/processor.js`
- Impact: Public verification links via QR codes will be broken when deployed to any environment other than a local machine.
- Fix approach: Use an environment variable (e.g., `BASE_URL`) for generating public-facing URLs.

## Security Considerations

**Versioning Hijacking (Department Spooofing):**
- Issue: The authorization check for document versioning allows anyone in the same "department" to upload a new version. However, the `department` is taken directly from the untrusted `req.body.department`.
- Files: `server/routes/upload.js`
- Impact: Any authenticated user can hijack the version history of any document by simply providing the matching department name in their upload request.
- Fix approach: Retrieve the user's department from a verified source (the `users` table) rather than the request body.

**Per-User Duplicate Check Bypass:**
- Issue: Duplicate detection is scoped to the `file_hash` AND `uploaded_by`. 
- Files: `server/routes/upload.js`, `server/utils/processor.js`
- Impact: Two different users can upload the exact same document, leading to redundant entries in the blockchain-style ledger. This could be used to "re-stamp" stolen or intercepted documents to claim secondary ownership.
- Current mitigation: It ensures a single user doesn't spam the same file, but doesn't prevent cross-user duplication.
- Recommendations: Implement a global duplicate check or a specific flag to handle "shared" vs "unique" documents.

## Performance Bottlenecks

**Background Watcher I/O Load:**
- Issue: The automated integrity watcher downloads every file from GridFS to a temporary local file for verification every 30 seconds (up to 50 files per sweep).
- Files: `server/app.js`
- Impact: High disk I/O and network traffic between the app server and MongoDB.
- Cause: Verification requires a local file for the `hasher.verifyDocument` function.
- Improvement path: Optimize the watcher to perform streaming hash verification without full disk writes, or increase the interval/use a more targeted strategy for verification.

**Jimp Image Processing:**
- Problem: Jimp is a pure-JavaScript image processing library which is significantly slower than native alternatives.
- Files: `server/utils/analysis_worker.js`, `server/utils/processor.js`
- Cause: Pure JS implementation of pixel-level operations.
- Improvement path: Migrate to `sharp` for significantly faster image processing and lower memory usage.

## Fragile Areas

**Temporary File Cleanup:**
- Files: `server/utils/processor.js`, `server/routes/upload.js`
- Why fragile: Cleanup logic is scattered across middleware, route handlers, and the queue processor. In the processor, it only cleans up on success or the *last* failure attempt.
- Safe modification: Centralize temp file management or use a `tmp` library that handles automatic cleanup on process exit/scope end.
- Test coverage: Gaps in testing cleanup after failed jobs or interrupted processing.

## Test Coverage Gaps

**OAuth and Identity Enforcement:**
- What's not tested: The strict identity enforcement logic (checking `req.user.email` matches parent document) has no automated tests.
- Files: `server/routes/upload.js`, `server/routes/auth.js`
- Risk: Future changes to auth middleware or the user session model could silently break identity-based security checks.
- Priority: High

**Worker Thread Stability:**
- What's not tested: Race conditions or memory leaks in the Worker Thread implementation.
- Files: `server/utils/analysis_worker.js`
- Risk: Long-running servers may experience gradual memory exhaustion due to Jimp or TensorFlow.js usage in workers.
- Priority: Medium
