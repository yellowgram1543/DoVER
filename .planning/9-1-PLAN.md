# Phase 9-1-PLAN: Key Registry & Business Onboarding

Move from "self-claimed identity" to "verified issuer identity" with a managed key lifecycle.

## 1. Goal
Create a key registry that tracks all signing keys issued to businesses, with an admin-gated onboarding workflow that verifies business identity before key issuance.

## 2. Success Criteria
- [ ] `key_registry` table exists with columns: `id`, `issuer_id`, `public_key_pem`, `fingerprint`, `issued_at`, `verified_by`, `verification_method`, `status` (active/revoked), `revoked_at`, `revocation_reason`.
- [ ] Admin can approve/reject business key requests from the Admin Dashboard.
- [ ] Approved businesses receive a generated P12 keypair; public key is stored in the registry.
- [ ] Every key issuance event is logged in the audit trail with the approving admin's ID.
- [ ] Verification endpoint checks that the signing key is in the registry and has `status = 'active'`.

## 3. Tasks
1. **Database Migration**: Create `key_registry` table in SQLite with all required columns.
2. **Onboarding API**: Add `POST /api/admin/keys/request` (business submits request) and `POST /api/admin/keys/approve/:id` (admin approves).
3. **Key Generation**: On approval, generate a P12 keypair using `node-forge`, store public key in registry, and deliver the P12 file to the business securely.
4. **Verification Hook**: Update `server/routes/verify.js` to look up the signer's key fingerprint in the registry and reject if revoked or missing.
5. **Admin UI**: Add a "Key Management" tab to the Admin Dashboard showing pending requests, active keys, and revocation history.

## 4. Verification Plan
- **Happy Path**: Submit a key request as a business → admin approves → verify a document signed with the new key → confirm "Verified by [Business Name]" appears.
- **Revoked Key**: Revoke a key → attempt verification with a document signed by that key → confirm rejection with "Issuer key has been revoked" error.
- **Audit Test**: Check audit log for key issuance and revocation events with admin ID.
