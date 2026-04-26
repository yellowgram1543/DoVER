# Phase 9 Research: Identity & PKI

**Phase:** 9
**Subsystem:** Trust Model & Certificate Management
**Status:** PLANNED

## 1. Research Objectives
- Move from "self-claimed identity" to "verified issuer identity."
- Implement a lightweight Certificate Authority model where DoVER issues and manages signing keys.
- Enable end-to-end certificate chain verification in signed PDFs.

## 2. Technical Findings

### 2.1 Trust Model Upgrade
- **Current State**: Each business gets a key, but nobody verifies who the business is. This is "self-claimed identity."
- **Target State**: DoVER acts as a trusted intermediary — verifying business identity before issuing a key, and providing a certificate chain that any verifier can validate.
- **Model**: 3-tier PKI hierarchy:
  ```
  DoVER Root CA (self-signed, stored offline in production)
  └── DoVER Intermediate CA (signs business certs)
      └── Business Certificate (used for document signing)
  ```

### 2.2 Key Registry Design
- **Table**: `key_registry`
  | Column | Type | Description |
  |---|---|---|
  | id | INTEGER PK | Auto-increment |
  | issuer_id | INTEGER FK | References users table |
  | public_key_pem | TEXT | PEM-encoded public key |
  | fingerprint | TEXT | SHA-256 of the public key (for lookups) |
  | issued_at | DATETIME | When the key was issued |
  | verified_by | INTEGER FK | Admin who approved |
  | verification_method | TEXT | e.g., "manual_review", "mca_registry" |
  | status | TEXT | "pending", "active", "revoked" |
  | revoked_at | DATETIME | Null if active |
  | revocation_reason | TEXT | e.g., "key_compromise", "affiliation_ended" |

### 2.3 Certificate Chain in PDFs
- **Library**: `node-forge` for certificate creation; `@signpdf/signpdf` for PKCS#7 embedding.
- **Embedding**: The PKCS#7 detached signature must include `[signer_cert, intermediate_cert, root_cert]` in the `certificates` field.
- **Acrobat Compatibility**: Users import DoVER's Root CA into Adobe's Trusted Certificates store → all DoVER-signed documents show as "trusted."

### 2.4 Revocation Strategy
- **CRL (Certificate Revocation List)**: Simplest approach. A signed list of revoked serial numbers served at `GET /api/crl`.
- **Why not OCSP?**: OCSP requires a dedicated responder service — overkill for the prototype.
- **Frequency**: CRL regenerated on every revocation event; cached for 24 hours.

## 3. Implementation Risks
- **CA Key Security**: The Root CA private key must never be exposed. For the prototype, we store it in a local file with strict permissions. For production, this moves to HSM/KMS.
- **Onboarding Friction**: Manual admin approval adds delay. Acceptable for B2B (businesses onboard once), but need clear SLA expectations.
- **Certificate Expiry**: Business certificates need expiry dates and renewal flows. For MVP, set 1-year validity.

## 4. Confidence Assessment
- **Overall Confidence**: HIGH
- **Technical Path**: WELL-DEFINED
- **Research Gap**: Certificate chain embedding needs prototyping to verify Acrobat renders the trust hierarchy correctly.
