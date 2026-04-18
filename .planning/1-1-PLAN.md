# Plan 1-1: RBAC & Promotion Infrastructure

This plan establishes the manual authority promotion tool and ensures all existing routes correctly respect the `authority` role for global document visibility.

## User Review Required
> [!IMPORTANT]
> This uses a manual CLI command for promotion as requested in 1-CONTEXT.md.

## Proposed Changes

### 1. New Promotion Script
- Create `scripts/promote.js`:
    - Takes an email address as a CLI argument.
    - Updates the `users` table in `db.sqlite`: `UPDATE users SET role = 'authority' WHERE email = ?`.
    - Provides clear console feedback on success or "User not found".

### 2. Standardize RBAC Checks
- Review `server/routes/chain.js`:
    - Ensure `req.user.role === 'authority'` is used consistently for global view.
    - Ensure ordinary users only see documents where `uploaded_by` matches their session name.
- Review `server/routes/stats.js`:
    - Ensure statistics are correctly scoped to the user's role.

## Verification Plan

### Automated Tests
- Run `node scripts/promote.js test@example.com` and verify the database record.
- Create a test script to hit `/api/chain` with different user sessions (mocked) and verify filtered results.

### Manual Verification
1. Login with Account A.
2. Upload a document.
3. Login with Account B.
4. Verify Account B **cannot** see Account A's document.
5. Run `node scripts/promote.js <Account B Email>`.
6. Refresh Account B dashboard.
7. Verify Account B **can** now see all documents and audit logs.
