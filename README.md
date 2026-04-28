# DoVER: Decentralized Official Vault & Evidence Registry

[![Security: HMAC-SHA256](https://img.shields.io/badge/Security-HMAC--SHA256-blueviolet)](https://github.com/yellowgram1543/DoVER)
[![Integrity: SHA-256](https://img.shields.io/badge/Integrity-SHA--256-blue)](https://github.com/yellowgram1543/DoVER)
[![Blockchain: Polygon](https://img.shields.io/badge/Blockchain-Polygon--Amoy-8247E5)](https://polygon.technology/)
[![AI: Google Gemini](https://img.shields.io/badge/AI-Google--Gemini-4285F4)](https://deepmind.google/technologies/gemini/)

**DoVER** is a production-grade document verification and certification platform designed for the modern enterprise. By combining **3-tier PKI security**, **AI-driven forensic analysis**, and **Public Blockchain anchoring**, DoVER creates an immutable bridge between physical documents and digital trust.

---

## 🌟 Key Product Pillars

### 🏛️ Dual-Mode Governance (B2B & B2C)
DoVER features a seamless, toggleable interface catering to two critical markets:
*   **Institutional Mode (B2B)**: An administrative powerhouse for universities, government bodies, and corporations to issue certified records, manage document versioning, and maintain a high-integrity audit trail.
*   **Citizen Mode (B2C)**: A secure, user-centric "Personal Vault" allowing individuals to protect their own life records (birth certificates, degrees, property deeds) in a self-sovereign environment.

### 🛡️ Hardened Security Architecture
The platform implements a **Zero-Trust communication protocol**:
*   **HMAC-SHA256 Request Signing**: Every API call is cryptographically signed by the client to prevent MITM attacks and request forgery.
*   **Client-Side Hashing**: Documents are hashed in the browser (SHA-256) before upload, ensuring the server can verify integrity before the file is even stored.
*   **3-Tier PKI Hierarchy**: A robust Root -> Intermediate -> Business certificate chain secures all digitally signed exports (P12/LTV).

### 🤖 AI-Driven Integrity Audits
Integrated with **Google Gemini**, DoVER provides human-readable document intelligence:
*   **Automatic Summarization**: Instant semantic breakdown of complex documents.
*   **Deep Forensic Analysis**: Pixel-level variance detection (TensorFlow.js) to identify digital "brush strokes" or font tampering.
*   **Polyglot OCR**: Intelligent script detection supporting English, Hindi, Arabic, Kannada, and Tamil.

### ⛓️ Immutable Trust Anchoring
DoVER ensures long-term availability beyond any single database:
*   **Polygon Blockchain**: Merkle roots of document batches are anchored to the Polygon Amoy testnet for permanent, public proof of existence.
*   **IPFS Storage**: Documents can be optionally pinned to the InterPlanetary File System for decentralized, content-addressed persistence.

---

## 🚀 Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend** | Node.js, Express, SQLite (Metadata), MongoDB GridFS (Storage) |
| **Frontend** | Vanilla JavaScript, CSS3 (Enterprise UI), CryptoJS |
| **AI/ML** | Google Gemini 1.5 Pro, TensorFlow.js, Tesseract.js |
| **Blockchain** | Polygon Amoy, Ethers.js, Merkle Trees |
| **Security** | Passport.js (Google OAuth), Forge (PKI), HMAC-SHA256 |

---

## 🛠️ Quick Start for Judges

### 1. Prerequisites
*   Node.js (v18+)
*   MongoDB (Atlas or Local)
*   Redis (Required for rate-limiting and nonce-registry)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/yellowgram1543/DoVER.git
cd DoVER

# Install dependencies
npm install

# Setup Environment
cp .env.example .env
# (Populate .env with your MongoDB, Redis, and Gemini API keys)
```

### 3. Launching the Platform
```bash
# Start the production server
npm start
```
The server will automatically bootstrap the **PKI Root Hierarchy** on the first launch. Access the portal at `http://localhost:3000`.

---

## 📂 Project Structure

```text
DoVER/
├── public/             # SPA Frontend (B2B/B2C Toggle)
│   ├── app.js          # Secure communication engine
│   └── index.html      # Landing & Dashboard UI
├── server/             # Express.js API Surface
│   ├── routes/         # Upload, Verify, and Chain controllers
│   ├── middleware/     # HMAC signing & Auth filters
│   └── utils/          # The "Engine Room" (OCR, Forensics, Blockchain)
└── README.md           # Master Documentation
```

---

## 📜 API Highlights

| Method | Path | Purpose |
| :--- | :--- | :--- |
| `POST` | `/api/upload` | Securely register a document with HMAC signature. |
| `POST` | `/api/verify` | Multi-layered deep verification check. |
| `GET` | `/api/verify/public/verify/:hash` | Public, hash-based authenticity portal. |
| `GET` | `/api/chain/document/:id/certified` | Export digitally signed, PKI-certified PDF. |

---

## 🏆 Hackathon Acknowledgments
DoVER was built with a focus on **Security-First Engineering**. Every line of code was audited to ensure document provenance cannot be faked, and the identity of issuers is cryptographically verifiable.

**Built for the future of digital trust.**
