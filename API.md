<!-- generated-by: gsd-doc-writer -->
# API Reference

The DoVER REST API provides endpoints for document registration, verification, and certification.

## Authentication
Authentication is required for most endpoints and is managed via session-based cookies (Passport.js) or API Keys for service-level access.
- **Session Auth**: Used by the frontend. Requires a valid login.
- **API Key**: Include `x-api-key: {YOUR_KEY}` in the request headers for programmatic access.

## Endpoints Overview

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| POST   | `/api/upload` | Upload a single document for registration. | Yes |
| POST   | `/api/upload/batch-upload` | Upload multiple documents in a single request. | Yes (API Key) |
| GET    | `/api/upload/status/:job_id` | Check the status of a queued upload job. | Yes |
| POST   | `/api/verify` | Perform a deep verification of a file against a record. | Yes |
| GET    | `/api/verify/public/verify/:hash` | Publicly verify a document by its block hash. | No |
| GET    | `/api/verify/public/verify/qr/:id` | Publicly verify a document via QR-encoded ID. | No |
| GET    | `/api/verify/:id/proof` | Download the JSON cryptographic proof for a document. | Yes |
| GET    | `/api/chain/document/:id` | Retrieve detailed metadata for a specific document. | Yes |
| GET    | `/api/chain/document/:id/certified` | Download a digitally signed and certified PDF. | Yes (Authority) |

## Document Upload

### Single Upload
Registers a document in the vault. Processes file via an asynchronous queue.

**Endpoint:** `POST /api/upload`

**Request Body (form-data):**
- `file`: The document file (PDF, PNG, JPG, etc.)
- `department`: (Optional) Department name to lock the document to.
- `parent_document_id`: (Optional) ID of the document this is a version of.
- `version_note`: (Optional) Description of the changes in this version.

**Response:**
```json
{
  "success": true,
  "message": "Document upload received and queued for secure processing.",
  "job_id": "123",
  "filename": "report.pdf",
  "status": "processing",
  "version_number": 1
}
```

### Batch Upload
Registers multiple documents simultaneously.

**Endpoint:** `POST /api/upload/batch-upload`

**Request Headers:**
- `x-api-key`: Valid service API key.

**Request Body (form-data):**
- `files`: Multiple file fields.
- `department`: (Optional) Department name.

**Response:**
```json
{
  "batch_id": 1678901234567,
  "total_files": 5,
  "job_ids": ["124", "125", "126", "127", "128"],
  "status": "queued"
}
```

## Verification

### Deep Verification
Compares an uploaded file against a registered record using hash, OCR, and forensics.

**Endpoint:** `POST /api/verify`

**Request Body (form-data):**
- `file`: The document to verify.
- `document_id`: (Optional) Specific ID to verify against.

**Response:**
```json
{
  "status": "valid",
  "verdict": "ORIGINAL",
  "document_id": 10,
  "signature_status": "VERIFIED",
  "ocr_similarity_score": 98.5,
  "ai_report": {
    "summary": "Official certificate issued to...",
    "integrity_analysis": "No anomalies found."
  }
}
```

## Certification

### Download Certified PDF
Generates a PDF container (if original was image), signs it with the authority certificate, and embeds proof metadata.

**Endpoint:** `GET /api/chain/document/:id/certified`

**Auth Required:** Authority role only.

**Response:** Binary PDF stream.

## Error Codes
- `400 Bad Request`: Missing required fields or invalid file type.
- `403 Forbidden`: Insufficient permissions (e.g., trying to version a document you don't own).
- `404 Not Found`: Document or job not found.
- `409 Conflict`: Duplicate document content already registered by the user.
- `503 Service Unavailable`: Database or queue connection issues.
