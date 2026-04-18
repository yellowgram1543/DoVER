# Blockchain Anchoring: Polygon Amoy Testnet Patterns

This document details the implementation patterns for anchoring document hashes to the Polygon Amoy Testnet, focusing on cost efficiency through Merkle Root batching.

## 1. Network Configuration (Amoy)

Polygon Amoy is the current primary testnet for Polygon PoS (replacing Mumbai).

-   **Network Name:** Polygon Amoy Testnet
-   **Chain ID:** `80002`
-   **RPC URL:** `https://rpc-amoy.polygon.technology`
-   **Currency:** `POL`
-   **Block Explorer:** `https://amoy.polygonscan.com/`
-   **Gas Station API:** `https://gasstation.polygon.technology/amoy`

## 2. Batching Strategy: Daily Merkle Root

To minimize gas costs, DoVER uses an off-chain batching pattern.

### The Merkle Tree Pattern
Instead of storing $N$ hashes on-chain, we store 1 Merkle Root.
-   **Scalability:** 1 million hashes can be verified with a proof of only ~20 hashes ( $\log_2(1,000,000) \approx 20$ ).
-   **Cost:** Reduces on-chain costs by 99.9% compared to individual anchoring.

### Daily Flow
1.  **Collection:** Incoming document hashes are stored in a database (e.g., `hashes` table with `status = 'pending'`).
2.  **Aggregation:** A cron job runs every 24 hours (e.g., midnight UTC).
3.  **Construction:** 
    -   Fetch all `pending` hashes.
    -   Sort them lexicographically (to ensure deterministic tree generation).
    -   Build tree using `merkletreejs`.
4.  **Anchoring:**
    -   The `root` is sent to a smart contract function `anchor(bytes32 root)`.
    -   The transaction ID is recorded.
5.  **Finalization:** All hashes in the batch are marked as `anchored` and linked to the `root` and `transaction_id`.

## 3. Recommended Node.js Libraries

### Core Interaction
-   **ethers.js (v6):** Industry standard for sending transactions and interacting with Amoy.
    ```javascript
    const provider = new ethers.JsonRpcProvider("https://rpc-amoy.polygon.technology");
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const contract = new ethers.Contract(ADDRESS, ABI, wallet);
    ```

### Cryptography
-   **merkletreejs:** Best-in-class for building trees and generating proofs.
    ```javascript
    const { MerkleTree } = require('merkletreejs');
    const keccak256 = require('keccak256');

    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const root = tree.getHexRoot();
    ```
-   **keccak256:** Native hashing algorithm for Ethereum/Polygon. Essential for on-chain verification compatibility.

## 4. On-Chain Verification

While the primary use case is "Proof of Existence" (checked via Block Explorer), on-chain verification allows other smart contracts to verify documents.

### Simple Anchor Contract
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract DoVERAnchor {
    mapping(bytes32 => uint256) public anchors; // root => timestamp

    event Anchored(bytes32 indexed root, uint256 timestamp);

    function anchorRoot(bytes32 _root) public {
        require(anchors[_root] == 0, "Root already anchored");
        anchors[_root] = block.timestamp;
        emit Anchored(_root, block.timestamp);
    }

    function verify(bytes32[] calldata proof, bytes32 root, bytes32 leaf) public pure returns (bool) {
        return MerkleProof.verify(proof, root, leaf);
    }
}
```

## 5. Gas Optimization & Management

-   **Testnet POL:** Acquire via [Polygon Faucet](https://faucet.polygon.technology/).
-   **Batching:** Even though Amoy is cheap, batching prevents chain bloat and simplifies audit trails (one anchor per day).
-   **EIP-1559:** Amoy supports EIP-1559. Use `maxFeePerGas` and `maxPriorityFeePerGas` for reliable inclusion.

## 6. Implementation Checklist

- [ ] Select RPC Provider (Alchemy/Infura/Public).
- [ ] Create Hashing Utility (Keccak-256).
- [ ] Implement `merkletreejs` logic with `sortPairs: true`.
- [ ] Design DB Schema to store hash batches and their roots.
- [ ] Deploy `DoVERAnchor.sol` to Amoy.
- [ ] Schedule daily cron job for anchoring.
