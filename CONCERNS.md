<!-- generated-by: gsd-doc-writer -->
# Technical Concerns & Debt

This document tracks known architectural limitations, technical debt, and areas requiring improvement within the DoVER ecosystem.

## 🔐 Master Signing Key Dependency
Current document certification relies on a single "Master" P12 certificate managed at the system level (`SignatureEngine.js`).
- **The Issue**: There is no support for per-business or per-department signing keys. All certified documents appear as if issued by the system authority rather than the specific entity.
- **Impact**: Limits the multi-tenant scalability of the platform for institutional users who require their own cryptographic identity.
- **Mitigation**: Future iterations should implement a Key Management Service (KMS) or vault to manage and rotate tenant-specific certificates.

## 🗄️ Centralized SQLite Registry
The primary document registry and audit trail are currently stored in a local SQLite database (`db/db.js`).
- **The Issue**: While the system supports "anchoring" (calculating block hashes and Merkle roots), the local database remains the primary source of truth.
- **Impact**: The "decentralized" nature is currently aspirational; a loss or corruption of the central database would make historical verification impossible without external backups.
- **Mitigation**: Fully implement blockchain anchoring (e.g., Polygon/Ethereum) as the primary verification layer, where the local DB serves only as a cache for metadata.

## 🌫️ Noisy Forensic Heuristics
The forensic analysis engine (`forensics.js`) uses heuristic-based pixel and alignment analysis to detect forgeries.
- **The Issue**: These algorithms (pixel variance, jitter detection) are sensitive to scan quality, compression artifacts, and low-light photography.
- **Impact**: High potential for "false positives" (flagging original documents as tampered) on legitimate but low-quality uploads.
- **Mitigation**: Replace or augment heuristics with a trained Deep Learning model specialized in Error Level Analysis (ELA) and GAN-generated patch detection.

## 🧪 OCR Confidence Variance
The multi-lingual OCR pipeline routes documents based on automated script detection (OSD).
- **The Issue**: OSD sometimes misidentifies scripts on documents with mixed languages or poor contrast, leading to routing to the wrong specialized worker (e.g., Hindi routed to English).
- **Impact**: Reduced accuracy in text extraction and similarity scoring during verification.
- **Mitigation**: Implement a "multi-pass" OCR strategy where low-confidence results trigger a secondary extraction using the generic English worker or a broader language pack.

## 🚦 Lack of Rate Limiting
The API currently does not enforce strict rate limiting on `/api/upload` or `/api/verify`.
- **The Issue**: Resource-intensive operations (OCR and Forensics) can be exploited to cause Denial of Service (DoS) by saturating the worker queue.
- **Impact**: System stability risks under high load or malicious traffic.
- **Mitigation**: Integrate middleware like `express-rate-limit` and configure tiered limits based on API key priority.
