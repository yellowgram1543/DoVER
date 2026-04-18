# Plan 1-3: Integrity Report UI

This plan implements the frontend visualization of the Merkle Proofs and Polygon Anchors.

## User Review Required
> [!NOTE]
> Uses existing Vanilla CSS/JS patterns and Material Symbols.

## Proposed Changes

### 1. Integrity Modal
- Add a "Verify Integrity" button to the Document Detail view in `public/app.js` (inside `renderSuccessUI` and document listing).
- Implement `renderIntegrityModal(documentId)`:
    - Fetches full document details.
    - Displays:
        - **Content Hash**: SHA-256 in a copyable code block.
        - **Merkle Proof**: A list of intermediate hashes forming the proof path.
        - **On-Chain Anchor**: A status badge showing "Anchored" or "Pending".
        - **Polygonscan Link**: A button that opens the Amoy Explorer if a TXID exists.

### 2. Dashboard Enhancement
- Update the document table to show a small "Chain" icon next to anchored documents.

## Verification Plan

### Manual Verification
1. Log in and navigate to the dashboard.
2. Click on a document.
3. Click the new "Verify Integrity" button.
4. Confirm the modal appears with the correct hash and Merkle data.
5. Verify the "View on Polygonscan" button opens the correct URL in a new tab.
