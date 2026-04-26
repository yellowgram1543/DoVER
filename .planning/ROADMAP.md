# Project Roadmap

## Milestone 1: The Official Foundation (v1 MVP)
Establishing the core integrity and AI analysis layers for the hackathon.

### Phase 1: Security & Chain Integrity
Focus: Stabilizing RBAC and mathematical evidence.
- [x] **RBAC Enforcement**: Fully implement 'authority' vs 'user' permissions for the global registry view.
- [x] **Merkle Proof Integration**: Store and serve mathematical inclusion proofs for every document block.
- [x] **Polygon Testnet Anchor**: Implement the daily anchoring task to secure the Merkle Root on-chain.

### Phase 2: Intelligence & Advanced OCR
Focus: Scaling the AI analysis pipeline.
- [x] **Multi-Lang OCR Engine**: Configure Tesseract workers for Hindi, Kannada, and Tamil scripts.
- [x] **Gemini Summary Service**: Integrate Gemini Pro to generate natural language audit trail summaries.
- [x] **Analysis UI Polish**: Display OCR results and AI summaries in a dedicated "Insight" panel.

### Phase 3: Public Access & Export
Focus: Accessibility and legal usability.
- [x] **Mobile-First Public Portal**: Create the high-performance verification interface for citizens.
- [x] **QR Mobile Scanner**: Integrate camera-based scanning for instant on-device verification.
- [x] **Court-Ready PDF Export**: Generate the ISO-standard audit trail report with Bates numbering.

### Phase 4: Admin Console & Security Hardening
Focus: Zero-trust architecture and governance.
- [x] **Department & Identity Locks**: Permanently link users to their departments and enforce strict email-based privacy.
- [x] **Strict Lineage Validation**: Fix version history logic to prevent unrelated documents from merging.
- [x] **Authority Admin Dashboard**: Build the in-app UI for managing user roles and system-wide promotions.
- [x] **Audit Trail Hardening**: Ensure all administrative actions (promotions, role changes) are recorded on-chain.

### Phase 5: Stability & Bug Fixes
Focus: Fix critical OCR, processing, and security bugs found during audit.

#### 🔴 Critical
- [x] **OCR Worker Recovery**: Terminate and recycle hung Tesseract workers after timeout instead of reusing stuck ones. (`server/utils/ocr.js`)
- [x] **Script Routing Fix**: Handle unrecognized scripts (Arabic, Cyrillic, etc.) gracefully — warn and fallback properly instead of silent misroute. (`server/utils/ocr.js`)
- [x] **Jimp Write API Fix**: Verify `image.write()` compatibility with installed Jimp version; fix the "0 dpi" invalid resolution warning. (`server/utils/ocr.js`)

#### 🟠 Medium
- [x] **Bull Lock Duration**: Increase `lockDuration` from 60s to 180s to prevent stalled jobs during heavy OCR+AI processing. (`server/utils/queue.js`)
- [x] **Merkle Root Scoped Update**: Add WHERE clause to `UPDATE documents SET merkle_root` — only update the new row, not all rows. (`server/utils/processor.js`)
- [x] **Async Background Hashing**: Replace sync `generateFileHash` with `generateFileHashAsync` in background integrity watcher. (`server/app.js`)

#### 🟡 Low
- [x] **Middleware & Security Cleanup**: Remove duplicate `apiKey` application, restrict CORS origins, remove hardcoded session secret fallback, ensure credential files are gitignored. (`server/app.js`, `server/routes/upload.js`)

### Phase 8: Adversarial Hardening
Focus: Defend the platform against active attackers and abuse.

#### 🔴 Critical
- [ ] **Rate Limiting**: Per-IP and per-user throttling on upload/verify endpoints. (`server/app.js`, `server/routes/`)
- [ ] **Nonce / Anti-Replay**: Unique nonce per signed request; reject duplicates within TTL window. (`server/routes/verify.js`, `server/routes/upload.js`)

#### 🟠 Medium
- [ ] **HMAC Request Signing**: B2B API consumers must sign requests with their private key. (`server/middleware/`)
- [ ] **Abuse Detection**: Flag accounts with bulk failed verifications or excessive upload rates. (`server/utils/abuse.js`)
- [ ] **IP Blocklist**: Temporary lockout after repeated authentication/verification failures. (`server/middleware/`)

### Phase 9: Identity & PKI
Focus: Establish verifiable issuer identity with certificate lifecycle management.

#### 🔴 Critical
- [ ] **Key Registry Table**: Track issued keys with `issuer_id`, `public_key`, `issued_at`, `verified_by`, `revoked_at`. (`server/db/`)
- [ ] **Business Onboarding Verification**: Admin approval workflow before issuing signing keys. (`server/routes/admin.js`)

#### 🟠 Medium
- [ ] **Key Revocation Endpoint**: Revoke compromised keys and check revocation status during verification. (`server/routes/admin.js`, `server/routes/verify.js`)
- [ ] **Certificate Chain in PDFs**: Embed full certificate path in signed exports for cross-platform validation. (`server/utils/signature_engine.js`)
- [ ] **Audit Trail for PKI Events**: Log all key issuance, revocation, and override decisions on-chain. (`server/utils/processor.js`)

## Future Milestones (v2+)
- **Milestone 2**: Digital Sovereignty (PAdES Signatures, KMS).
- **Milestone 3**: Decentralized Storage (IPFS Integration).
