# External Integrations

**Analysis Date:** 2025-02-14

## APIs & External Services

**Authentication:**
- Google OAuth 2.0 - Used for user login and profile retrieval
  - SDK/Client: `passport-google-oauth20`
  - Auth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` in `.env`

## Data Storage

**Databases:**
- MongoDB (GridFS) - Primary storage for uploaded document binary data
  - Connection: `MONGODB_URI`
  - Client: `mongoose`, `gridfs-stream`
- SQLite - Local storage for metadata, audit logs, and user records
  - Client: `better-sqlite3`
  - File: `server/db.sqlite`

**File Storage:**
- MongoDB GridFS for persistent document storage
- Local filesystem (`tmp/` directory) for temporary file processing during upload and background verification

**Caching & Queues:**
- Redis - Message broker for asynchronous document processing
  - Connection: `REDIS_URL`
  - Client: `bull`

## Authentication & Identity

**Auth Provider:**
- Google OAuth 2.0
  - Implementation: Passport.js strategy in `server/utils/passport.js`
- Custom API Key
  - Implementation: Header-based check in `server/middleware/apiKey.js`

## Monitoring & Observability

**Error Tracking:**
- None detected (Local console logging only)

**Logs:**
- Standard output logging (stdout)
- Audit log table in SQLite for document-related actions (`INSERT INTO audit_log`)

## CI/CD & Deployment

**Hosting:**
- Not specified (Application is a Node.js Express server)

**CI Pipeline:**
- None detected

## Environment Configuration

**Required env vars:**
- `MONGODB_URI`: Connection string for MongoDB
- `REDIS_URL`: Connection string for Redis
- `SESSION_SECRET`: Secret for express-session
- `GOOGLE_CLIENT_ID`: Google OAuth ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth Secret
- `PRIVATE_KEY_B64`: Base64 encoded private key for digital signatures

**Secrets location:**
- `.env` file (not committed)

## Webhooks & Callbacks

**Incoming:**
- `/auth/google/callback`: OAuth redirection endpoint

**Outgoing:**
- None detected

---

*Integration audit: 2025-02-14*
