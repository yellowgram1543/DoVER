# Phase 7-2-PLAN: Public Chain Anchoring (Polygon)

Establish the final layer of public trust by anchoring document fingerprints to the global Polygon ledger.

## 1. Goal
Connect the DoVER platform to the live Polygon Amoy Testnet and automate the publishing of Merkle Roots for immutable verification.

## 2. Success Criteria
- [ ] Environment variables `POLYGON_PRIVATE_KEY` and `POLYGON_RPC_URL` implemented.
- [ ] `server/utils/polygon.js` hardened with gas estimation and retry logic.
- [ ] Merkle Roots successfully published as TX data on the Amoy Testnet.
- [ ] Database updated with real `polygon_txid` for every anchored batch.
- [ ] UI "Global Ledger" table includes real links to PolygonScan.

## 3. Tasks
1. **Wallet Setup**: Add instructions for the user to provide an Amoy private key with test MATIC.
2. **Anchoring Refinement**: Update `server/utils/polygon.js` to handle dynamic gas pricing (vital for Amoy).
3. **Automated Trigger**: Verify that `server/utils/processor.js` correctly triggers `anchorBatch` every 10 blocks (as already implemented in logic).
4. **Link Generation**: Update `public/app.js` to create clickable links for `polygon_txid` targeting `amoy.polygonscan.com`.

## 4. Verification Plan
- **Production Test**: Force an anchor event (upload 10 docs) and verify the TXID appears.
- **Explorer Test**: Click the TXID link and verify the Merkle Root payload is visible in the transaction data on PolygonScan.
