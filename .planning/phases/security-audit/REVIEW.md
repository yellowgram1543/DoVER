---
phase: security-audit
reviewed: 2026-04-28T11:35:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - server/routes/upload.js
  - server/utils/processor.js
  - server/routes/verify.js
  - server/utils/pki.js
  - server/utils/signature_engine.js
findings:
  critical: 4
  warning: 6
  info: 3
  total: 13
status: issues_found
---

# Phase security-audit: Code Review Report

**Reviewed:** 2026-04-28T11:35:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

The review identified several critical vulnerabilities and architectural flaws that impact the security, scalability, and integrity of the DoVER platform. The most severe issues involve unauthorized database mutations during verification, insecure storage of CA private keys, and a scaling bottleneck in the Merkle tree construction. While the core logic for multi-layer verification is robust, these "infrastructure" and "boundary" issues must be addressed before the platform can be considered "hardened."

## Critical Issues

### CR-01: Unauthorized Database Mutation via Public Verification

**File:** `server/routes/verify.js:345`
**Issue:** When a user performs a manual verification by uploading a file, if the file does not match the record (e.g., the user uploaded a modified file), the system updates the *original* database record to mark it as `is_tampered = 1`. This allows any authorized user (or public user if the endpoint is exposed) to invalidate any document in the system by simply providing a non-matching file for that document ID.
**Fix:**
```javascript
// Remove or conditionalize the update
// Only mark as tampered if an INTERNAL integrity check fails, 
// not because an external user provided a non-matching file.
if (isTampered) {
    // Record the event, but DON'T mark the database record as tampered
    // unless the check was performed against the source of truth (GridFS/IPFS).
    // db.prepare('UPDATE documents SET is_tampered = 1 WHERE block_index = ?').run(doc.block_index); // REMOVE THIS
    
    if (req.user) recordSignal(req.user.id, 'FAILED_VERIFICATION_ATTEMPT');
}
```

### CR-02: Merkle Tree Construction Complexity O(N)

**File:** `server/utils/processor.js:81-84`
**Issue:** For every document upload, the processor fetches *every* block hash from the database and rebuilds the entire Merkle Tree from scratch to calculate the new root. As the database grows to thousands or millions of documents, this operation will become exponentially slower, leading to worker timeouts and eventual system collapse.
**Fix:**
Implement an incremental Merkle Tree or use a Merkle Mountain Range (MMR). At a minimum, cache the previous state or use a hierarchical structure where only the affected branch is recalculated.

### CR-03: Insecure CA Private Key Storage

**File:** `server/utils/pki.js:53`
**Issue:** The Root CA and Intermediate CA private keys are stored on the local filesystem in PEM format within the application's `certs/` directory. If the application server is compromised, the entire trust hierarchy is compromised, allowing an attacker to issue fraudulent certificates and sign fake documents.
**Fix:**
Use a Hardware Security Module (HSM) or a secure KMS (like AWS KMS or HashiCorp Vault) to store and use CA keys. At the very least, encrypt the private keys at rest with a passphrase not stored in the codebase.

### CR-04: Non-Scalable Job Processing (Local File Paths)

**File:** `server/utils/processor.js:60`
**Issue:** The `documentQueue` stores the absolute `filePath` in the job data. This assumes that the worker processing the job has access to the same local filesystem as the web server. This prevents horizontal scaling (adding more worker nodes) as `tmp/` files are not shared across server instances.
**Fix:**
Upload the raw file to a shared temporary storage (e.g., S3 or a shared GridFS bucket) immediately upon receipt, and pass the storage ID to the worker instead of a local path.

## Warnings

### WR-01: Weak PKCS#12 Encryption

**File:** `server/utils/pki.js:126`
**Issue:** Business certificates are exported using `3des` encryption. 3DES is considered legacy and weak compared to modern standards.
**Fix:**
```javascript
const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
    keys.privateKey, [cert, interCert, rootCert], password, 
    { algorithm: 'aes256' } // Use AES-256 instead of 3des
);
```

### WR-02: Flawed Forensic Comparison Logic

**File:** `server/routes/verify.js:295`
**Issue:** `suspicious_change` only detects if the `suspicious` flag *flipped* between the original and current version. If both versions are suspicious, `suspicious_change` will be `false`, potentially misleading the user into thinking no anomalies were found.
**Fix:**
```javascript
forensic_comparison = {
    is_currently_suspicious: currentForensic.suspicious,
    status_changed: (currentForensic.suspicious !== storedForensic.suspicious),
    // ...
};
```

### WR-03: Incomplete Merkle Proof Logic

**File:** `server/routes/verify.js:318`
**Issue:** The Merkle Root stored in each document record is the root at the time that specific document was added. Verification only proves the document existed in the chain *at that point in time*. It does not prove the document is part of the *current* global state unless checked against the latest root (e.g., the one anchored on Polygon).
**Fix:**
Verification should ideally check the proof against the latest checkpoint root or the root anchored in the most recent Polygon transaction.

### WR-04: Signing with Expired Certificates

**File:** `server/utils/signature_engine.js:60`
**Issue:** The engine logs a warning if a certificate is expired but proceeds to sign the PDF anyway. This results in a cryptographically valid but "Untrusted/Invalid" signature in PDF readers (Acrobat, etc.), which undermines the platform's credibility.
**Fix:**
Throw an error or block signing if the certificate has expired.

### WR-05: Potential Path Traversal in Business Key Loading

**File:** `server/utils/processor.js:110`
**Issue:** The path to business keys is constructed using `activeKey.fingerprint`. If a malicious admin could inject a path traversal string (e.g., `../../../etc/passwd`) into the `fingerprint` column of the `key_registry` table, it might lead to arbitrary file reads, though the `.p12` extension limits the impact.
**Fix:**
Validate that `activeKey.fingerprint` is a valid hex string (64 characters for SHA-256) before using it in file operations.

### WR-06: Department Locking Inconsistency

**File:** `server/routes/upload.js:113`
**Issue:** While a user is locked to a department (line 104), the `documentCategory` for the actual upload is taken directly from `req.body.department` (line 113). This allows a user locked to "HR" to upload a document categorized as "Finance", which might bypass some filtering or organizational logic.
**Fix:**
Force `documentCategory = userDept;` if the user is already locked to a department.

## Info

### IN-01: Singleton Race Condition during Initialization

**File:** `server/utils/signature_engine.js:134`
**Issue:** The `SignatureEngine` is a singleton. If multiple requests arrive simultaneously while the signer is not yet initialized, multiple `loadCertificate` calls will trigger.
**Fix:**
Use a promise to wrap the initialization and ensure it only runs once.

### IN-02: Non-Recursive tmp Directory Creation

**File:** `server/routes/upload.js:25`
**Issue:** `fs.mkdirSync(tmpPath)` might fail if the parent directory doesn't exist (though unlikely in this structure).
**Fix:**
Use `fs.mkdirSync(tmpPath, { recursive: true });`.

### IN-03: Custom CRL Format

**File:** `server/utils/pki.js:159`
**Issue:** The CRL is generated as a signed JSON object rather than a standard RFC 5280 DER-encoded CRL. This is fine for internal use but lacks interoperability with standard PKI tools.
**Fix:**
Consider generating standard X.509 CRLs if third-party verification is required.

---

_Reviewed: 2026-04-28T11:35:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
