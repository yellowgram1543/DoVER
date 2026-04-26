# Phase 5-3-PLAN: LTV & Audit Embedding

Upgrade signatures to PAdES-LT level with trusted timestamps and embed legal audit trails.

## 1. Goal
Ensure documents remain valid for decades (LTV) and comply with PDF/A-3 standards for court admissibility.

## 2. Success Criteria
- [ ] RFC 3161 Timestamp Authority (TSA) integration completed.
- [ ] PDF/A-3 metadata (XMP) and Document Security Store (DSS) added to signed documents.
- [ ] Original JSON audit trail embedded as an attachment inside the signed PDF.
- [ ] End-to-end test `tests/test_ltv_signing.js` confirms "Signature is LTV enabled".

## 3. Tasks
1. **TSA Integration**: Use `pdf-rfc3161` to request and embed a trusted timestamp token.
2. **DSS Implementation**: Add Certificate, OCSP, and CRL data to the PDF's DSS dictionary.
3. **Audit Attachment**: Use `pdf-lib` to embed the `proof.json` blob as a hidden attachment.
4. **Metadata Alignment**: Inject required PDF/A-3 XMP metadata fields.

## 4. Verification Plan
- **Test Command**: `node tests/test_ltv_signing.js`
- **Expected Result**: Generated PDF passes PDF/A validation and shows "LTV enabled" in Acrobat.
