const documentQueue = require('./queue');
const db = require('../db/db');
const hasher = require('./hasher');
const ocr = require('./ocr');
const forensics = require('./forensics');
const gemini = require('./gemini');
const signature = require('./signature');
const { buildMerkleTree, getMerkleProof } = require('./merkle');
const qr = require('./qr');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getBucket } = require('../db/mongodb');
const { Worker } = require('worker_threads');
const { anchorBatch } = require('./polygon');

/**
 * Helper to run heavy analysis in a separate thread.
 */
function analyzeInWorker(filePath, type) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(path.join(__dirname, 'analysis_worker.js'), {
            workerData: { filePath, type }
        });
        worker.on('message', (msg) => {
            if (msg.success) resolve(msg.data);
            else reject(new Error(msg.error));
        });
        worker.on('error', reject);
        worker.on('exit', (code) => {
            if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
        });
    });
}

let isInitialized = false;

function initProcessor() {
    if (isInitialized) return;
    isInitialized = true;

    documentQueue.process(1, async (job) => {
        const { filePath, originalname, mimetype, uploadedBy, uploaderEmail, department, parent_document_id, version_number, version_note } = job.data;

        try {
            // Validate file exists
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            const bucket = getBucket();
            if (!bucket) {
                throw new Error('MongoDB connection not ready');
            }

            // ── Step 1: Upload to GridFS (0→25%) ──
            await job.progress(0);

            const uploadStream = bucket.openUploadStream(originalname, {
                contentType: mimetype
            });
            const gridfsId = uploadStream.id.toString();

            await new Promise((resolve, reject) => {
                fs.createReadStream(filePath)
                    .pipe(uploadStream)
                    .on('error', reject)
                    .on('finish', resolve);
            });

            await job.progress(25);

            // ── Step 2: Generate Hashes (25→50%) ──
            const fileHash = job.data.fileHash || await hasher.generateFileHashAsync(filePath);
            const prevHash = hasher.getLastBlockHash(db);
            const timestamp = new Date().toISOString();
            const blockHash = hasher.generateBlockHash(fileHash, prevHash, timestamp);

            // ── Step 2.7: Merkle Tree Integration ──
            // Fetch all existing block_hashes to build the global Merkle Root
            const existingHashes = db.prepare('SELECT block_hash FROM documents ORDER BY block_index ASC').all().map(d => d.block_hash);
            const allHashes = [...existingHashes, blockHash];
            
            const merkleTree = buildMerkleTree(allHashes);
            const merkleRoot = merkleTree.root;
            const merkleProof = getMerkleProof(allHashes, allHashes.length - 1);

            // ── Step 2.5: Digital Signature ──
            let documentSignature = null;
            if (process.env.PRIVATE_KEY_B64) {
                try {
                    const privateKey = Buffer.from(process.env.PRIVATE_KEY_B64, 'base64').toString('utf8');
                    const sign = crypto.createSign('SHA256');
                    sign.update(blockHash);
                    documentSignature = sign.sign(privateKey, 'hex');
                } catch (sigError) {
                    console.error('[PROCESSOR] Signature generation failed:', sigError.message);
                }
            }

            // ── Step 3: AI Analysis — OCR, Forensics, Signature (50→75%) ──
            let ocrText = null;
            let ocrHash = null;
            let forensicScore = null;
            let signatureScore = null;
            let aiSummary = null;

            if (/png|jpg|jpeg/.test(mimetype)) {
                // OCR stays on main (it's mostly I/O waiting for the Tesseract process)
                ocrText = await ocr.extractText(filePath);
                if (ocrText) ocrHash = crypto.createHash('sha256').update(ocrText).digest('hex');

                // Forensics and Signature offloaded to Worker Thread
                const forensicReport = await analyzeInWorker(filePath, 'forensics');
                const sigReport = await analyzeInWorker(filePath, 'signature');

                if (!sigReport.signature_found) {
                    forensicReport.flags.push('No signature detected in typical signing areas');
                }

                forensicScore = JSON.stringify(forensicReport);
                signatureScore = JSON.stringify(sigReport);

                // Gemini Intelligence Analysis
                if (ocrText) {
                    const summary = await gemini.generateDocumentSummary(ocrText, forensicReport);
                    aiSummary = JSON.stringify(summary);
                }
            }

            await job.progress(75);

            // ── Step 4: Store in SQLite + Audit Log (75→100%) ──
            // Final Duplicate Check (Atomic within processor concurrency=1)
            // ONLY if NOT a version update
            if (!parent_document_id) {
                // NEW: Check by file_hash AND uploaderEmail
                const finalExisting = db.prepare('SELECT block_index, filename, upload_timestamp FROM documents WHERE file_hash = ? AND uploader_email = ?').get(fileHash, uploaderEmail);
                if (finalExisting) {
                    console.log(`[PROCESSOR] ⚠ Skipping duplicate content: ${originalname} matches Block #${finalExisting.block_index}`);
                    if (fs.existsSync(filePath)) {
                        try { fs.unlinkSync(filePath); } catch (e) {}
                    }
                    return { 
                        success: false, 
                        error: 'Duplicate', 
                        existing_id: finalExisting.block_index, 
                        existing_filename: finalExisting.filename,
                        uploaded_at: finalExisting.upload_timestamp,
                        filename: originalname 
                    };
                }
            }

            const insertDoc = db.prepare(`
                INSERT INTO documents (filename, file_type, uploaded_by, uploader_email, department, upload_timestamp, file_hash, prev_hash, block_hash, ocr_text, ocr_hash, forensic_score, signature_score, storage_id, signature, merkle_root, merkle_proof, parent_document_id, version_number, version_note, ai_summary)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const result = insertDoc.run(originalname, mimetype, uploadedBy, uploaderEmail, department, timestamp, fileHash, prevHash, blockHash, ocrText, ocrHash, forensicScore, signatureScore, gridfsId, documentSignature, merkleRoot, JSON.stringify(merkleProof), parent_document_id, version_number || 1, version_note, aiSummary);
            const documentId = result.lastInsertRowid;

            // ── Step 4.5: Update Global Merkle Root ──
            // The Merkle Root represents the entire chain state; it must be updated globally
            db.prepare('UPDATE documents SET merkle_root = ?').run(merkleRoot);

            // ── Step 5: Periodic Checkpointing ──
            // Every 100 blocks, we record the block_hash as a checkpoint
            if (documentId % 100 === 0) {
                db.prepare('UPDATE documents SET checkpoint_hash = ? WHERE block_index = ?').run(blockHash, documentId);
                console.log(`[PROCESSOR] ⚐ Checkpoint created at Block #${documentId}`);
            }

            // ── Step 5.5: Polygon Anchoring (Every 10 blocks) ──
            if (documentId % 10 === 0) {
                console.log(`[PROCESSOR] ⛓ Reached 10-block boundary (#${documentId}). Triggering Polygon anchor...`);
                try {
                    // Fetch the last 10 block hashes
                    const batch = db.prepare('SELECT block_hash FROM documents ORDER BY block_index DESC LIMIT 10').all();
                    const batchHashes = batch.map(b => b.block_hash).reverse();
                    
                    const batchMerkle = buildMerkleTree(batchHashes);
                    const batchRoot = batchMerkle.root;
                    
                    const polygonTxid = await anchorBatch(batchRoot, {
                        startBlock: documentId - 9,
                        endBlock: documentId,
                        batchSize: 10
                    });

                    if (polygonTxid) {
                        const updateStmt = db.prepare('UPDATE documents SET polygon_txid = ? WHERE block_index > ? AND block_index <= ?');
                        updateStmt.run(polygonTxid, documentId - 10, documentId);
                        console.log(`[PROCESSOR] ✓ Batch #${documentId/10} anchored to Polygon. TXID: ${polygonTxid}`);
                    }
                } catch (anchorErr) {
                    console.error('[PROCESSOR] Polygon anchoring trigger failed:', anchorErr.message);
                }
            }

            db.prepare(`INSERT INTO audit_log (document_id, action, actor, details) VALUES (?, ?, ?, ?)`)
                .run(documentId, 'UPLOAD', uploadedBy, `File ${originalname} processed via batch queue`);

            // Cleanup temp file ONLY on success
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                } catch (unlinkError) {
                    console.warn(`[PROCESSOR] Failed to cleanup temp file: ${filePath}`, unlinkError.message);
                }
            }

            await job.progress(100);

            console.log(`[PROCESSOR] ✓ Job #${job.id} completed → Block #${documentId} (${originalname})`);

            // Generate QR code for the public verification portal
            const qrData = `http://localhost:3000/verify.html?id=${documentId}`;
            const qrImageBase64 = await qr.generateQR(qrData);

            return {
                success: true,
                document_id: documentId,
                block_hash: blockHash,
                gridfs_id: gridfsId,
                filename: originalname,
                qr_image_base64: qrImageBase64,
                version_number: version_number || 1,
                parent_document_id: parent_document_id
            };

        } catch (error) {
            // Cleanup temp file on failure ONLY if we have no more attempts
            const attemptsMade = job.attemptsMade || 0;
            const maxAttempts = job.opts.attempts || 1;
            
            if (attemptsMade + 1 >= maxAttempts) {
                if (fs.existsSync(filePath)) {
                    try {
                        fs.unlinkSync(filePath);
                    } catch (e) {}
                }
            }
            
            console.error(`[PROCESSOR] ✗ Job #${job.id} failed (${originalname}):`, error.message);
            throw error; // Bull marks the job as failed
        }
    });

    documentQueue.on('completed', (job, result) => {
        console.log(`[QUEUE] Job #${job.id} completed:`, result.filename);
    });

    documentQueue.on('failed', (job, err) => {
        console.error(`[QUEUE] Job #${job.id} failed:`, err.message);
    });

    console.log('[PROCESSOR] Queue processor initialized (concurrency: 1)');
}

module.exports = { initProcessor };
