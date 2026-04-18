# Technology Stack: PDF Signing

**Project:** DoVER
**Researched:** 2024-05

## Recommended Stack

### Core Signing & Manipulation
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **`pdf-lib`** | ^1.17.0 | PDF Manipulation | Excellent support for adding signature fields and drawing visual overlays without corrupting the file. |
| **`@signpdf/signpdf`** | ^3.2.0 | Cryptographic Signing | Handles the complex PKCS#7/CMS detached signature creation and injection. |
| **`@signpdf/signer-p12`** | ^3.2.0 | P12 Handling | Wrapper around node-forge for loading PKCS#12 certificates. |

### LTV & Timestamping
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **`pdf-rfc3161`** | ^1.0.0 | Trusted Timestamps | Simplifies communication with RFC 3161 TSAs and embedding tokens for LTV. |

### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **`node-forge`** | ^1.3.0 | Low-level Crypto | For manual X.509 parsing or key transformations. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| PDF Signing | `@signpdf/signpdf` | `hummusjs` | `hummusjs` is deprecated/unmaintained. `muhammara` is its successor but `signpdf` has better high-level JS APIs for signing. |
| PDF Manipulation | `pdf-lib` | `pdfkit` | `pdf-lib` is better for modifying *existing* PDFs, whereas `pdfkit` is primarily for generation. |

## Installation

```bash
# Core
npm install pdf-lib @signpdf/signpdf @signpdf/signer-p12

# Optional for LTV
npm install pdf-rfc3161 node-forge
```

## Sources
- [signpdf GitHub](https://github.com/vbuch/node-signpdf)
- [pdf-lib GitHub](https://github.com/Hopding/pdf-lib)
