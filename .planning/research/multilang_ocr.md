# Deep Dive: Multi-Language OCR for Hindi, Kannada, and Tamil

**Objective:** Optimize Tesseract.js for low-quality government document scans.
**Date:** 2024-05-24

## 1. Tesseract.js Language Support

Tesseract.js supports multi-language recognition by concatenating language codes with a `+`.

### Language Codes
- **Hindi:** `hin` (Devanagari script)
- **Kannada:** `kan`
- **Tamil:** `tam`
- **English:** `eng` (Often present in gov docs)

### Implementation
```javascript
const { createWorker } = Tesseract;
const worker = await createWorker('hin+kan+tam+eng');
```

## 2. Recommended Models

Do **not** use the default Tesseract.js models for high-stakes government documents. Instead, use the `tessdata_best` or `Indic-OCR` specialized models.

| Model Set | Source | Pros | Cons |
|-----------|--------|------|------|
| **Tessdata Best** | [tesseract-ocr/tessdata_best](https://github.com/tesseract-ocr/tessdata_best) | Official, high accuracy LSTM models. | Slow, large file size. |
| **Indic-OCR** | [indic-ocr/tessdata](https://github.com/indic-ocr/tessdata) | Specifically tuned for Indian context/fonts. | Community maintained. |

**Configuration:**
```javascript
const worker = await createWorker('hin', 1, {
  langPath: 'https://path-to-your-best-models/',
  gzip: false
});
```

## 3. Pre-processing Strategies for Low-Quality Scans

Government documents often suffer from bleed-through, stamps, and low resolution. Use **OpenCV.js** for these techniques:

### A. Adaptive Thresholding (Handling Uneven Lighting)
Standard binarization fails on shadows. Adaptive thresholding calculates a threshold for each small pixel neighborhood.
```javascript
cv.adaptiveThreshold(src, dst, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 2);
```

### B. Color Channel Splitting (Removing Blue Stamps)
If a document has blue ink stamps over black text, the **Red channel** typically contains the most text detail with the least stamp interference.
```javascript
let rgbaChannels = new cv.MatVector();
cv.split(src, rgbaChannels);
let textOnly = rgbaChannels.get(0); // Red channel
```

### C. Shirorekha Restoration (Hindi/Devanagari)
To fix broken top lines:
1. **Dilation:** Slightly thicken horizontal strokes.
2. **Median Blur:** Remove salt-and-pepper noise without destroying the line.

### D. Deskewing
Tesseract's accuracy drops significantly with even a 2-degree tilt.
- Detect lines using `HoughLinesP`.
- Calculate the median angle.
- Rotate the image using `getRotationMatrix2D`.

## 4. Advanced Tesseract.js Parameters

Fine-tune the engine for better results on structured documents:

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `tessedit_pageseg_mode` | `3` or `6` | 3 = Auto; 6 = Assume a single uniform block of text. |
| `tessedit_ocr_engine_mode` | `1` | Forces LSTM engine (required for Indic scripts). |
| `tessedit_char_whitelist` | (Optional) | Limit characters if document type is known (e.g., only numbers for IDs). |

## 5. Post-processing Strategy

Raw OCR on low-quality scans will have errors.
1. **Confidence Filtering:** Words with < 60% confidence should be flagged.
2. **LLM Cleaning:** Pass the text to an LLM with the prompt:
   > "The following text is from a noisy OCR of a [Hindi/Tamil/Kannada] government document. Please correct obvious spelling mistakes and reconstruct the logical structure, but do not hallucinate facts."

## 6. Summary of Strategy

1. **Upscale** to 300 DPI (Bicubic).
2. **Grayscale** via Red channel (to ignore blue stamps).
3. **Adaptive Thresholding** for binarization.
4. **Bilateral Filter** for noise reduction.
5. **OCR** using `tessdata_best` models.
6. **LLM Cleanup** for final output.
