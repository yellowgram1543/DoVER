<!-- generated-by: gsd-doc-writer -->
# External API Integrations

This document outlines the external API integrations used in the DoVER project to provide document summarization, blockchain anchoring, decentralized storage, and multi-lingual OCR capabilities.

## Gemini (Google Generative AI)

DoVER uses Google's Gemini Pro model to generate intelligent summaries of processed documents and perform generative AI audits during the verification process.

- **Purpose:** Document summarization and verification auditing.
- **Library:** `@google/generative-ai`
- **Implementation:** `server/utils/gemini.js`
- **Credential Requirements:**
  - `GEMINI_API_KEY`: A valid API key from Google AI Studio.

## Polygon (Blockchain Anchoring)

Blockchain anchoring ensures the integrity of document batches by recording their Merkle Roots on the Polygon network. This provides a decentralized "Ancestry Validation" for all stored files.

- **Purpose:** Decentralized integrity anchoring for document batches.
- **Library:** `ethers`
- **Implementation:** `server/utils/polygon.js`
- **Network:** Polygon Amoy Testnet (default).
- **Credential Requirements:**
  - `POLYGON_PRIVATE_KEY`: The private key of the wallet used for anchoring transactions.
  - `POLYGON_RPC_URL`: (Optional) Custom RPC endpoint for the Polygon network.
  <!-- VERIFY: Actual RPC URL used in production deployment if different from Amoy testnet -->

## Pinata / IPFS (Decentralized Storage)

Decentralized storage is used to ensure document persistence and availability outside of the local server environment.

- **Purpose:** Secure, decentralized storage for document binaries and metadata.
- **Implementation:** `server/utils/ipfs.js` (Rest API integration)
- **Credential Requirements:**
  - `PINATA_API_KEY`: Pinata API Key.
  - `PINATA_SECRET_KEY`: Pinata Secret API Key.
  <!-- VERIFY: Pinata dashboard link for account management -->

## Tesseract.js (Multi-lingual OCR)

DoVER integrates Tesseract.js to provide robust optical character recognition across multiple languages and scripts.

- **Purpose:** Text extraction and script detection for scanned documents.
- **Library:** `tesseract.js`
- **Implementation:** `server/utils/ocr.js`
- **Supported Scripts:**
  - **Latin:** English (eng)
  - **Devanagari:** Hindi (hin)
  - **Kannada & Tamil:** Indic (indic)
  - **Arabic:** Arabic (ara)
- **Features:** Automatic Orientation and Script Detection (OSD), specialized worker routing, and intelligent image pre-processing with Jimp.

## Summary of Environment Variables

| Variable | Description | Source |
|----------|-------------|--------|
| `GEMINI_API_KEY` | Google AI Studio API Key | [Google AI Studio](https://aistudio.google.com/) |
| `POLYGON_PRIVATE_KEY` | Wallet private key for anchoring | MetaMask / Wallet |
| `PINATA_API_KEY` | Pinata API Key for IPFS | [Pinata Dashboard](https://app.pinata.cloud/) |
| `PINATA_SECRET_KEY` | Pinata Secret Key for IPFS | [Pinata Dashboard](https://app.pinata.cloud/) |
