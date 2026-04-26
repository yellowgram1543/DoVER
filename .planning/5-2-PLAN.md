# Phase 5-2-PLAN: PAdES Baseline Signing

Implement the core detached PKCS#7 digital signing process for PDF documents.

## 1. Goal
Enable the system to generate a cryptographically signed PDF with a visible signature placeholder.

## 2. Success Criteria
- [ ] `SignatureEngine.signPdf(pdfBuffer)` implemented.
- [ ] Successful injection of detached PKCS#7 signature into PDF byte-range.
- [ ] Visible signature box added to the final page of the PDF (Date, Name, Reason).
- [ ] Integration test `tests/test_pdf_signing.js` produces a PDF that opens as "Signed" in Adobe Acrobat.

## 3. Tasks
1. **Placeholder Injection**: Use `pdf-lib` to add a `/Sig` field and reserve 8192 bytes for the signature.
2. **Byte-Range Management**: Calculate correct `/ByteRange` to exclude the signature placeholder from the hash.
3. **Detached Signing**: Use `@signpdf/signpdf` to create the PKCS#7 blob from the PDF digest.
4. **Final Assembly**: Inject the hex-encoded signature and verify PDF structure.

## 4. Verification Plan
- **Test Command**: `node tests/test_pdf_signing.js`
- **Expected Result**: A signed PDF file is generated and no "PDF is corrupted" warnings appear.
