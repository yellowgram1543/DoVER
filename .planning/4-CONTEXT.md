# Phase 4 Context: Admin Console & Security Hardening

## 1. Locked Implementation Decisions

### Identity & Privacy Locks
- **Email-Only Filtering:** All database queries for "My Documents" and Statistics must be rewritten to filter strictly by `uploader_email`. Use of names for privacy filtering is deprecated to prevent "Same Name" collisions.
- **Department Binding:**
    - A new `department` column will be added to the `users` table.
    - Upon a user's first document upload, their selected department will be saved to their profile.
    - All subsequent uploads will ignore the dropdown and use the "locked" department from the profile.

### Strict Version Lineage
- **Traceability Fix:** The `GET /document/:id/versions` route must be refactored.
- **Verification Rule:** Every document in a version chain MUST share the same `filename` and `uploader_email` as the root document. Any branch with mismatched metadata must be excluded from the timeline.

### Authority Admin Dashboard
- **Access:** Only users with `role = 'authority'` can see this tab.
- **Features:**
    - User Management: A searchable list of all registered users.
    - Role Promotion: A toggle/button to set a user's role to `authority`.
    - Real-time Updates: Use internal API endpoints `/api/admin/users` and `/api/admin/promote`.
- **Governance:** Every role change must be logged in the system-wide Audit Log with the promoter's identity.

## 2. Reusable Assets & Patterns
- **Database:** `better-sqlite3` for migration and admin queries.
- **Auth Middleware:** Reuse `requireAuthority` from `server/middleware/auth.js`.
- **UI Styling:** Maintain "Modern Tech/Startup" card-based layout for the admin user list.

## 3. Out of Scope for Phase 4
- **Self-Service Department Change:** Once locked, only an admin can change a user's department (deferred to Phase 5).
- **Organization-level SSO:** Deferred.
