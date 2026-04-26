<!-- generated-by: gsd-doc-writer -->
# Core Functional Capabilities

DoVER (Decentralized Official Vault & Evidence Registry) provides a robust suite of tools for securing, verifying, and certifying documents through a blend of cryptographic anchoring, forensic analysis, and artificial intelligence.

## 🔄 Dual-Mode Interface (B2B/B2C)
The system features a dynamic toggle to switch between two distinct operational modes:
- **Citizen Mode (B2C)**: A user-centric "Personal Vault" for managing self-sovereign identity (SSI) and life records (birth certificates, degrees, property papers).
- **Institutional Mode (B2B)**: An administrative dashboard for corporate governance, allowing organizations to issue certified records, manage employee files, and perform bulk audits.

## 📜 Certified PDF Generation
DoVER can transform any uploaded document (including images) into an officially certified PDF.
- **Digital Signatures**: Uses P12/PKCS#12 certificates to apply standards-based cryptographic signatures.
- **Embedded Proof**: Every certified PDF contains a `dover_proof.json` attachment containing the full audit trail, block hash, and forensic metadata.
- **Visual Authentication**: Adds a professional signature box to the document with the issuer's common name and timestamp.

## 🤖 Gemini-Powered AI Audits
Integrated with Google Gemini to provide high-level document intelligence:
- **Automatic Summarization**: Generates concise summaries of document content.
- **Integrity Reporting**: Analyzes OCR text and forensic data to provide a human-readable verdict on document authenticity.
- **Content Context**: Identifies document types and key entities automatically during processing.

## 🔬 Forensic Texture Analysis
A multi-layered forensic engine detects sophisticated digital forgeries that bypass traditional hash checks:
- **Font Consistency**: Analyzes pixel variance across a 10x10 grid to detect if characters have been digitally altered or swapped.
- **Alignment Jitter**: Detects horizontal text lines and flags inconsistent baseline angles or rotation mismatches common in manual "copy-paste" edits.
- **Flat Noise Detection**: Identifies low-variance regions that suggest a digital "brush" or "patch" has been applied to hide original text.

## 🌍 Polyglot OCR Support
The OCR engine uses intelligent script detection to handle diverse document types:
- **Multi-Script Routing**: Automatically detects scripts (Latin, Devanagari, Kannada, Tamil, Arabic) and routes to specialized Tesseract workers.
- **Worker Pool**: Maintains persistent workers for high-performance processing.
- **Adaptive Scaling**: Intelligently scales and pre-processes images (greyscale, contrast, brightness) to maximize extraction accuracy.

## ⛓️ Immutable Audit Trail
Every action (upload, versioning, verification, certification) is recorded in a local registry and linked via a cryptographic chain.
- **Merkle Trees**: Groups documents into verifiable blocks with Merkle proofs.
- **Chain Traversal**: Verification involves traversing the ancestry of a document to ensure no historical tampering has occurred.
- **Versioning**: Supports strict document lineage, ensuring updates are authorized by the original owner or department.
