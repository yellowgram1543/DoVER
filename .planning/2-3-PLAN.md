# Plan 2-3: Intelligence UI Panel

This plan implements the high-performance "Document Intelligence" interface in the frontend.

## User Review Required
> [!NOTE]
> This creates a dual-pane detail view (Integrity vs. Intelligence) as requested.

## Proposed Changes

### 1. Document Intelligence Tab
- Update `public/app.js`:
    - Implement `renderDocumentIntelligence(documentId)`:
        - Fetches full document data including `ocr_text` and `ai_summary`.
        - Renders a multi-column layout:
            - **Left Pane**: Risk Summary (Badge, Classification, AI narrative).
            - **Right Pane**: Data extraction table (Entities, Dates, Amounts).
        - Renders a full-width collapsible "Forensic Evidence" section.
        - Renders a "Raw OCR Transcript" block with copy-to-clipboard.

### 2. Manual Refresh Trigger
- Add a "Refresh Intelligence" button to the header of the Intelligence tab.
- Wire the button to `POST /api/chain/document/:id/analyze`.
- Implement a loading state (spinner) during the refresh process.

## Verification Plan

### Manual Verification
1. Log in and open a document's detail view.
2. Click the "Intelligence" tab.
3. Verify all AI fields are displayed correctly.
4. Click "Refresh Intelligence" and confirm the UI updates with fresh data once the request completes.
