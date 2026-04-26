<!-- generated-by: gsd-doc-writer -->
# Testing Suite

This document describes the testing strategy and current test suite for the DoVER project.

## Overview

The project uses a combination of unit tests for core infrastructure and end-to-end (E2E) verification scripts to ensure the integrity of the document processing pipeline. Tests are currently implemented as standalone Node.js scripts.

## Current Testing Suite

### Unit Tests

- **Signing Infrastructure (`tests/test_signing_infra.js`)**
  - **Purpose:** Verifies the P12 certificate loading, PDF placeholder insertion, and digital signature application.
  - **Key Checks:** Correct certificate password handling, signature validity, and PDF integrity post-signing.

- **OCR Engine (`tests/test_ocr_multi.js`)**
  - **Purpose:** Tests the multi-lingual Tesseract.js implementation.
  - **Key Checks:** Script detection for Latin, Devanagari, and Arabic; extraction accuracy; and worker pool initialization.

### End-to-End & Integration Tests

- **LTV (Long Term Validation) Signing (`tests/test_ltv_signing.js`)**
  - **Purpose:** E2E verification of the full signing and verification lifecycle.
  - **Key Checks:** Validates that documents signed by the system can be verified successfully with the corresponding public key and maintain validity over time.

- **Blockchain Anchoring (`tests/test_polygon.js`)**
  - **Purpose:** Verifies the connection to the Polygon network and successful batch anchoring.
  - **Key Checks:** Wallet initialization, transaction creation, and receipt confirmation on-chain.

- **Generative AI Audit (`tests/test_gemini.js` / `tests/test_gemini_real.js`)**
  - **Purpose:** Tests the integration with Google's Gemini API.
  - **Key Checks:** Prompt engineering, response parsing, and error handling for the summarization service.

## Running Tests

To run the tests, ensure you have the necessary environment variables configured in your `.env` file, then execute the desired script using Node.js:

```bash
# Run signing infrastructure tests
node tests/test_signing_infra.js

# Run multi-lingual OCR tests
node tests/test_ocr_multi.js

# Run E2E LTV signing verification
node tests/test_ltv_signing.js

# Run Polygon anchoring tests
node tests/test_polygon.js
```

## Writing New Tests

When adding new features, follow these patterns for creating tests:
1. Create a new script in the `tests/` directory named `test_{feature_name}.js`.
2. Use absolute paths or the project root for file references.
3. Include clear `console.log` or `console.error` outputs for success/failure states.
4. If testing a core utility, ensure it can be run in isolation from the Express server.

## CI/CD Integration

<!-- VERIFY: Details of CI/CD pipeline if implemented (e.g., GitHub Actions config) -->
Currently, tests are run manually during the development process. Automated CI integration is planned to enforce these checks on every pull request.
