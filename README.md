# DoVER: Decentralized Official Vault & Evidence Registry
> **Enterprise-Grade Digital Asset Protection & Forensic Verification Powered by Google Vertex AI**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![AI Engine](https://img.shields.io/badge/AI-Google_Gemini-blue.svg)](https://ai.google.dev/)
[![Blockchain](https://img.shields.io/badge/Blockchain-Polygon_L2-8247E5.svg)](https://polygon.technology/)

DoVER is a secure, blockchain-anchored platform designed to eliminate document forgery. It provides an immutable "Birth Record" for critical digital assets (degrees, titles, identity documents) using a combination of **3-Tier PKI Hierarchy**, **Google Vertex AI**, and **Polygon L2 Anchoring**.

---

## Key Innovation Pillars

### AI-Powered Forensic Engine
Leveraging **Google Gemini Flash**, DoVER performs automated semantic audits. It doesn't just check if the file changed—it understands *what* changed, detecting sophisticated alterations in text and images that traditional hash-checks miss.

### 3-Tier PKI Hierarchy
Every document is cryptographically signed using a full Certificate Authority chain. This ensures that the identity of the issuer is verified through a Root, Intermediate, and Issuing CA structure, mimicking global banking standards.

### Decentralized Proof of Existence
Document proofs are anchored to the **Polygon Blockchain**. This provides permanent, third-party verification that a document existed in its current state at a specific point in time, independent of the DoVER platform.

---

## System Architecture

```mermaid
graph TD
    A[User Upload] --> B[Express Server]
    B --> C[Multer/GridFS]
    C --> D[MongoDB Atlas]
    B --> E[Bull Queue / Upstash Redis]
    E --> F[AI Processor]
    F --> G[Google Vertex AI - Gemini]
    F --> H[Tesseract OCR Engine]
    F --> I[Blockchain Anchoring - Polygon]
    F --> J[PKI Signing Engine]
    J --> K[Digital Vault]
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| **Backend** | Node.js (Express), Bull Queue |
| **AI Intelligence** | **Google Vertex AI (Gemini Flash Latest)** |
| **OCR & Vision** | Tesseract.js, Gemini Vision API |
| **Blockchain** | Polygon amoy (L2), Ethers.js |
| **Infrastructure** | MongoDB Atlas (GridFS), Upstash Redis (TLS) |
| **Identity** | node-forge (3-tier CA), @signpdf/signpdf |
| **UI/UX** | Tailwind CSS, Glassmorphism Design System |

---

## Getting Started

### 1. Environment Configuration
Create a `.env` file with the following keys:
```env
# Core Secrets
SESSION_SECRET=your_secret_here
GEMINI_API_KEY=your_google_ai_key

# Infrastructure
MONGO_URI=your_mongodb_atlas_uri
REDIS_URL=rediss://default:your_upstash_password@your_endpoint.upstash.io:6379

# Blockchain (Optional)
POLYGON_PRIVATE_KEY=your_wallet_key
```

### 2. Installation
```bash
npm install
npm start
```

---

## Forensic Integrity Process
1. **Hash Registration**: Binary fingerprinting using SHA-256.
2. **Identity Verification**: X.509 certificate signing of the document container.
3. **AI Semantic Audit**: Gemini-powered extraction and cross-referencing.
4. **Blockchain Anchoring**: Proof-of-existence receipt generated on Polygon.

---

## Submission Context
**Category:** Digital Asset Protection & Identity Verification
**Challenge:** Secure, immutable storage for high-stakes electronic records.

DoVER addresses the trillion-dollar document fraud problem by creating a "Trust Layer" for the internet, ensuring that digital evidence remains indisputable, forever.

---
*Developed for the Google Cloud & Advanced AI Challenge.*
