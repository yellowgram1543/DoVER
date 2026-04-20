# Plan 4-2: Strict Lineage & Admin API

This plan fixes the version history bug and provides the backend endpoints for user administration.

## User Review Required
> [!NOTE]
> Admin endpoints are protected by the `requireAuthority` middleware.

## Proposed Changes

### 1. Version Lineage Fix
- Refactor `GET /document/:id/versions` in `server/routes/chain.js`:
    - Before traversing the parent chain, store the root document's `filename` and `uploader_email`.
    - During recursion/loop, strictly verify that every parent document matches these two metadata fields.
    - If a mismatch is found, stop the chain at that point (prevents "ghost" versions).

### 2. Admin Endpoints
- Create `server/routes/admin.js` (or add to `chain.js`):
    - `GET /api/admin/users`: Returns a list of all users from the `users` table.
    - `POST /api/admin/promote`: 
        - Takes `userId` and `newRole`.
        - Updates the role in the database.
        - Records the action in `audit_log`: `"Authority [X] promoted [Y] to [Role]"`.

## Verification Plan

### Manual Verification
1. Open a document history that previously showed mixed files.
2. Confirm it now only shows versions of the same file.
3. As an authority, call `GET /api/admin/users` via Postman/curl and verify the list.
4. Promote a user and verify the role change in the database and audit log.
