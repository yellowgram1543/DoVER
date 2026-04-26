# Phase 6-2-PLAN: The "Trust Journey" UI & Gemini Summary

Enhance the verification experience with visual feedback and AI-powered natural language insights.

## 1. Goal
Make the backend's complexity visible to the user via a step-by-step verification animation and provide human-readable integrity summaries using Gemini.

## 2. Success Criteria
- [ ] **Verification Journey**: "Verify" button triggers a multi-step visual checklist (Scanning... Analyzing... Validating...).
- [ ] **Gemini Report**: Verification result includes a "Human-Readable Integrity Summary" section.
- [ ] **AI Confidence Score**: Visual gauge showing the AI's confidence in the document's authenticity.

## 3. Tasks
1. **Verification Logic**: Update the `renderVerify` submit handler in `public/app.js` to implement a "simulated scanner" delay with visual updates.
2. **Gemini Integration**: Modify the `verify` route in `server/routes/verify.js` to call the Gemini API and generate a document summary based on OCR and forensic data.
3. **UI Display**: Add a "Gemini AI Audit" section to the verification result card in `public/app.js`.

## 4. Verification Plan
- **UX Test**: Perform a verification and confirm that the "Step-by-Step" progress bar appears.
- **AI Test**: Verify a document and confirm that a text summary (e.g., "This appears to be a legitimate ID...") is displayed.
