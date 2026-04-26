# Phase 7-1-PLAN: IPFS Decentralized Persistence

Migrate document storage from a local-only model to a global decentralized model.

## 1. Goal
Integrate IPFS (InterPlanetary File System) to ensure documents remain accessible even if the central server is unavailable.

## 2. Success Criteria
- [ ] IPFS Storage SDK (`@web3-storage/w3up-client` or similar) installed and configured.
- [ ] Database schema updated with `ipfs_cid` column in the `documents` table.
- [ ] The `processor` successfully uploads files to IPFS and records the CID.
- [ ] UI shows the unique "IPFS CID" in the document details/dashboard.

## 3. Tasks
1. **Infrastructure**: Install `@web3-storage/w3up-client` (or use a simplified Infura fallback for the prototype).
2. **Database Migration**: Add `ipfs_cid` (TEXT) to the `documents` table.
3. **Storage Logic**: Update `server/utils/processor.js` to trigger an IPFS upload after the local GridFS storage is complete.
4. **Integration**: Update the `Dashboard` and `Chain Explorer` tables to display the IPFS link for each document.

## 4. Verification Plan
- **Production Test**: Upload a document and verify that an IPFS CID (beginning with `bafy...`) appears in the database.
- **Access Test**: Open the CID in a public IPFS gateway (e.g., `https://ipfs.io/ipfs/<cid>`) and confirm the file loads.
