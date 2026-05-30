# Frontend Refactoring: Module Mode

## Objective
Refactor the frontend architecture of the DoVER application to use "Module Mode." This approach logically separates the "Citizen" (Vault) and "Institution" (Console) experiences into distinct JavaScript modules and uses URL prefixes (`#/vault/...` and `#/console/...`) to simulate separate applications, enhancing both the professional feel for the hackathon and code maintainability.

## Key Files & Context
*   **`public/index.html`:** The main entry point. Needs updates to support dynamic module loading or script inclusion for both modules, and a simplified initial "Gateway" UI.
*   **`public/app.js`:** Currently contains all logic. Will be refactored to contain only core shared logic (Auth, API helpers, Security) and the main router.
*   **`public/js/citizen.js` (New):** Will contain all UI rendering logic specific to the Citizen persona (e.g., Personal Vault, Document Verification).
*   **`public/js/institution.js` (New):** Will contain all UI rendering logic specific to the Institution persona (e.g., Issuing Documents, Analytics, API Keys).

## Implementation Steps

### Phase 1: File Structure & Core Logic Setup
1.  **Create Module Files:** Create `public/js/citizen.js` and `public/js/institution.js`.
2.  **Extract Shared Code:** Ensure `public/app.js` retains core functionalities like `secureFetch`, `checkAuth`, `API` object, and the foundational router logic. Remove persona-specific rendering functions (like `renderDashboard`, `renderUpload`) from `app.js`.

### Phase 2: URL Routing & Navigation
1.  **Update Router (`navigate` function):** Refactor the hash-based router in `app.js` to parse prefixes.
    *   If `location.hash` starts with `#/vault`, load/execute the Citizen module.
    *   If `location.hash` starts with `#/console`, load/execute the Institution module.
    *   If no prefix (e.g., `#/` or just logged in), display a "Gateway" selection screen.
2.  **Update Navigation Links:** Change all `href` and `data-page` attributes in the sidebar and UI to include the correct prefix (e.g., `<a href="#/vault/settings">`).

### Phase 3: Module Implementation & UI Separation
1.  **Citizen Module (`citizen.js`):** Migrate functions like `renderDashboard` (focused on personal documents), `renderVerify`, and personal `renderSettings` into this file. Establish a clean, blue/white visual theme via Tailwind classes applied to a root container.
2.  **Institution Module (`institution.js`):** Migrate functions like `renderUpload` (Issuing documents), `renderAdmin`, `renderBatch`, and institutional `renderSettings` into this file. Establish a darker, corporate visual theme.
3.  **The "God Mode" Switcher:** Modify the `updateSidebarUI` function. Only render the "Citizen / Institution" mode switcher button if `currentUser.role === 'authority'` (the Judge). Clicking this will simply update the URL hash (e.g., from `#/vault/dashboard` to `#/console/dashboard`), leveraging the new router to switch modules instantly.

### Phase 4: Gateway & Polish
1.  **Gateway Screen:** Create a welcome screen shown immediately after login (if no specific hash is present) asking "Access Personal Vault" or "Enter Organization Console", redirecting to the respective prefixed URLs.
2.  **Remove `localStorage` dependency:** Remove `localStorage.getItem('dover_mode')`. The current active persona will be entirely driven by the URL prefix, ensuring absolute consistency.

## Verification & Testing

1.  **Role Access Check:** Log in as a standard user. Verify that attempting to access `#/console/dashboard` gracefully redirects or shows an unauthorized message if they lack an institutional department, while `#/vault/dashboard` works perfectly.
2.  **Judge Persona Check:** Log in through the normal authentication flow with a seeded authority/Judge account. Verify the mode switcher appears in the sidebar and successfully navigates between `#/vault/dashboard` and `#/console/dashboard` without losing session state.
3.  **Module Isolation:** Ensure that clicking "Issue Document" while in the `#/vault/` space is not possible (the button shouldn't exist in the citizen UI), and verify that institutional API endpoints are not accidentally called from the citizen module.
4.  **Visual Distinction:** Verify the UI styling shifts correctly when navigating between the two namespaces.
