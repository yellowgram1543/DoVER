# Plan 2-2: Gemini Summary Service

This plan integrates Gemini 1.5 Pro to generate structured intelligence reports for every document.

## User Review Required
> [!WARNING]
> Requires `GEMINI_API_KEY` in `.env`.
> Uses JSON mode to ensure the AI returns machine-readable structured data.

## Proposed Changes

### 1. Gemini Utility
- Create `server/utils/gemini.js`:
    - Initialize `GoogleGenerativeAI`.
    - Implement `generateDocumentSummary(ocrText, forensicReport)`:
        - Construct a system prompt with legal/forensic context.
        - Request classification, entities, and risk assessment in JSON format.
        - Implement robust error handling (fallback to a simple "Summary unavailable" string).

### 2. Integration & Endpoints
- Update `server/utils/processor.js`:
    - After OCR and Forensics, call `gemini.generateDocumentSummary()`.
    - Store the result in a new `ai_summary` column in `db.sqlite`.
- Update `server/routes/chain.js`:
    - Add `POST /api/chain/document/:id/analyze`:
        - Allows an authority to manually trigger a fresh Gemini analysis.

## Verification Plan

### Automated Tests
- Create `tests/test_gemini.js`:
    - Pass mocked OCR text and verify the JSON parser handles the AI output correctly.

### Manual Verification
1. Upload a sample invoice or deed.
2. Verify the `documents` table contains a structured JSON string in the `ai_summary` column.
3. Check that the risk rating matches the forensic flags (e.g., if fonts are inconsistent, risk should be MEDIUM/HIGH).
