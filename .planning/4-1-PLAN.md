# Plan 4-1: Identity & Department Locking

This plan implements strict identity privacy and permanent department binding for users.

## User Review Required
> [!IMPORTANT]
> Once a user uploads their first document, their department is "locked" and cannot be changed from the UI.

## Proposed Changes

### 1. Database Migration
- Create `server/db/migrate_departments.js`:
    - Add `department` column to `users` table if it doesn't exist.

### 2. Department Locking Logic
- Update `server/routes/upload.js`:
    - In the upload handler:
        - Check if the current user already has a `department` set in the `users` table.
        - If NOT: Save the `req.body.department` to the user's profile.
        - If YES: Use the `department` from the profile and ignore the one sent in the request.

### 3. Strict Privacy Filtering
- Update `server/routes/chain.js`:
    - Change `WHERE uploaded_by = ?` to `WHERE uploader_email = ?`.
- Update `server/routes/stats.js`:
    - Rewrite all count queries to filter by `uploader_email`.

### 4. Auth Payload Update
- Update `server/routes/auth.js`:
    - Ensure the `/me` response includes the `department` field from the database.

## Verification Plan

### Manual Verification
1. Log in with a fresh account.
2. Upload a document as "Legal".
3. Verify the `users` table now has "Legal" saved for your account.
4. Try to upload another document but select "Finance" in the UI.
5. Verify the second document is saved as "Legal" in the database (UI dropdown ignored).
6. Verify you cannot see documents from other users even if they have the same display name.
