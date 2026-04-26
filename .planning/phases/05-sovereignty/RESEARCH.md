# Phase 5 Research: Digital Sovereignty (PAdES & LTV)

**Phase:** 5
**Subsystem:** Digital Signing
**Status:** IN_PROGRESS

## 1. Research Objectives
- Implement PAdES (PDF Advanced Electronic Signatures) compliant signing in the Node.js backend.
- Integrate Long-Term Validation (LTV) support via RFC 3161 timestamps.
- Ensure the output PDF/A-3 standards for legal admissibility.

## 2. Technical Findings

### 2.1 Standard & Compliance
- **PAdES-B-LT/LTA**: Target level for court-ready documents, requiring revocation data (OCSP/CRL) and trusted timestamps.
- **ISO 19005 (PDF/A-3)**: Allows embedding the original JSON audit trail as an attachment inside the PDF.

### 2.2 Technology Stack
- **`pdf-lib`**: For PDF manipulation and placeholder injection.
- **`@signpdf/signpdf`**: For detached PKCS#7 signatures.
- **`node-forge`**: For certificate handling (P12/PFX).
- **`pdf-rfc3161`**: For integrating Timestamp Authorities (TSA).

### 2.3 Implementation Pattern
1. **Placeholder Phase**: Use `pdf-lib` to add a signature field and reserve space (Byte Range) in the PDF buffer.
2. **Digest Phase**: Calculate the SHA-256 hash of the PDF, excluding the reserved space.
3. **Signing Phase**: Use the private key to sign the digest and create a PKCS#7 detached signature.
4. **Injection Phase**: Inject the hex-encoded signature into the PDF buffer.
5. **TSA/LTV Phase**: Query a trusted TSA and embed the timestamp token in the Document Security Store (DSS).

## 3. Implementation Risks
- **Byte-Range Accuracy**: Incorrect calculation will break the PDF structure and invalidate the signature.
- **Certificate Chain**: Ensuring the full certificate path is included for cross-platform verification (Acrobat/Preview).
- **Network Latency**: TSA and OCSP calls introduce external dependencies during the signing process.

## 4. Proposed Phase 5 Roadmap
- **5-1-PLAN**: Infrastructure & P12 Support (Setup `pdf-lib` and signer logic).
- **5-2-PLAN**: PAdES Baseline Signing (Detached signature implementation).
- **5-3-PLAN**: LTV & Audit Embedding (Timestamps and PDF/A-3 metadata).

## 5. Confidence Assessment
- **Overall Confidence**: HIGH
- **Technical Path**: WELL-DEFINED
- **Research Gap**: NONE (Prototyping needed for byte-range management).
