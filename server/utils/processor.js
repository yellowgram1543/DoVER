const documentQueue = require('./queue');
const db = require('../db/db');
const hasher = require('./hasher');
const ocr = require('./ocr');
const forensics = require('./forensics');
const signature = require('./signature');
const { buildMerkleTree, getMerkleProof } = require('./merkle');
const qr = require('./qr');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getBucket } = require('../db/mongodb');

let isInitialized = false;

function initProcessor() {
    if (isInitialized) return;
    isInitialized = true;

    documentQueue.process(1, async (job) => {
        const { filePath, originalname, mimetype, uploadedBy } = job.data;

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
            const fileHash = hasher.generateFileHash(filePath);
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
                    console.log('Signed block_hash:', blockHash);
                    console.log('Signature first 20:', documentSignature.substring(0, 20));
                } catch (sigError) {
                    console.error('[PROCESSOR] Signature generation failed:', sigError.message);
                }
            }

            await job.progress(50);

            // ── Step 3: AI Analysis — OCR, Forensics, Signature (50→75%) ──
            let ocrText = null;
            let ocrHash = null;
            let forensicScore = null;
            let signatureScore = null;

            if (/png|jpg|jpeg/.test(mimetype)) {
                ocrText = await ocr.extractText(filePath);
                if (ocrText) ocrHash = crypto.createHash('sha256').update(ocrText).digest('hex');

                const forensicReport = await forensics.analyzeImage(filePath);
                const sigReport = await signature.detectSignature(filePath);

                if (!sigReport.signature_found) {
                    forensicReport.flags.push('No signature detected in typical signing areas');
                }

                forensicScore = JSON.stringify(forensicReport);
                signatureScore = JSON.stringify(sigReport);
            }

            await job.progress(75);

            // ── Step 4: Store in SQLite + Audit Log (75→100%) ──
            // Final Duplicate Check (Atomic within processor concurrency=1)
            const finalExisting = db.prepare('SELECT block_index FROM documents WHERE filename = ? AND uploaded_by = ?').get(originalname, uploadedBy);
            if (finalExisting) {
                console.log(`[PROCESSOR] ⚠ Skipping duplicate document: ${originalname} for ${uploadedBy}`);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                return { success: false, error: 'Duplicate', existing_id: finalExisting.block_index };
            }

            const insertDoc = db.prepare(`
                INSERT INTO documents (filename, file_type, uploaded_by, upload_timestamp, file_hash, prev_hash, block_hash, ocr_text, ocr_hash, forensic_score, signature_score, storage_id, signature, merkle_root, merkle_proof)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const result = insertDoc.run(originalname, mimetype, uploadedBy, timestamp, fileHash, prevHash, blockHash, ocrText, ocrHash, forensicScore, signatureScore, gridfsId, documentSignature, merkleRoot, JSON.stringify(merkleProof));
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

            db.prepare(`INSERT INTO audit_log (document_id, action, actor, details) VALUES (?, ?, ?, ?)`)
                .run(documentId, 'UPLOAD', uploadedBy, `File ${originalname} processed via batch queue`);

            // Cleanup temp file
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

            await job.progress(100);

            console.log(`[PROCESSOR] ✓ Job #${job.id} completed → Block #${documentId} (${originalname})`);

            // Generate QR code for the public verification portal
            const qrData = `http://localhost:3000/verify.html?id=${documentId}`;
            const qrImageBase64 = await qr.generateQR(qrData);

            return {
                document_id: documentId,
                block_hash: blockHash,
                gridfs_id: gridfsId,
                filename: originalname,
                qr_image_base64: qrImageBase64
            };

        } catch (error) {
            // Cleanup temp file on failure
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
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
