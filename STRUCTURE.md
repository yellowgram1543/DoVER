<!-- generated-by: gsd-doc-writer -->
# Project Structure

**Last Updated:** 2025-05-15

## Directory Map

```text
DoVER/
├── .planning/          # GSD State & Phase Management (Core Project Intel)
│   ├── phases/         # Roadmap progression and task tracking
│   ├── research/       # Deep-dives into blockchain, OCR, and PDF standards
│   └── codebase/       # Documented system snapshots
├── public/             # Dual-Mode Frontend (Citizen/B2C & Institution/B2B)
│   ├── app.js          # Main SPA logic with mode-switching
│   ├── index.html      # Landing page and primary interface
│   └── verify.html     # Dedicated external verification portal
├── server/             # Express.js Backend Application
│   ├── db/             # Data migrations and connection logic
│   ├── middleware/     # Auth (Google/API Key) and request filters
│   ├── routes/         # API endpoints (upload, verify, chain, auth)
│   └── utils/          # Core Business Logic & Heavy Processing
│       ├── processor.js     # Background job worker (Queue consumer)
│       ├── ocr.js           # Multi-engine OCR integration
│       ├── forensics.js     # Tamper detection and font analysis
│       ├── polygon.js       # Blockchain anchoring (Amoy Testnet)
│       ├── ipfs.js          # Decentralized storage (Pinata)
│       └── gemini.js        # AI-powered document summarization
├── src/                # Shared logic and utility services
├── tests/              # End-to-end and unit test suites
├── tmp/                # Transient storage for active processing pipeline
└── uploads/            # (Legacy/Reference) Physical storage root
```

## Key Directory Descriptions

### `.planning/`
The project's "brain" following the GSD methodology. It contains the current state (`STATE.md`), the `ROADMAP.md`, and phase-specific plans. The `codebase/` subfolder contains technical documentation derived from automated analysis.

### `server/utils/`
The "Engine Room" of DoVER. This directory contains all the complex logic that distinguishes it from a simple file server:
- **`processor.js`**: Orchestrates the analysis pipeline.
- **`forensics.js`**: Uses TensorFlow and Jimp to inspect image integrity.
- **`polygon.js` & `ipfs.js`**: Handle the bridge between the local system and the decentralized world.

### `public/`
A "Dual-Mode" frontend that toggles between:
- **B2C (Citizen)**: A user-centric "Personal Vault" view.
- **B2B (Institutional)**: An "Admin Overview" for issuing and auditing corporate records.
The portal is a pure SPA (Single Page Application) that communicates with the server via REST APIs.

### `server/routes/`
Defines the public API surface. Each router corresponds to a functional domain:
- **`verify.js`**: Handles the multi-layered verification check.
- **`upload.js`**: Manages the ingestion and queueing of new documents.
- **`chain.js`**: Provides real-time statistics on the local and public blockchain status.

---
*Structure map current as of May 2025*
