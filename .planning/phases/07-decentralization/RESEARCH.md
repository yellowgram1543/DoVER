# Phase 7 Research: Decentralized Resilience (IPFS & Polygon)

**Phase:** 7
**Subsystem:** Storage & Consensus
**Status:** IN_PROGRESS

## 1. Research Objectives
- Establish decentralized document persistence via IPFS.
- Implement live public anchoring of Merkle Roots to the Polygon Amoy Testnet.
- Provide users with an immutable "Proof of Existence" on a public blockchain.

## 2. Technical Findings

### 2.1 IPFS Storage Layer
- **Target**: `web3.storage` (w3up) or `Infura` IPFS API.
- **Mechanism**: Documents uploaded to DoVER will be pinned to IPFS. The system will store the **CID (Content Identifier)** in the database.
- **Benefit**: Even if the DoVER server is down, the document can be retrieved from any IPFS gateway using its unique CID.

### 2.2 Polygon Anchoring (Consensus)
- **Target**: Polygon Amoy Testnet.
- **Contract Pattern**: A simple `ProofOfExistence` contract that stores `bytes32` Merkle Roots.
- **Frequency**: For the prototype, we will implement an "Anchor Now" manual trigger and an automated daily sweep.
- **Tools**: `ethers.js` or `viem` for interacting with the RPC.

### 2.3 Verification Flow (The New Model)
1. User uploads file -> Local Merkle Tree updated.
2. Server computes Root -> Publishes to Polygon.
3. User Verifies -> DoVER fetches Root from Polygon, verifies local Merkle Proof against it.
4. **Final Verdict**: Mathematical proof anchored by $20B+ of global computing power.

## 3. Implementation Risks
- **Gas Costs**: Even on testnets, high traffic requires a faucet/wallet management.
- **IPFS Latency**: Content propagation can be slow (30s - 2m).
- **Network Reliability**: Polygon RPCs can be flaky; need fallback providers (Alchemy/Infura).

## 4. Proposed Phase 7 Roadmap
- **7-1-PLAN**: IPFS Persistence (Integrate storage SDK and CID tracking).
- **7-2-PLAN**: Blockchain Anchoring (Wallet setup, Ethers.js integration, and transaction logging).
- **7-3-PLAN**: Transparency UI (Add "Verified on Polygon" badges and Tx links to Explorer).

## 5. Confidence Assessment
- **Overall Confidence**: HIGH
- **Technical Path**: WELL-DEFINED
- **Research Gap**: None (SDKs are mature).
