# Plan 1-2: Polygon Anchoring Service

This plan implements the automated anchoring of document batches to the Polygon Amoy testnet.

## User Review Required
> [!WARNING]
> Requires `POLYGON_PRIVATE_KEY` and `POLYGON_RPC_URL` (optional, uses default if missing) in `.env`.
> If keys are missing, anchoring will be skipped silently with a log warning.

## Proposed Changes

### 1. Polygon Utility
- Create `server/utils/polygon.js`:
    - Initialize an `ethers` provider and wallet.
    - Implement `anchorBatch(merkleRoot, metadata)`:
        - Sends a transaction to a "Null Address" or a simple "Anchor Contract" on Polygon Amoy.
        - Includes the Merkle Root and metadata (start/end block IDs) in the transaction data (hex-encoded).
        - Returns the transaction hash (TXID).

### 2. Batch Trigger Logic
- Update `server/utils/processor.js`:
    - After every 10 successful block insertions:
        - Fetch the last 10 `block_hashes`.
        - Calculate a batch Merkle Root using `merkle.js`.
        - Call `polygon.anchorBatch()`.
        - If successful, update the `polygon_txid` column for those 10 documents in `db.sqlite`.
        - Log the anchor success and TXID.

## Verification Plan

### Automated Tests
- Create `tests/test_polygon.js`:
    - Mocks the `ethers` provider.
    - Verifies that `anchorBatch` correctly encodes the root and metadata into the transaction payload.

### Manual Verification
1. Ensure `.env` has a valid Amoy testnet key with a small amount of MATIC.
2. Upload 10 documents.
3. Observe server logs for "[POLYGON] ⚓ Batch Anchored" message.
4. Verify that the `documents` table now contains a TXID for those blocks.
5. Click the TXID in the dashboard (once UI is updated) to verify it on `amoy.polygonscan.com`.
