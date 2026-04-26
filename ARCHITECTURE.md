<!-- generated-by: gsd-doc-writer -->
# Architecture

**Last Updated:** 2025-05-15

## High-Level System Design
DoVER (Document Verification & Electronic Record) is a modular monolith designed for extreme document integrity and provenance. It employs a multi-layered verification strategy that combines local cryptographic hashing with decentralized anchoring and AI-driven forensic analysis.

### Multi-Layered Integrity Verification
The system ensures document validity through four distinct layers of analysis:
1.  **Hash Verification**: Local SHA-256 fingerprinting of files, chained into a block structure where each entry references the previous block hash.
2.  **OCR Integrity**: Text extraction using **Tesseract.js** to compare visual content against claimed metadata and detect discrepancies in textual data.
3.  **Forensic Analysis**: Pixel-level and metadata analysis using **TensorFlow.js** and **Jimp** to detect tampering, font inconsistencies, and unauthorized modifications.
4.  **Merkle Root Anchoring**: Batching document hashes into Merkle Trees to provide efficient proof of existence for large sets of records.

## B2B/B2C Structural Split
The application supports a dual-mode operational model:
-   **Citizen Mode (B2C)**: Focuses on Self-Sovereign Identity (SSI) and personal life records. Users can upload and secure their own documents in a "Personal Vault".
-   **Institutional Mode (B2B)**: Designed for corporate governance. Institutions can issue certified records, manage employee files, and maintain a verifiable audit trail of issued credentials.

## Decentralized Infrastructure
To ensure long-term availability and immutability beyond the local server, DoVER integrates with:
-   **Storage (IPFS)**: Documents can be optionally pinned to IPFS (via Pinata) to provide decentralized, content-addressed storage. This ensures that the record remains accessible even if the primary database is unavailable.
-   **Consensus (Polygon Testnet)**: Merkle roots of document batches are anchored to the Polygon Amoy testnet. By sending transactions with embedded data payloads, the system creates a permanent, immutable timestamp on a public blockchain, proving that a document existed in a specific state at a specific time.

## Layers

**API Layer:**
- **Purpose**: Handles HTTP requests, authentication (Google OAuth), and job queuing.
- **Location**: `server/routes/`
- **Key Modules**: `upload.js`, `verify.js`, `chain.js` (Blockchain stats).

**Worker Layer:**
- **Purpose**: Executes intensive analysis tasks (OCR, Forensics, AI) asynchronously.
- **Location**: `server/utils/`
- **Key Modules**: `processor.js` (Queue consumer), `analysis_worker.js` (Heavy lifting), `gemini.js` (AI summaries).

**Data Access Layer:**
- **Purpose**: Manages persistence across multiple storage backends.
- **Location**: `server/db/`
- **Key Modules**: `db.js` (SQLite for metadata), `mongodb.js` (GridFS for binaries).

## Data Flow
1.  **Ingestion**: Files are uploaded and temporarily stored in `tmp/`.
2.  **Queuing**: Metadata is pushed to a **Bull (Redis)** queue.
3.  **Processing**: The worker performs Hash calculation, OCR extraction, and Forensic checks.
4.  **Anchoring**: Periodically, hashes are compiled into a Merkle tree and the root is anchored to **Polygon**.
5.  **Persistence**: Final metadata is stored in **SQLite**, while the binary is moved to **MongoDB GridFS** and optionally **IPFS**.

---
<!-- VERIFY: Polygon Amoy RPC URL validity -->
<!-- VERIFY: Pinata API endpoint availability -->
