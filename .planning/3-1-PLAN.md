# Plan 3-1: Public Portal Enhancement

This plan enhances the citizen-facing verification portal with blockchain status and AI summaries.

## User Review Required
> [!NOTE]
> This strictly follows the "No technical data exposure" rule for public views.

## Proposed Changes

### 1. Backend Data Expansion
- Update `server/routes/verify.js`:
    - In `router.get('/public/verify/:hash')` and `router.get('/public/verify/qr/:document_id')`:
        - Extract `polygon_txid` from the document record.
        - Generate a `forensic_summary` string:
            - If `is_tampered` is true: "Potential anomalies detected in document structure."
            - Else: "No forensic anomalies detected. Document integrity verified."
        - Include these in the JSON response.

### 2. Frontend Visualization
- Update `public/verify.html`:
    - Add a **Blockchain Status** section:
        - If `polygon_txid` exists: Show "Confirmed on Chain" with a clickable link to Polygonscan.
        - Else: Show "Anchoring in progress...".
    - Add an **AI Insights** section:
        - Display the `forensic_summary` with a shield icon.
    - Polish the mobile layout for better readability on small screens.

## Verification Plan

### Manual Verification
1. Open `verify.html` in a mobile browser.
2. Enter the ID of an anchored document.
3. Verify the "Confirmed on Chain" link appears and works.
4. Verify the forensic summary is visible and contains no raw technical scores.
