# Project Requirements

## v1 (Hackathon MVP) - Core Pillars
Requirements focused on establishing the "Official Vault" foundation and security infrastructure.

### R1: Security & Identity
- [x] **Strict Google Identity:** Enforce verified Google OAuth sessions for all uploads (already implemented).
- [x] **Hierarchy & Lineage:** Prevent version hijacking via owner/department checks (already implemented).
- [x] **Authority Clearance:** Role-based access control (RBAC) where 'authority' users can see the global registry.

### R2: Content Integrity
- [x] **Hash-Based Deduplication:** Block identical content uploads by the same user (already implemented).
- [x] **Merkle Tree Proofs:** Each block must contain a mathematical proof linking it to the global root.
- [x] **Polygon Anchoring:** Anchor the global Merkle Root to the Polygon Amoy testnet at regular intervals.

### R3: Intelligent Analysis
- [x] **Worker-Powered Forensics:** Offload heavy image pixel analysis to background threads (already implemented).
- [x] **Multi-Lang OCR:** Tesseract-powered extraction for Hindi, Kannada, Tamil, and English.
- [x] **Gemini Summary:** AI-generated natural language explanation of document history and status.

### R4: Accessibility
- [x] **Public Portal:** Search and verify any document by ID or file hash without logging in.
- [ ] **Mobile QR Scanner:** Mobile-responsive interface for instant "Scan-to-Verify" from phone cameras.
- [ ] **Audit Export:** Export a "Court-Ready" PDF report containing the full chain of custody and forensic scores.

## v2 (Future Roadmap)
Advanced features for long-term scalability and enterprise adoption.

- **PAdES Digital Signing:** Cryptographic LTV (Long-Term Validation) signatures for PDFs.
- **Advanced Forensics:** Heatmap overlays showing exact pixel manipulation on images.
- **Search Optimization:** Advanced filters for date range, uploader, and content metadata.
- **KMS Integration:** Cloud-based key management for enterprise-level signing.
- **IPFS Storage:** Redundant storage of document hashes for permanent availability.
