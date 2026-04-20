# Plan 2-1: Polyglot OCR Pipeline

This plan implements a high-performance, multi-language OCR engine with script detection.

## User Review Required
> [!IMPORTANT]
> This requires downloading significant Tesseract language data (~100MB+ for hin, kan, tam).
> Ensure stable internet connection during the first run.

## Proposed Changes

### 1. Worker Pool Implementation
- Update `server/utils/ocr.js`:
    - Implement a `WorkerPool` class to manage 3 `Tesseract.createWorker` instances:
        - `engWorker`: Initialized with `eng`.
        - `hinWorker`: Initialized with `hin`.
        - `indicWorker`: Initialized with `kan+tam`.
    - Implement `initWorkers()` to pre-load models on server start.
    - Implement a `detectScript(filePath)` helper (using basic pixel analysis or a small Tesseract pass) to choose the right worker.

### 2. Multi-Lang Extraction
- Refactor `extractText(filePath)`:
    - First, run a fast "OSD" (Orientation and Script Detection) pass.
    - Route the image to the appropriate specialized worker.
    - If specialized extraction fails or confidence is low, fallback to the `engWorker`.
    - Return the best text and the detected language.

## Verification Plan

### Automated Tests
- Create `tests/test_ocr_multi.js`:
    - Pass a Hindi receipt and verify `hin` script is detected.
    - Pass a Kannada document and verify character recognition.

### Manual Verification
1. Upload a document with Hindi text.
2. Verify the server logs show "Routing to hinWorker".
3. Check the database `ocr_text` column for correct Indic characters.
