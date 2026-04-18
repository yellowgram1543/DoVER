# Graph Report - .  (2026-04-18)

## Corpus Check
- Large corpus: 71 files · ~596,290 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 135 nodes · 129 edges · 49 communities detected
- Extraction: 81% EXTRACTED · 19% INFERRED · 0% AMBIGUOUS · INFERRED: 24 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Frontend Application & Navigation|Frontend Application & Navigation]]
- [[_COMMUNITY_Backend Services & Security Infrastructure|Backend Services & Security Infrastructure]]
- [[_COMMUNITY_Document Processing Pipeline & Merkle Proofs|Document Processing Pipeline & Merkle Proofs]]
- [[_COMMUNITY_Receipt Image Concepts & Variants|Receipt Image Concepts & Variants]]
- [[_COMMUNITY_Task List & Todo Concepts|Task List & Todo Concepts]]
- [[_COMMUNITY_Blockchain Chaining & Hashing Utilities|Blockchain Chaining & Hashing Utilities]]
- [[_COMMUNITY_Merkle Tree Operations|Merkle Tree Operations]]
- [[_COMMUNITY_OCR & Text Analysis|OCR & Text Analysis]]
- [[_COMMUNITY_Image Forensics & Alignment|Image Forensics & Alignment]]
- [[_COMMUNITY_Receipt Document Variants|Receipt Document Variants]]
- [[_COMMUNITY_String Similarity Utilities|String Similarity Utilities]]
- [[_COMMUNITY_Cat Image Concepts|Cat Image Concepts]]
- [[_COMMUNITY_Image Modification Scripts|Image Modification Scripts]]
- [[_COMMUNITY_Cloud Tampering Simulation|Cloud Tampering Simulation]]
- [[_COMMUNITY_File System Tampering Simulation|File System Tampering Simulation]]
- [[_COMMUNITY_Image Tampering Simulation|Image Tampering Simulation]]
- [[_COMMUNITY_API Key Authentication Middleware|API Key Authentication Middleware]]
- [[_COMMUNITY_API Key Generation|API Key Generation]]
- [[_COMMUNITY_Cryptographic Key Generation|Cryptographic Key Generation]]
- [[_COMMUNITY_Document Processor Core|Document Processor Core]]
- [[_COMMUNITY_Signature Detection Utilities|Signature Detection Utilities]]
- [[_COMMUNITY_Proof of Authenticity & Chaining|Proof of Authenticity & Chaining]]
- [[_COMMUNITY_Receipt Modification Pairs|Receipt Modification Pairs]]
- [[_COMMUNITY_Cat Image Tampering Pairs|Cat Image Tampering Pairs]]
- [[_COMMUNITY_Module graphify_out_detect_py|Module: graphify_out_detect_py]]
- [[_COMMUNITY_Module server_app_js|Module: server_app_js]]
- [[_COMMUNITY_Module server_db_db_js|Module: server_db_db_js]]
- [[_COMMUNITY_Module server_db_migrate_forensics_js|Module: server_db_migrate_forensics_js]]
- [[_COMMUNITY_Module server_db_migrate_merkle_js|Module: server_db_migrate_merkle_js]]
- [[_COMMUNITY_Module server_db_migrate_ocr_js|Module: server_db_migrate_ocr_js]]
- [[_COMMUNITY_Module server_db_migrate_signature_js|Module: server_db_migrate_signature_js]]
- [[_COMMUNITY_Module server_db_migrate_storage_id_js|Module: server_db_migrate_storage_id_js]]
- [[_COMMUNITY_Module server_db_migrate_versions_js|Module: server_db_migrate_versions_js]]
- [[_COMMUNITY_Module server_db_migrate_watcher_js|Module: server_db_migrate_watcher_js]]
- [[_COMMUNITY_Module server_db_mongodb_js|Module: server_db_mongodb_js]]
- [[_COMMUNITY_Module server_routes_chain_js|Module: server_routes_chain_js]]
- [[_COMMUNITY_Module server_routes_stats_js|Module: server_routes_stats_js]]
- [[_COMMUNITY_Module server_routes_upload_js|Module: server_routes_upload_js]]
- [[_COMMUNITY_Module server_routes_verify_js|Module: server_routes_verify_js]]
- [[_COMMUNITY_Module server_utils_qr_js|Module: server_utils_qr_js]]
- [[_COMMUNITY_Module server_utils_queue_js|Module: server_utils_queue_js]]
- [[_COMMUNITY_Module api_key_auth|Module: api_key_auth]]
- [[_COMMUNITY_Module api_verifyDocument|Module: api_verifyDocument]]
- [[_COMMUNITY_Module doc_mcp_tools|Module: doc_mcp_tools]]
- [[_COMMUNITY_Module cat2_cat|Module: cat2_cat]]
- [[_COMMUNITY_Module food_image_indian_food|Module: food_image_indian_food]]
- [[_COMMUNITY_Module tampered_pixel_pizza|Module: tampered_pixel_pizza]]
- [[_COMMUNITY_Module test_b64_pizza|Module: test_b64_pizza]]
- [[_COMMUNITY_Module test_final_kitten|Module: test_final_kitten]]

## God Nodes (most connected - your core abstractions)
1. `navigate()` - 9 edges
2. `initProcessor` - 7 edges
3. `Lorem Shop` - 6 edges
4. `Receipt` - 6 edges
5. `Document Processing Queue` - 5 edges
6. `Lorem Shop Receipt` - 5 edges
7. `To Do List Hello Mango` - 5 edges
8. `renderStatsBar()` - 4 edges
9. `renderDashboard()` - 4 edges
10. `renderChain()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `OCR Service` --semantically_similar_to--> `Jimp (Image Manipulation)`  [INFERRED] [semantically similar]
  server/utils/ocr.js → create_modified_ocr.js
- `The Sovereign Archive Design System` --rationale_for--> `uploadDocument`  [INFERRED]
  uploads/1775405458397-DESIGN.txt → src/services/api.js
- `Modified Lorem Shop Receipt` --semantically_similar_to--> `Lorem Shop Receipt`  [INFERRED] [semantically similar]
  modified.png → alice_test.png
- `Obscured Cat Stretching` --semantically_similar_to--> `Cat Stretching`  [INFERRED] [semantically similar]
  tampered_cat.jpg → original_cat.jpg
- `Lorem Shop Receipt` --semantically_similar_to--> `Lorem Shop Receipt`  [INFERRED] [semantically similar]
  test_parallel_final.png → test_p_final.png

## Hyperedges (group relationships)
- **Integrity Verification Engine** — hasher_util, ocr_service, forensics_service, signature_service, merkle_util [EXTRACTED 0.95]
- **Hybrid Distributed Storage** — sqlite_ledger, mongodb_gridfs, sha256_chaining [EXTRACTED 0.90]
- **Document Processing Pipeline** — processor_initProcessor, ocr_extractText, signature_detectSignature, merkle_buildMerkleTree, qr_generateQR [EXTRACTED 0.90]
- **Lorem Shop Receipts** — tampered_test_receipt, test_receipt, test2_receipt, test_parallel_receipt [INFERRED 0.90]

## Communities

### Community 0 - "Frontend Application & Navigation"
Cohesion: 0.18
Nodes (14): getChain(), getStats(), loadAudit(), loadChain(), navigate(), renderAudit(), renderBatch(), renderChain() (+6 more)

### Community 1 - "Backend Services & Security Infrastructure"
Cohesion: 0.21
Nodes (12): Background Integrity Watcher, Document Processing Queue, Document Versioning System, Forensics Service, Forgery Simulation (Tamper), Hasher Utility, Jimp (Image Manipulation), Merkle Tree Utility (+4 more)

### Community 2 - "Document Processing Pipeline & Merkle Proofs"
Cohesion: 0.2
Nodes (11): uploadDocument, The Sovereign Archive Design System, buildMerkleTree, getMerkleProof, hashPair, verifyMerkleProof, extractText, initProcessor (+3 more)

### Community 3 - "Receipt Image Concepts & Variants"
Cohesion: 0.54
Nodes (8): Lorem Shop, Receipt, Lorem Shop Receipt, Lorem Shop Receipt, Lorem Shop Receipt, Lorem Shop Receipt, Lorem Shop Receipt, Lorem Shop Receipt

### Community 4 - "Task List & Todo Concepts"
Cohesion: 0.73
Nodes (6): To Do List, Task: Hello, Task: Mango, To Do List Hello Mango, To Do List Hello Mango, To Do List Hello Mango

### Community 5 - "Blockchain Chaining & Hashing Utilities"
Cohesion: 0.6
Nodes (3): generateBlockHash(), generateFileHash(), verifyDocument()

### Community 6 - "Merkle Tree Operations"
Cohesion: 0.7
Nodes (4): buildMerkleTree(), getMerkleProof(), hashPair(), verifyMerkleProof()

### Community 7 - "OCR & Text Analysis"
Cohesion: 0.6
Nodes (3): calculateSimilarity(), levenshteinDistance(), normalizeText()

### Community 8 - "Image Forensics & Alignment"
Cohesion: 0.83
Nodes (3): alignmentCheck(), analyzeImage(), fontConsistencyCheck()

### Community 9 - "Receipt Document Variants"
Cohesion: 0.5
Nodes (4): Censored Receipt, Duplicate Receipt, Parallel Receipt, Original Receipt

### Community 10 - "String Similarity Utilities"
Cohesion: 0.67
Nodes (3): calculateSimilarity, levenshteinDistance, normalizeText

### Community 11 - "Cat Image Concepts"
Cohesion: 1.0
Nodes (3): Cat, Four Cats Walking, Cat in Basket

### Community 12 - "Image Modification Scripts"
Cohesion: 1.0
Nodes (0): 

### Community 13 - "Cloud Tampering Simulation"
Cohesion: 1.0
Nodes (0): 

### Community 14 - "File System Tampering Simulation"
Cohesion: 1.0
Nodes (0): 

### Community 15 - "Image Tampering Simulation"
Cohesion: 1.0
Nodes (0): 

### Community 16 - "API Key Authentication Middleware"
Cohesion: 1.0
Nodes (0): 

### Community 17 - "API Key Generation"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "Cryptographic Key Generation"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "Document Processor Core"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "Signature Detection Utilities"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "Proof of Authenticity & Chaining"
Cohesion: 1.0
Nodes (2): JSON Proof of Authenticity, SHA-256 Block Chaining

### Community 22 - "Receipt Modification Pairs"
Cohesion: 1.0
Nodes (2): Lorem Shop Receipt, Modified Lorem Shop Receipt

### Community 23 - "Cat Image Tampering Pairs"
Cohesion: 1.0
Nodes (2): Cat Stretching, Obscured Cat Stretching

### Community 24 - "Module: graphify_out_detect_py"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Module: server_app_js"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Module: server_db_db_js"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Module: server_db_migrate_forensics_js"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Module: server_db_migrate_merkle_js"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Module: server_db_migrate_ocr_js"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Module: server_db_migrate_signature_js"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Module: server_db_migrate_storage_id_js"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Module: server_db_migrate_versions_js"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Module: server_db_migrate_watcher_js"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Module: server_db_mongodb_js"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Module: server_routes_chain_js"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Module: server_routes_stats_js"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Module: server_routes_upload_js"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Module: server_routes_verify_js"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Module: server_utils_qr_js"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Module: server_utils_queue_js"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Module: api_key_auth"
Cohesion: 1.0
Nodes (1): API Key Middleware

### Community 42 - "Module: api_verifyDocument"
Cohesion: 1.0
Nodes (1): verifyDocument

### Community 43 - "Module: doc_mcp_tools"
Cohesion: 1.0
Nodes (1): MCP Tools: code-review-graph

### Community 44 - "Module: cat2_cat"
Cohesion: 1.0
Nodes (1): Cat Face Close-up

### Community 45 - "Module: food_image_indian_food"
Cohesion: 1.0
Nodes (1): Indian Food Spread

### Community 46 - "Module: tampered_pixel_pizza"
Cohesion: 1.0
Nodes (1): Pizza

### Community 47 - "Module: test_b64_pizza"
Cohesion: 1.0
Nodes (1): Pizza Slice

### Community 48 - "Module: test_final_kitten"
Cohesion: 1.0
Nodes (1): Sleeping Kitten

## Knowledge Gaps
- **28 isolated node(s):** `Signature Detection Service`, `Merkle Tree Utility`, `API Key Middleware`, `SHA-256 Block Chaining`, `Document Versioning System` (+23 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Image Modification Scripts`** (2 nodes): `create_modified_ocr.js`, `modifyImage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Cloud Tampering Simulation`** (2 nodes): `hackCloud()`, `tamper_cloud.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `File System Tampering Simulation`** (2 nodes): `hackAnything()`, `tamper_files_cloud.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Image Tampering Simulation`** (2 nodes): `tamper_image.js`, `tamper()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `API Key Authentication Middleware`** (2 nodes): `apiKeyMiddleware()`, `apiKey.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `API Key Generation`** (2 nodes): `generateApiKey()`, `generateApiKey.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Cryptographic Key Generation`** (2 nodes): `generateKeys()`, `generateKeys.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Document Processor Core`** (2 nodes): `initProcessor()`, `processor.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Signature Detection Utilities`** (2 nodes): `signature.js`, `detectSignature()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Proof of Authenticity & Chaining`** (2 nodes): `JSON Proof of Authenticity`, `SHA-256 Block Chaining`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Receipt Modification Pairs`** (2 nodes): `Lorem Shop Receipt`, `Modified Lorem Shop Receipt`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Cat Image Tampering Pairs`** (2 nodes): `Cat Stretching`, `Obscured Cat Stretching`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: graphify_out_detect_py`** (1 nodes): `detect.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: server_app_js`** (1 nodes): `app.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: server_db_db_js`** (1 nodes): `db.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: server_db_migrate_forensics_js`** (1 nodes): `migrate_forensics.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: server_db_migrate_merkle_js`** (1 nodes): `migrate_merkle.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: server_db_migrate_ocr_js`** (1 nodes): `migrate_ocr.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: server_db_migrate_signature_js`** (1 nodes): `migrate_signature.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: server_db_migrate_storage_id_js`** (1 nodes): `migrate_storage_id.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: server_db_migrate_versions_js`** (1 nodes): `migrate_versions.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: server_db_migrate_watcher_js`** (1 nodes): `migrate_watcher.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: server_db_mongodb_js`** (1 nodes): `mongodb.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: server_routes_chain_js`** (1 nodes): `chain.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: server_routes_stats_js`** (1 nodes): `stats.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: server_routes_upload_js`** (1 nodes): `upload.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: server_routes_verify_js`** (1 nodes): `verify.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: server_utils_qr_js`** (1 nodes): `qr.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: server_utils_queue_js`** (1 nodes): `queue.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: api_key_auth`** (1 nodes): `API Key Middleware`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: api_verifyDocument`** (1 nodes): `verifyDocument`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: doc_mcp_tools`** (1 nodes): `MCP Tools: code-review-graph`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: cat2_cat`** (1 nodes): `Cat Face Close-up`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: food_image_indian_food`** (1 nodes): `Indian Food Spread`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: tampered_pixel_pizza`** (1 nodes): `Pizza`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: test_b64_pizza`** (1 nodes): `Pizza Slice`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: test_final_kitten`** (1 nodes): `Sleeping Kitten`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Are the 5 inferred relationships involving `Document Processing Queue` (e.g. with `Hasher Utility` and `OCR Service`) actually correct?**
  _`Document Processing Queue` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Signature Detection Service`, `Merkle Tree Utility`, `API Key Middleware` to the rest of the system?**
  _28 weakly-connected nodes found - possible documentation gaps or missing edges._