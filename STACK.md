<!-- generated-by: gsd-doc-writer -->
# Technology Stack

**Last Updated:** 2025-05-15

## Core Backend
- **Node.js**: Primary runtime environment.
- **Express.js**: Web framework for API and static file serving.
- **SQLite (better-sqlite3)**: High-performance local relational database for document metadata and audit logs.
- **MongoDB (GridFS)**: Scalable storage for document binaries and session management.
- **Redis (Bull)**: Distributed task queue for asynchronous background processing of heavy analysis jobs.

## Analysis & AI
- **Tesseract.js**: Client-side and server-side OCR for text extraction and visual data verification.
- **TensorFlow.js**: Machine learning for font consistency and tampering detection (pixel variance).
- **Jimp**: Image processing library used for forensics and signature region extraction.
- **Gemini API (@google/generative-ai)**: Large Language Model integration for automated document summaries and semantic analysis.

## Decentralized Infrastructure
- **IPFS (Pinata)**: Decentralized, content-addressed storage for long-term document availability.
- **Polygon Testnet (ethers.js)**: Public blockchain anchoring on the Amoy testnet for immutable Merkle root proof-of-existence.

## Security & Verification
- **Passport.js**: Authentication middleware supporting Google OAuth 2.0.
- **PDF Signing (@signpdf)**: Digital signature engine for LTV (Long Term Validation) certified PDFs using P12 certificates.
- **pdf-lib**: Low-level PDF manipulation for injecting signatures and metadata.
- **qrcode**: Generation of unique verification codes for physical-to-digital document linking.

## Configuration & DevOps
- **dotenv**: Environment variable management.
- **multer**: Multipart form-data handling for file ingestion.
- **nodemon**: Development mode hot-reloading.

---
<!-- VERIFY: Gemini API model version limits -->
<!-- VERIFY: Polygon Amoy gas fees for anchoring transactions -->
