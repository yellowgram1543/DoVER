# Phase 2 Context: Intelligence & Advanced OCR

## 1. Locked Implementation Decisions

### Multi-Lang OCR Engine (The "Polyglot" Pipeline)
- **Language Scope:** Hindi (`hin`), Kannada (`kan`), Tamil (`tam`), and English (`eng`).
- **Detection Strategy:** Script analysis before full extraction. The pipeline will attempt to detect the primary script and fallback to English if confidence is low.
- **Architecture:** 
    - Dedicated Worker Pool: 3 distinct Tesseract workers (1: eng, 2: hin, 3: kan+tam).
    - Model Caching: Keep workers warm to avoid the 5-10s load time per request.
- **Pre-processing:** Maintain existing Jimp scaling/contrast logic, but optimize for Indic script shirorekha (horizontal lines) where possible.

### Gemini Summary Service (The "Expert" Analyst)
- **Model:** Gemini 1.5 Pro (via Google Generative AI SDK).
- **Triggers:**
    - **Proactive:** Runs automatically in the `processor.js` queue after OCR/Forensics.
    - **Reactive:** "Refresh Analysis" button in the dashboard for manual re-runs.
- **Reporting Scope:** Must generate a structured JSON-like summary containing:
    - **Classification:** Document type (Deed, Affidavit, etc.).
    - **Entities:** Extracted Names, Dates, Amounts, and ID numbers.
    - **Forensic Plain-English:** Translates technical forensic scores (e.g., "baseline jitter") into human terms.
    - **Risk Rating:** LOW / MEDIUM / HIGH.

### Intelligence UI (The "Insight" Panel)
- **Mechanism:** A new "Intelligence" tab in the Document Detail view (separated from the "Integrity" modal).
- **Visuals:** 
    - Risk Assessment Badge (Color-coded: Green/Yellow/Red).
    - Detected Language + Confidence Score.
    - Gemini AI Summary Card.
    - Collapsible "Raw OCR Text" section for full transparency.
    - "Extracted Entities" table for quick data review.

## 2. Reusable Assets & Patterns
- **Backend:** Expand `server/utils/ocr.js` to handle the worker pool.
- **Queue:** Update `processor.js` to include the Gemini API call after the worker-thread forensics.
- **Frontend:** Extend `public/app.js` with a new tabbed navigation in the document detail view.

## 3. Out of Scope for Phase 2
- **Multi-page PDF OCR:** Only single-page image/PDF first page for now.
- **LLM-based Tamper Heatmap:** Visual overlays are deferred to Phase 3.
- **Manual Entity Correction:** Editing the AI's extracted data is deferred.
