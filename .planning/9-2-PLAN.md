# Phase 9-2-PLAN: Certificate Chain & Revocation Infrastructure

Embed verifiable certificate chains in signed PDFs and build production-grade revocation checking.

## 1. Goal
Ensure that every signed PDF includes the full certificate chain (business cert → DoVER intermediate → DoVER root CA) so that any verifier can validate the signer's identity offline. Add real-time revocation checking during verification.

## 2. Success Criteria
- [ ] DoVER Root CA certificate and intermediate cert are generated and stored in `certs/`.
- [ ] Business certificates are signed by the DoVER intermediate CA (not self-signed).
- [ ] `SignatureEngine.signPdf()` embeds the full 3-level certificate chain in the PDF.
- [ ] Verification checks the certificate chain: Root → Intermediate → Signer.
- [ ] Revocation list (CRL) is maintained and checked during verification.
- [ ] Adobe Acrobat shows the full trust chain when opening a signed PDF.

## 3. Tasks
1. **CA Bootstrap**: Generate DoVER Root CA and Intermediate CA certificates using `node-forge` at startup (if not present). Store in `certs/dover_root.pem` and `certs/dover_intermediate.pem`.
2. **Business Cert Signing**: Update Phase 9-1's key generation to sign business certificates with the intermediate CA instead of self-signing.
3. **Chain Embedding**: Update `server/utils/signature_engine.js` to include `[signer_cert, intermediate_cert, root_cert]` in the PKCS#7 signature.
4. **CRL Management**: Create `server/utils/crl.js` — maintains a Certificate Revocation List. Updated on every key revocation. Exposed at `GET /api/crl`.
5. **Verification Chain Check**: Update verify flow to walk the certificate chain and check CRL before accepting a signature.

## 4. Verification Plan
- **Chain Test**: Sign a PDF, open in Adobe Acrobat → confirm the trust chain shows: "[Business] → DoVER Intermediate → DoVER Root".
- **CRL Test**: Revoke a business key → re-verify a previously signed document → confirm it now shows "Signer certificate has been revoked".
- **Offline Test**: Export the Root CA cert, import into Acrobat's trusted store → confirm documents signed by any DoVER business show as "trusted".
