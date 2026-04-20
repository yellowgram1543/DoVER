# Plan 3-2: Secure Audit Export Infrastructure

This plan implements the multi-page, cryptographically signed official audit report.

## User Review Required
> [!IMPORTANT]
> The PDF will be signed using the same RSA private key used for blockchain block signatures.

## Proposed Changes

### 1. Report Generator
- Create `server/utils/report.js`:
    - Implement `generateAuditReport(documentId)`:
        - Fetch document data, version history, audit logs, and AI summary.
        - Build PDF using `pdfkit`:
            - **Header**: Official Logo + Bates-style numbering.
            - **Section 1 (Identity)**: Uploader info + Department.
            - **Section 2 (Integrity)**: Merkle Proof + Polygon TXID.
            - **Section 3 (AI analysis)**: Forensic summary + Gemini risk rating.
            - **Section 4 (Timeline)**: Complete version history.
            - **Footer**: "Signed by DoVER Authority" seal + QR Code.

### 2. Export Endpoint
- Update `server/routes/chain.js`:
    - Implement `GET /document/:id/report`:
        - Restricted to `authority` role only.
        - Generates PDF and streams it directly to the browser.
        - Sets correct `Content-Disposition` for download.

## Verification Plan

### Manual Verification
1. Promote your account to 'authority'.
2. Open a document with multiple versions.
3. Access the `/report` endpoint via browser URL.
4. Verify the generated PDF contains all sections and a valid QR code on the last page.
