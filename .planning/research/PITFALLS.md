# Domain Pitfalls: PDF Signing

**Domain:** Document Integrity
**Researched:** 2024-05

## Critical Pitfalls

### Pitfall 1: Incorrect SubFilter for PAdES
**What goes wrong:** Using the Adobe default `adbe.pkcs7.detached` instead of `ETSI.CAdES.detached`.
**Why it happens:** Most tutorials use the Adobe default.
**Consequences:** The signature won't be PAdES-compliant, which is required for EU (eIDAS) and many international legal standards.
**Prevention:** Explicitly set `SubFilter` to `ETSI.CAdES.detached` in the placeholder and signature metadata.

### Pitfall 2: Byte-Range Fragmentation
**What goes wrong:** Manually editing the PDF buffer after the placeholder is created but before signing.
**Why it happens:** Attempting to add metadata or visual changes at the last second.
**Consequences:** Total signature invalidation. The hash will not match.
**Prevention:** Perform ALL document modifications (images, text, fields) *before* creating the placeholder.

## Moderate Pitfalls

### Pitfall 1: Certificate Expiry without LTV
**What goes wrong:** Signature becomes "unverifiable" or "invalid" once the signer's certificate expires.
**Prevention:** Implement LTV (PAdES-B-LT) by embedding OCSP/CRL data and a TSA timestamp.

### Pitfall 2: Incompatible PDF Versions
**What goes wrong:** Attempting to sign very old PDF versions (pre-1.5) or encrypted PDFs.
**Prevention:** Pre-process PDFs to ensure they are decrypted and updated to at least PDF 1.7 standard using `pdf-lib`.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Visible Overlays | Misaligned QR/Image | Use `pdf-lib` relative coordinate system instead of absolute pixels. |
| LTV / TSA | Network timeout on TSA call | Implement retry logic and asynchronous signing queue (Bull). |
| Bulk Signing | High CPU usage (crypto) | Offload signing to worker threads or a dedicated microservice. |

## Sources
- [Common signpdf Issues](https://github.com/vbuch/node-signpdf/issues)
- [ETSI PAdES FAQ](https://ec.europa.eu/digital-building-blocks/wikis/display/ESIG/PAdES+FAQ)
