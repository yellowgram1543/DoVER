# Phase 3 Context: Public Access & Export

## 1. Locked Implementation Decisions

### Mobile-First Public Portal (verify.html)
- **Strategy:** Enhance the existing `public/verify.html` to be the primary citizen-facing interface.
- **Data Exposure (Public):**
    - **Visibility:** Show Document ID, Filename, Uploader Name, and Department.
    - **Blockchain:** Show "Confirmed on Chain" status with a link to Polygonscan.
    - **AI/Forensics:** Show high-level summary only (e.g., "No anomalies detected").
    - **Protection:** NEVER expose raw OCR transcripts or technical forensic scores to the public view.

### Court-Ready PDF Export
- **Library:** Use `pdfkit` for high-fidelity document generation.
- **Report Content:**
    - **Lineage:** Full version history with timestamps.
    - **Proofs:** Global Merkle Root and Polygon Anchor TXID.
    - **Analysis:** AI Forensic summary and Gemini-generated risk assessment.
    - **Traceability:** Complete document-level audit log.
- **Security Protocols:**
    - **RSA Seal:** Sign the report using the server's Private Key.
    - **Self-Verifying QR:** Embed a QR code on the final page linking back to the verification portal.

## 2. Reusable Assets & Patterns
- **Backend:** Create a new route `GET /api/chain/document/:id/report` in `server/routes/chain.js`.
- **Crypto:** Reuse existing RSA key logic from `server/utils/signature.js` for report signing.
- **Styles:** Use the "Modern Tech/Startup" branding for the generated PDF (logos, typography).

## 3. Deferred / Out of Scope
- **In-Browser Scanner:** Use native camera URL handling for now. Browser-based scanner (html5-qrcode) moved to Phase 4/Roadmap.
- **Bulk Export:** Exporting multiple reports as a ZIP is deferred.
