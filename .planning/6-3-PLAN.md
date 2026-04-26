# Phase 6-3-PLAN: Official Export Integration & Production Polish

Finalize the document lifecycle by enabling official certified PDF exports.

## 1. Goal
Connect the UI to the `SignatureEngine` to allow users to download cryptographically signed, court-ready PDFs. Perform final UX polish for the April 28th deadline.

## 2. Success Criteria
- [ ] **Download Certified Copy**: Button in the dashboard/explorer triggers `SignatureEngine.signPdf()`.
- [ ] **Embedded Proof**: Exported PDF includes the `dover_proof.json` attachment.
- [ ] **Mobile Responsive**: Sidebar and tables are fully usable on small screens.
- [ ] **Aria Accessibility**: Critical buttons and forms have descriptive ARIA labels.

## 3. Tasks
1. **API Endpoint**: Create `GET /api/chain/document/:id/certified` route in `server/routes/chain.js`.
2. **Backend Logic**: In the new route, fetch document from GridFS, retrieve metadata from SQLite, and call `signatureEngine.signPdf()` with the proof data.
3. **Frontend Integration**: Update the "Download Proof" button in `public/app.js` to offer two options: "Raw JSON Proof" and "Official Certified PDF".
4. **UX Polish**: Add final CSS adjustments for mobile "hamburger" menu and table scrolling.

## 4. Verification Plan
- **Production Test**: Click "Download Certified PDF" on an uploaded document and verify the result in Adobe Acrobat.
- **Mobile Test**: Use Chrome DevTools to verify responsive layout on "iPhone 14" preset.
