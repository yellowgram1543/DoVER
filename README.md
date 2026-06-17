<picture>
  <img src="public/hero-banner.svg" alt="DoVER - Official Portal" width="1600" height="480" />
</picture>

# DoVER: Decentralized Official Vault & Evidence Registry
> **AI Forensics + 3‑Tier PKI + Polygon Anchoring for tamper‑evident records**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![AI Engine](https://img.shields.io/badge/AI-Google_Gemini-blue.svg)](https://ai.google.dev/)
[![Blockchain](https://img.shields.io/badge/Blockchain-Polygon_L2-8247E5.svg)](https://polygon.technology/)

**Mission:** eliminate document forgery by creating an immutable **Birth Record** for high-stakes digital assets—backed by **Google Vertex AI**, **3‑Tier PKI**, and **Polygon L2** proofs.

### Quick navigation
- [Getting Started](#getting-started--deployment)
- [Project Structure](#project-structure)
- [Contributor Entry Points](#contributor-entry-points)
- [Development Workflow](#development-workflow)
- [Forensic Integrity & Verification](#forensic-integrity--verification)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)

---


## Key Innovation Pillars

| Pillar | What it does | Benefit |
|---|---|---|
| **AI Forensic Audit** | Uses Google Vertex AI (Gemini) to compare content semantics between the document and its immutable “Birth Record”. | Detects sophisticated text/image tampering beyond simple hash checks. |
| **3‑Tier PKI Hierarchy** | Signs documents with a Certificate Authority chain (Root → Intermediate → Issuing CA). | Verifies issuer identity with banking-grade certificate trust. |
| **Polygon Blockchain Anchoring** | Anchors a proof-of-existence receipt on Polygon L2. | Independent, permanent verification that the record existed at a specific time. |
| **OCR Verification** | Extracts text/structure from documents (Tesseract + vision pipeline) to support semantic audit workflows. | Improves audit accuracy for scanned and image-based documents. |
| **Digital Vault** | Stores evidence (including artifacts like OCR outputs) for later verification and audit trails. | Centralized evidence management with tamper-aware workflows. |
| **HMAC‑SHA256 Security** | Protects requests and uploads with signed cryptographic headers. | Prevents tampering and ensures secure end-to-end transport. |

---


## System Architecture

<a id="system-architecture"></a>


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

<a id="technology-stack"></a>



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

## Project Structure

```text
DoVER/
├── public/                 # Frontend assets and client-side scripts
│   ├── app.js              # Frontend application logic
│   ├── hero-banner.svg     # Project banner asset
│   ├── js/                 # Citizen and institution workflows
│   ├── index.html          # Landing page
│   ├── verify.html         # Verification interface
│   └── styles.css          # Application styling
│
├── server/                 # Backend application
│   ├── db/                 # Database configuration and migrations
│   ├── middleware/         # Authentication, security, and request validation
│   ├── routes/             # API route definitions
│   ├── utils/              # AI, PKI, blockchain, OCR, and verification utilities
│   └── app.js              # Express application entry point
│
├── src/
│   └── services/           # Frontend API communication layer
│
├── Dockerfile
├── MODULE_MODE.md
├── package.json 
├── package-lock.json 
└── README.md
```

## Directory Overview

### `public/`

Contains the user-facing application, including HTML pages, styling, static assets, and client-side JavaScript for citizen and institutional workflows.

### `server/db/`

Manages database connectivity, schema definitions, and migration scripts.

### `server/middleware/`

Provides authentication, API key validation, HMAC verification, rate limiting, and other request-processing middleware.

### `server/routes/`

Defines REST API endpoints for uploads, verification, authentication, administration, blockchain interactions, and statistics.

### `server/utils/`

Implements the core DoVER functionality, including AI-powered forensic analysis, OCR processing, PKI operations, Merkle tree generation, blockchain anchoring, digital signatures, reporting, and queue management.

### `src/services/`

Contains frontend service modules responsible for communicating with backend APIs such as document upload, verification, blockchain records, and statistics retrieval.

## Contributor Entry Points

New contributors can get started in the following areas:

* **Frontend Enhancements:** Improve UI, responsiveness, and user workflows in `public/`.
* **Backend Features:** Add or improve API endpoints and request handling in `server/routes/`.
* **Security Improvements:** Enhance authentication, HMAC verification, and middleware protections in `server/middleware/`.
* **AI & Verification:** Contribute to OCR, forensic analysis, Gemini integration, PKI workflows, and blockchain anchoring in `server/utils/`.
* **Documentation:** Improve guides, onboarding materials, and project documentation.

## Development Workflow

1. Fork the repository.
2. Clone your fork locally.
3. Create a feature branch.
4. Implement and test your changes.
5. Commit with clear commit messages.
6. Push the branch to your fork.
7. Open a Pull Request describing your contribution.
8. Address review feedback and update the PR as needed.


## Getting Started & Deployment

<a id="getting-started--deployment"></a>


### 1. Local Environment Configuration
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

### 2. Local Installation
```bash
npm install
npm start
```

### 3. Google Cloud Deployment (Cloud Run)
DoVER is optimized for **Google Cloud Run**.
1. Create a new Cloud Run service and connect your repository.
2. Select **Dockerfile** as the build configuration.
3. Inject the environment variables listed above into the Cloud Run configuration.

---

## Forensic Integrity & Verification

<a id="forensic-integrity--verification"></a>

Every verified document in DoVER produces an **AI Forensic Verdict**:

1. **Hash Registration**: Binary fingerprinting using SHA-256 to verify binary integrity.
2. **Identity Verification**: Validates the PKI signature against the X.509 CA chain.
3. **AI Semantic Audit**: Vertex AI (Gemini) compares current content against the "Birth Record" to detect semantic tampering.
4. **Blockchain Anchoring**: Proof-of-existence receipt generated on the Polygon network.

---

## Submission Context
**Category:** Digital Asset Protection & Identity Verification
**Challenge:** Secure, immutable storage for high-stakes electronic records.

DoVER addresses the trillion-dollar document fraud problem by creating a "Trust Layer" for the internet, ensuring that digital evidence remains indisputable, forever.

---

## Contributors

Thanks to all the amazing people who contribute to **DoVER** 🚀

<p align="center">
  <a href="https://github.com/yellowgram1543/DoVER/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=yellowgram1543/DoVER" alt="Contributors"/>
  </a>
</p>

---

## Project Support

<p align="center">
  <a href="https://github.com/yellowgram1543/DoVER/stargazers">
    <img src="https://img.shields.io/github/stars/yellowgram1543/DoVER?style=social" alt="Stars">
  </a>
  &nbsp;&nbsp;
  <a href="https://github.com/yellowgram1543/DoVER/network/members">
    <img src="https://img.shields.io/github/forks/yellowgram1543/DoVER?style=social" alt="Forks">
  </a>
</p>

---

*Developed for the Google Cloud & Advanced AI Challenge.*
