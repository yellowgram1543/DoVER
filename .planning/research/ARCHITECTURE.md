# Architecture Patterns: PDF Signing

**Domain:** Document Integrity
**Researched:** 2024-05

## Recommended Architecture

The signing process is a "Detached Signature" flow. The PDF is hashed, the hash is signed, and the signature is injected back into a pre-allocated "hole" in the PDF.

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Signing Service** | Orchestrates `pdf-lib` and `signpdf`. | File Storage (GridFS), Database. |
| **KMS / Vault** | Safely stores and provides the P12/Private Key. | Signing Service. |
| **Verification Service** | Extracts signatures and validates against CAs. | Public Portal, Blockchain. |

### Data Flow

1. **Upload**: User uploads PDF.
2. **Placeholder**: `pdf-lib` adds a `/Sig` dictionary and calculates `ByteRange`.
3. **Digest**: `signpdf` hashes the PDF content (skipping the placeholder).
4. **Sign**: `signer-p12` signs the hash using the private key.
5. **Merge**: The hex signature is written into the placeholder.
6. **Store**: Signed PDF is saved to GridFS.

## Patterns to Follow

### Pattern 1: Detached Signature with `pdf-lib`
**What:** Creating a PAdES-compliant placeholder.
**When:** Every signing operation.
**Example:**
```typescript
import { PDFDocument } from 'pdf-lib';
import { addPlaceholder } from '@signpdf/placeholder-pdf-lib';

const pdfDoc = await PDFDocument.load(pdfBuffer);
const pdfWithPlaceholder = addPlaceholder({
  pdfDoc,
  reason: 'Document Certification',
  subFilter: 'ETSI.CAdES.detached', // Critical for PAdES
});
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Manual Byte-Range Manipulation
**What:** Trying to calculate PDF byte offsets using string/buffer searching manually.
**Why bad:** Very fragile; even a single extra newline or whitespace change in the PDF structure invalidates the signature.
**Instead:** Use `addPlaceholder` from `@signpdf/placeholder-pdf-lib` which handles the cross-reference table and dictionary updates correctly.

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| **Signing Latency** | Sequential signing. | Worker Threads for crypto. | Dedicated Signing Microservice + HSM. |
| **Storage** | Local DB. | GridFS / S3. | CDN-backed multi-region storage. |

## Sources
- [signpdf Architecture Guide](https://github.com/vbuch/node-signpdf#how-it-works)
- [PDF 1.7 Specification (Section 12.8)](https://www.adobe.com/content/dam/acom/en/devnet/pdf/pdfs/PDF32000_2008.pdf)
