# Plan 3-3: Export UI & Verification Logic

This plan adds the "Export" action to the UI and wires it to the secure report service.

## User Review Required
> [!NOTE]
> The Export button is only visible to users with `authority` status.

## Proposed Changes

### 1. Frontend Actions
- Update `public/app.js`:
    - Add an **"Export Official Report"** button to the Document Detail header.
    - Implement the `downloadReport(id)` helper:
        - Triggers the `GET /api/chain/document/:id/report` request.
        - Handles file download with progress indication.

### 2. Branding Integration
- Ensure all generated documents follow the "Modern Tech/Startup" CSS variables (primary, secondary, accent colors).

## Verification Plan

### Manual Verification
1. Log in as an authority.
2. Open a document detail view.
3. Click "Export Official Report".
4. Confirm the download starts and the filename is formatted correctly (e.g., `audit_report_48.pdf`).
