# Phase 5-1-PLAN: Digital Signing Infrastructure

Establish the cryptographic foundation and certificate management for PAdES-compliant PDF signing.

## 1. Goal
Install required libraries and implement a robust engine for loading, decrypting, and validating P12/PFX digital certificates.

## 2. Success Criteria
- [ ] Dependencies (`pdf-lib`, `@signpdf/signpdf`, `@signpdf/signer-p12`, `node-forge`) installed.
- [ ] `server/utils/signature_engine.js` created with `SignatureEngine` class.
- [ ] Support for `SIGNING_P12_B64` (Base64 certificate) and `SIGNING_P12_PASSWORD` env variables.
- [ ] Unit test `tests/test_signing_infra.js` passes (verifies certificate parsing and expiry).

## 3. Tasks
1. **Dependency Setup**: Run `npm install pdf-lib @signpdf/signpdf @signpdf/signer-p12 node-forge`.
2. **Signature Engine Foundation**: Implement `loadCertificate()` to handle Base64 decoding and P12 decryption.
3. **Certificate Validation**: Add logic to check certificate validity (date, common name) using `node-forge`.
4. **Verification Script**: Create a test that uses a mock P12 to verify the loader.

## 4. Verification Plan
- **Test Command**: `node tests/test_signing_infra.js`
- **Expected Result**: "Certificate loader initialized" and "Validity check: PASSED".
