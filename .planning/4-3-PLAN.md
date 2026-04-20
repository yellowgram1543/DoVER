# Plan 4-3: Authority Admin Dashboard UI

This plan implements the frontend interface for user management and system administration.

## User Review Required
> [!NOTE]
> The "System Admin" tab will be invisible to non-authority users.

## Proposed Changes

### 1. Admin UI Tab
- Update `public/app.js`:
    - Update the sidebar template to include a "System Admin" link if `currentUser.role === 'authority'`.
    - Implement `renderAdmin(app)`:
        - Displays a stats summary (Total Users, Total Authorities).
        - Renders a searchable list of registered users in a modern card-based table.
        - Adds an "Authority" toggle switch for each user.
        - Implements real-time UI updates (no page refresh) after a promotion.

### 2. Tab Navigation
- Update the `navigate()` router to handle the `#admin` hash.

## Verification Plan

### Manual Verification
1. Log in as a standard user: Verify the Admin tab is hidden.
2. Log in as an authority: Verify the Admin tab is visible.
3. Open the Admin tab and search for a user.
4. Toggle the authority status of a user and verify the "Success" toast/message appears.
