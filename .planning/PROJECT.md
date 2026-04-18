# DoVER (Decentralized Official Vault for Electronic Records)

## Vision
Production-ready enterprise document vault targeting private/public institutions, courts, and government offices. Aims to become the foundational legal document integrity infrastructure—tamper-proof, blockchain-anchored, and AI-powered.

## Target Audience
1. **Government/Court Registrars**: Upload and certify original documents.
2. **Legal/Corporate Pros**: Manage and version institutional documents.
3. **Citizens**: Verify authenticity via a public portal without login.

## Core Pillars
- **Integrity**: Blockchain-anchored SHA-256 fingerprinting for immutability.
- **Identity**: Strict Google OAuth identity enforcement.
- **Intelligence**: AI-powered forensics (pixel variance, font consistency) and Gemini-based summaries.
- **Accessibility**: Public verification portal with QR code mobile scanning.

## Tech Stack
- **Backend**: Node.js, Express, Bull (Queue), worker_threads.
- **Database**: SQLite (metadata), MongoDB/GridFS (file storage), Redis (queue state).
- **Blockchain**: Polygon Testnet (anchoring).
- **AI/Vision**: Tesseract.js (Multi-lang), TensorFlow.js, Jimp, Gemini API.
- **Frontend**: Vanilla JS/CSS (Modern Tech/Startup aesthetic).
