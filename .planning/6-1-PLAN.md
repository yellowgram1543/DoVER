# Phase 6-1-PLAN: B2B/B2C Structural Split

Transform the UI from a flat dashboard into a dual-purpose vault system.

## 1. Goal
Implement a "Role Switcher" that toggles the UI between an **Individual Citizen Vault** and a **Business/Institutional Portal**, with specific document categories for each.

## 2. Success Criteria
- [ ] Sidebar includes a "Switch to [Business/Individual]" toggle.
- [ ] **Individual View**: Shows tabs for "Personal", "Family", and "Office" documents.
- [ ] **Business View**: Shows a dedicated "Employee Records" management tab.
- [ ] Upload modal includes a "Category" dropdown based on the active view.

## 3. Tasks
1. **Frontend Logic**: Update `public/app.js` to store a `currentMode` (B2C or B2B) in localStorage.
2. **Layout Overhaul**: Modify `public/index.html` to add the Mode Switcher in the sidebar.
3. **Dynamic Filtering**: Update the `renderDashboard` and `renderTable` functions to filter documents based on the active mode and category.
4. **Upload Enhancement**: Update the upload form to include the new B2B/B2C categories.

## 4. Verification Plan
- **Manual Test**: Toggle the switcher and verify that the dashboard headings and categories change instantly.
- **Data Integrity**: Ensure documents uploaded in "Family" don't appear in the "Business" view.
