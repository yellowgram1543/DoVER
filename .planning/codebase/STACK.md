# Technology Stack

**Analysis Date:** 2025-02-14

## Languages

**Primary:**
- JavaScript (Node.js) - Core backend logic, API routes, and utility functions in `server/`

**Secondary:**
- HTML/CSS/JavaScript - Frontend static files in `public/`
- SQL - Schema and migrations in `server/db/` for SQLite

## Runtime

**Environment:**
- Node.js (v18.0.0+ recommended) - Backend execution environment

**Package Manager:**
- npm - Dependency management
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Express.js (v4.21.2) - Web application framework for API and static serving

**Testing:**
- Not detected - No testing framework found in `package.json`

**Build/Dev:**
- nodemon - Development watcher

## Key Dependencies

**Critical:**
- `better-sqlite3` (v11.8.1) - High-performance local database for metadata and audit logs
- `mongoose` (v9.4.1) - ODM for MongoDB, used primarily for session storage and GridFS access
- `bull` (v4.16.5) - Redis-based queue for asynchronous background processing
- `@tensorflow/tfjs` (v4.22.0) - AI analysis for font consistency and pixel variance checks
- `jimp` (v1.6.0) - Image manipulation for forensics and signature detection

**Infrastructure:**
- `tesseract.js` (v7.0.0) - OCR for text extraction from uploaded documents
- `passport` (v0.7.0) - Authentication middleware supporting Google OAuth 2.0
- `multer` (v1.4.5-lts.1) - Multipart form data handler for file uploads
- `qrcode` (v1.5.4) - Generation of verification QR codes

## Configuration

**Environment:**
- `dotenv` - Environment variable management via `.env` files
- Key configs required: `MONGODB_URI`, `REDIS_URL`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `PRIVATE_KEY_B64`

**Build:**
- Standard `package.json` scripts: `npm start`, `npm run dev`

## Platform Requirements

**Development:**
- Node.js environment
- Local or remote Redis instance
- Local or remote MongoDB instance

**Production:**
- Node.js server with access to persistent SQLite storage and connected MongoDB/Redis services

---

*Stack analysis: 2025-02-14*
