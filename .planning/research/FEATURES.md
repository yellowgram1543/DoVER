# Feature Landscape: PDF Signing

**Domain:** Document Integrity
**Researched:** 2024-05

## Table Stakes

Features users expect in any "Verified" document system.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Invisible PAdES-B-B** | Validates document hasn't been tampered with. | Medium | Foundation of all signing. |
| **X.509/P12 Support** | standard format for organizational certificates. | Low | Handled by `@signpdf/signer-p12`. |
| **SHA-256 Hashing** | Industry minimum security standard. | Low | Default in `signpdf`. |

## Differentiators

Features that make DoVER stand out (Enterprise Grade).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Long-Term Validation (LTV)** | Signatures remain valid for 10+ years even if CA expires. | High | Requires DSS/OCSP integration. |
| **Visible Signature Fields** | UX feedback; visual proof on the page (Images/QR). | Medium | Requires `pdf-lib` widget manipulation. |
| **Blockchain Anchoring** | Additional layer of proof independent of PKI. | Low/Med | Already in DoVER vision; store PDF hash on Polygon. |
| **Mobile Scan Verification** | User can verify document via QR on physical printout. | Medium | Links physical to digital via QR + Public Portal. |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Adobe Proprietary Signing** | Not standard, vendor lock-in. | Use ETSI PAdES. |
| **Client-side Signing (JS)** | Security risk; exposes private keys in browser. | Sign on Server (KMS) or via browser extension with HSM access. |
| **Weak Hashes (SHA-1/MD5)** | Insecure; rejected by modern PDF readers. | Use SHA-256 or higher. |

## Feature Dependencies

```
Certificate Management → Invisible Signing → Visible Overlays → LTV
```

## MVP Recommendation

Prioritize:
1. **Invisible PAdES-B-B**: Core integrity.
2. **Visible Signature (QR Code)**: For mobile verification bridge.

Defer: **LTV**: Implement once the core signing flow is stable and TSA providers are selected.

## Sources
- [PAdES Standard](https://www.etsi.org/technologies/electronic-signatures)
- [Adobe Acrobat Digital Signature Guide](https://www.adobe.com/devnet-docs/acrobatetk/tools/DigSig/index.html)
