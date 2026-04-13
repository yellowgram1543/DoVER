const crypto = require('crypto');

/**
 * Concatenates and hashes two SHA-256 hex strings.
 * @param {string} left - Left node hash.
 * @param {string} right - Right node hash.
 * @returns {string} - SHA-256 hex string.
 */
function hashPair(left, right) {
    return crypto.createHash('sha256').update(left + right).digest('hex');
}

/**
 * Builds a Merkle Tree from an array of hashes.
 * Duplicates the last hash if the number of hashes is odd.
 * @param {string[]} hashes - Array of leaf hashes (e.g., block_hashes).
 * @returns {Object|null} - { root, tree } full tree structure.
 */
function buildMerkleTree(hashes) {
    if (!hashes || hashes.length === 0) return null;

    let tree = [hashes];
    let currentLevel = hashes;

    while (currentLevel.length > 1) {
        let nextLevel = [];
        for (let i = 0; i < currentLevel.length; i += 2) {
            let left = currentLevel[i];
            // If odd number, duplicate the last hash
            let right = (i + 1 < currentLevel.length) ? currentLevel[i + 1] : left;
            nextLevel.push(hashPair(left, right));
        }
        tree.push(nextLevel);
        currentLevel = nextLevel;
    }

    return {
        root: currentLevel[0],
        tree: tree
    };
}

/**
 * Generates a Merkle Proof for a leaf at a specific index.
 * @param {string[]} hashes - Original leaf hashes.
 * @param {number} index - Index of the leaf to prove.
 * @returns {Object[]} - Array of { hash, position }.
 */
function getMerkleProof(hashes, index) {
    const result = buildMerkleTree(hashes);
    if (!result) return [];

    let proof = [];
    let currentIndex = index;

    // Traverse levels from bottom to top (excluding root level)
    for (let i = 0; i < result.tree.length - 1; i++) {
        let level = result.tree[i];
        let isRight = currentIndex % 2 === 1;
        let siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;

        if (siblingIndex < level.length) {
            proof.push({
                hash: level[siblingIndex],
                position: isRight ? 'left' : 'right'
            });
        } else {
            // Case where the hash was duplicated during construction
            proof.push({
                hash: level[currentIndex],
                position: 'right'
            });
        }
        currentIndex = Math.floor(currentIndex / 2);
    }

    return proof;
}

/**
 * Verifies a Merkle Proof against a known root.
 * @param {string} leafHash - The hash of the leaf being verified.
 * @param {Object[]} proof - The proof path array.
 * @param {string} root - The expected Merkle Root.
 * @returns {boolean} - True if proof is valid.
 */
function verifyMerkleProof(leafHash, proof, root) {
    let currentHash = leafHash;

    for (const p of proof) {
        if (p.position === 'left') {
            currentHash = hashPair(p.hash, currentHash);
        } else {
            currentHash = hashPair(currentHash, p.hash);
        }
    }

    return currentHash === root;
}

module.exports = {
    hashPair,
    buildMerkleTree,
    getMerkleProof,
    verifyMerkleProof
};
