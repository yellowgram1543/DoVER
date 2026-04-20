# Phase 4 Plan 2: Strict Lineage & Admin API Summary

This plan resolved a bug in the version history traversal and introduced backend administration capabilities for user management.

## Key Changes

### 1. Strict Version Lineage
- Modified `GET /api/chain/document/:id/versions` in `server/routes/chain.js`.
- Implemented a verification step during parent chain traversal that ensures every ancestor matches the requested document's `filename` and `uploader_email`.
- Updated the recursive CTE for descendant fetching to also enforce these metadata constraints.
- This prevents "ghost" versions from appearing in the history if a document claims a parent it shouldn't have.

### 2. Admin API
- Created `server/routes/admin.js` with the following endpoints:
    - `GET /api/admin/users`: Lists all registered users with their roles and metadata.
    - `POST /api/admin/promote`: Updates a user's role (e.g., from `user` to `authority`).
- Mounted routes at `/api/admin` in `server/app.js`, protected by `requireAuth` and `requireAuthority`.

### 3. Audit & Visibility
- Promotion actions are now recorded in the `audit_log` with `document_id = 0` and action type `USER_PROMOTION`.
- Updated `GET /api/chain/audit` to use `LEFT JOIN` on the documents table, ensuring that system-wide actions (like promotions) which aren't linked to a specific document are still visible to authorities.

## Technical Details
- **Middleware:** Reused `requireAuthority` from `server/middleware/auth.js`.
- **Database:** Standard SQLite operations via `better-sqlite3`.
- **RBAC:** Admin endpoints require the `authority` role in the session user object.

## Deviations from Plan
- **Rule 2 - Missing Functionality:** Updated the audit log retrieval query in `chain.js` from `JOIN` to `LEFT JOIN`. Without this, the promotion logs (which use `document_id: 0`) would have been hidden from the audit view because no document with ID 0 exists.

## Self-Check: PASSED
- [x] Version lineage strictly validated.
- [x] Admin endpoints created and protected.
- [x] Promotion actions logged.
- [x] Audit log visibility improved for system actions.
