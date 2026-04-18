# Phase 1 Context: Security & Chain Integrity

## 1. Locked Implementation Decisions

### Polygon Testnet Anchoring
- **Trigger:** Volume-based threshold. Anchor a batch every **10 blocks**.
- **Data Detail:** Transaction will include the **Global Merkle Root** and **Metadata** (start_block_id, end_block_id).
- **Persistence:** The Polygon Transaction Hash (TXID) will be stored at the **Block Level** (on each document in the batch).
- **Error Handling:** Graceful degradation. If `POLYGON_PRIVATE_KEY` is missing from `.env`, the system will skip anchoring and log a warning without crashing.

### Identity & RBAC
- **Promotion Model:** Manual promotion for MVP. I will provide a CLI script (`npm run promote <email>`) to toggle a user's role to `authority`.
- **Authority Powers:** Authorities gain access to the **Global Registry View** (all documents) and the **Full Audit Log**. Standard users remain isolated to their own records.
- **Future Note:** Domain-based auto-promotion (`@gov.in`) is deferred to Phase 2.

### Integrity UI (The "Integrity Report")
- **Mechanism:** A dedicated "Verify Integrity" popup/modal in the document detail view.
- **Visuals:** Must include:
    - Raw SHA-256 Content Hash.
    - Merkle Path (technical visualization of the hash chain).
    - Clickable **Polygonscan Link** for the batch anchor transaction.
- **Vibe:** Technical, authoritative, and high-transparency to impress hackathon judges.

## 2. Reusable Assets & Patterns
- **Database:** Use `better-sqlite3` prepared statements for role checks and TXID storage.
- **Hashing:** Leverage the existing `server/utils/hasher.js` and `server/utils/merkle.js`.
- **UI:** Maintain the "Modern Tech/Startup" aesthetic with tailwind-based modals.

## 3. Out of Scope for Phase 1
- **Automatic Domain Auth:** Deferred.
- **Manual Tamper Flagging:** Deferred (system currently uses automated background watcher).
- **Mainnet Anchoring:** Out of scope (Testnet only).
