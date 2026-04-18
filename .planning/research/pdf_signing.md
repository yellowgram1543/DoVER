# PDF Digital Signing Research (X.509, PAdES)

**Domain:** Document Integrity & Legal Verification
**Researched:** 2024-05
**Overall Confidence:** HIGH

## Executive Summary
PDF digital signing in Node.js is standardized around the **PAdES (PDF Advanced Electronic Signatures)** standard. The most robust implementation path involves using `@signpdf/signpdf` for cryptographic operations and `pdf-lib` for document manipulation. Achieving **LTV (Long-Term Validation)** requires additional steps like embedding OCSP/CRL responses and using a **Timestamp Authority (TSA)** via RFC 3161.

## Technology Stack Recommendation

| Library | Role | Why |
|---------|------|-----|
| **`pdf-lib`** | Manipulation | Standard for adding placeholders and visible signature overlays. |
| **`@signpdf/signpdf`** | Signing | The industry standard for detached PKCS#7 signatures in PDFs. |
| **`pdf-rfc3161`** | TSA/LTV | Specialized for adding trusted timestamps and LTV data. |
| **`node-forge`** | Crypto | Low-level X.509 and PKCS#12 (.p12) handling. |

## Standard Signing Flow

1.  **Preparation (`pdf-lib`)**:
    *   Load the PDF buffer.
    *   Inject a signature placeholder with a specific byte-range gap.
    *   Set `SubFilter` to `ETSI.CAdES.detached` for PAdES compliance.
    *   (Optional) Draw a visible signature image/QR code at the placeholder location.
2.  **Signing (`@signpdf/signpdf`)**:
    *   Load the P12/PFX certificate using a signer (e.g., `@signpdf/signer-p12`).
    *   The library calculates the message digest of the PDF (excluding the placeholder gap).
    *   Creates a PKCS#7/CMS signature using the private key.
    *   Injects the hex-encoded signature into the PDF placeholder.
3.  **LTV Enhancement (Optional)**:
    *   Query a TSA for a timestamp token.
    *   Embed the token and revocation data (OCSP) into the Document Security Store (DSS).

## PAdES Compliance Levels

*   **PAdES-B-B (Baseline)**: Includes the signature and the signer's certificate. Valid while the certificate is valid.
*   **PAdES-B-T (Timestamp)**: Adds a trusted timestamp to prove the document existed at a certain time.
*   **PAdES-B-LT (Long Term)**: Adds revocation information (CRL/OCSP) so the signature can be verified after certificate expiry.
*   **PAdES-B-LTA (Archive)**: Adds periodic timestamps for long-term (years/decades) archival.

## Key Considerations

*   **Byte Ranges**: PDFs are signed using "Detached Signatures" where the signature itself is excluded from the hash calculation. Improperly calculated byte ranges will break the signature.
*   **Visible Signatures**: The visual representation (an image of a signature) is technically separate from the cryptographic signature but usually linked via the signature field's `/AP` (Appearance) dictionary.
*   **Security**: Private keys should ideally be stored in an HSM or Cloud KMS (AWS KMS / Google Secret Manager). For local development, P12 files with environment-based passwords are used.

## Sources
- [signpdf Documentation](https://github.com/vbuch/node-signpdf)
- [PAdES Standard (ETSI EN 319 142)](https://www.etsi.org/deliver/etsi_en/319100_319199/31914201/01.01.01_60/en_31914201v010101p.pdf)
- [pdf-lib Placeholder Guide](https://github.com/vbuch/node-signpdf/tree/master/packages/placeholder-pdf-lib)
- [pdf-rfc3161 GitHub](https://github.com/SHeatS/pdf-rfc3161)
