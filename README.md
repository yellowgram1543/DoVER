# DoVER: Decentralized Official Vault & Evidence Registry
> **Enterprise-Grade Digital Asset Protection & Forensic Verification**

DoVER is a secure, blockchain-anchored platform for issuing, storing, and verifying critical digital assets (degrees, land titles, identity documents). It leverages **Google Vertex AI** and **HMAC-SHA256 Cryptography** to provide an immutable chain of trust.

---

## 🚀 Key Features

- **🛡️ 3-Tier PKI Hierarchy**: Uses a full Certificate Authority (CA) chain for identity-verified document issuance.
- **🧠 Vertex AI Forensic Engine**: Powered by **Google Gemini 1.5 Flash** for automated semantic audits and anomaly detection.
- **⛓️ Polygon Blockchain Anchoring**: Document proofs are anchored to the Polygon network for permanent, third-party verification.
- **🔒 HMAC-SHA256 Security**: Every request and file upload is protected by signed cryptographic headers to prevent tampering.
- **📂 Universal AI Intelligence**: Automated summarization for both Image-based (OCR) and Plain Text documents.

---

## 🏗️ Enterprise Architecture (Google Cloud Native)

DoVER is designed for the Google Cloud ecosystem, ensuring scalability and security:

- **Cloud Execution**: Hosted on **Google Cloud Run** for high-availability "scale-to-zero" performance.
- **AI Intelligence**: Integrated with **Vertex AI SDK** for enterprise-grade forensic reporting.
- **Database**: Hybrid architecture using **MongoDB Atlas** for document storage and **Redis** for secure nonce/rate-limiting.
- **Identity**: Root and Intermediate CA keys are managed in a secure 3-tier hierarchy.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Core** | Node.js, Express |
| **AI / ML** | **Google Vertex AI (Gemini 1.5 Flash)** |
| **Identity** | node-forge (3-tier PKI), HMAC-SHA256 |
| **Blockchain** | Polygon (L2), Ethers.js |
| **Storage** | MongoDB (GridFS), IPFS |
| **Queue** | Bull (Redis-backed async processing) |

---

## 📦 Deployment on Google Cloud

DoVER is optimized for **Google Cloud Run**.

### 1. Prerequisites
- A Google Cloud Project (`dover-493719`).
- Vertex AI and Cloud Run APIs enabled.

### 2. Manual Deployment via Cloud Console
1. Create a new **Cloud Run** service.
2. Connect your GitHub repository.
3. Select **Dockerfile** as the build configuration.
4. Add the following Environment Variables:
   - `GOOGLE_CLOUD_PROJECT`: `dover-493719`
   - `GEMINI_API_KEY`: (Your Google AI Key)
   - `CA_PASSPHRASE`: (Your Secure Master Passphrase)
   - `JWT_SECRET`: (A strong random string)

---

## 📜 Forensic Integrity Report
Every verified document in DoVER produces an **AI Forensic Verdict**:
1. **Hash Check**: Verifies the binary integrity of the file.
2. **Identity Check**: Validates the PKI signature against the CA chain.
3. **AI Audit**: Vertex AI compares the current file content against its original "Birth Record" to detect semantic tampering.

---

## 👨‍💻 Submission Category
**[Digital Asset Protection] Open Innovation**
DoVER addresses real-world document forgery and identity theft by providing a decentralized, AI-augmented vault for the world's most important digital assets.
