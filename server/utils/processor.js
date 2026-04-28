const documentQueue = require('./queue');
const db = require('../db/db');
const hasher = require('./hasher');
const ocr = require('./ocr');
const forensics = require('./forensics');
const gemini = require('./vertex_gemini');
const signature = require('./signature');
const { buildMerkleTree, getMerkleProof } = require('./merkle');
const qr = require('./qr');
const crypto = require('crypto');
const forge = require('node-forge');
const fs = require('fs');
const path = require('path');
const { getBucket, mongoose } = require('../db/mongodb');
const { Worker } = require('worker_threads');
const { anchorBatch } = require('./polygon');
const ipfs = require('./ipfs');
const PKIUtils = require('./pki');

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
        return await processDocument(job.data, job);
    });

    documentQueue.on('completed', (job, result) => {
        console.log(`[QUEUE] Job #${job.id} completed:`, result?.filename || job.data?.originalname || 'unknown');
    });

    documentQueue.on('failed', (job, err) => {
        console.error(`[QUEUE] Job #${job.id} failed:`, err.message);
    });

    console.log('[PROCESSOR] Queue processor initialized (concurrency: 1)');
}

async function processDocument(data, job = null) {
    const { storageId, originalname = 'unknown_file', mimetype = 'application/octet-stream', uploadedBy, uploaderEmail, department, parent_document_id, version_number, version_note } = data;
    let filePath = data.filePath; // Legacy fallback
    let gridfsId = storageId;
    
    // Mock progress function if job is null (sync mode)
    const progress = async (p) => { 
        if (job && job.progress) await job.progress(p); 
        else console.log(`[SYNC_PROCESSOR] Progress: ${p}%`);
    };

    try {
        const bucket = getBucket();
        if (!bucket) {
            throw new Error('MongoDB connection not ready');
        }

        // ── Step 1: Download from GridFS (0→25%) ──
        await progress(10);
        
        if (gridfsId) {
            const ext = path.extname(originalname);
            filePath = path.resolve('tmp', `proc_${Date.now()}${ext}`);
            const writeStream = fs.createWriteStream(filePath);
            
            const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(gridfsId));
            downloadStream.pipe(writeStream);

            await new Promise((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });
        }

        if (!filePath || !fs.existsSync(filePath)) {
            throw new Error(`File not found for processing: ${filePath}`);
        }

        await progress(25);

        // ── Step 2: Generate Hashes (25→50%) ──
        const fileHash = data.fileHash || await hasher.generateFileHashAsync(filePath);
        const prevHash = hasher.getLastBlockHash(db);
        const timestamp = new Date().toISOString();
        const blockHash = hasher.generateBlockHash(fileHash, prevHash, timestamp);

        // ── Step 2.7: Merkle Tree Integration ──
        const lastHashes = db.prepare('SELECT block_hash FROM documents ORDER BY block_index DESC LIMIT 99').all().map(d => d.block_hash).reverse();
        const allHashes = [...lastHashes, blockHash];
        
        const merkleTree = buildMerkleTree(allHashes);
        const merkleRoot = merkleTree.root;
        const merkleProof = getMerkleProof(allHashes, allHashes.length - 1);

        // ── Step 2.5: Digital Signature ──
        let documentSignature = null;
        let signerFingerprint = null;

        const user = db.prepare('SELECT id FROM users WHERE email = ?').get(uploaderEmail);
        const activeKey = user ? db.prepare("SELECT * FROM key_registry WHERE issuer_id = ? AND status = 'active'").get(user.id) : null;

        if (activeKey) {
            try {
                const certsDir = path.resolve(__dirname, '..', '..', 'certs');
                const p12Path = path.join(certsDir, `${activeKey.fingerprint}.p12`);
                const pwdPath = path.join(certsDir, `${activeKey.fingerprint}.pwd`);

                if (fs.existsSync(p12Path) && fs.existsSync(pwdPath)) {
                    const p12Buffer = fs.readFileSync(p12Path);
                    const encryptedPassword = fs.readFileSync(pwdPath, 'utf8');
                    const password = PKIUtils.decryptData(encryptedPassword);

                    if (password) {
                        const asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'));
                        const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);
                        const bags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
                        const privateKey = bags[forge.pki.oids.pkcs8ShroudedKeyBag][0].key;

                        const sign = crypto.createSign('SHA256');
                        sign.update(blockHash);
                        const privateKeyPem = forge.pki.privateKeyToPem(privateKey);
                        documentSignature = sign.sign(privateKeyPem, 'hex');
                        signerFingerprint = activeKey.fingerprint;
                    }
                }
            } catch (sigError) {
                console.error('[PROCESSOR] Business signature failed:', sigError.message);
            }
        }

        if (!documentSignature && process.env.PRIVATE_KEY_B64) {
            try {
                const privateKey = Buffer.from(process.env.PRIVATE_KEY_B64, 'base64').toString('utf8');
                const sign = crypto.createSign('SHA256');
                sign.update(blockHash);
                documentSignature = sign.sign(privateKey, 'hex');
            } catch (e) {}
        }

        // ── Step 3: AI Analysis ──
        let ocrText = null;
        let ocrHash = null;
        let forensicScore = null;
        let signatureScore = null;
        let aiSummary = null;

        if (/png|jpg|jpeg/.test(mimetype)) {
            const ocrResult = await ocr.extractText(filePath);
            ocrText = ocrResult.text;
            if (ocrText) ocrHash = crypto.createHash('sha256').update(ocrText).digest('hex');

            const forensicReport = await analyzeInWorker(filePath, 'forensics');
            const sigReport = await analyzeInWorker(filePath, 'signature');

            forensicScore = JSON.stringify(forensicReport);
            signatureScore = JSON.stringify(sigReport);

            if (ocrText) {
                const summary = await gemini.generateDocumentSummary(ocrText, forensicReport);
                aiSummary = JSON.stringify(summary);
            }
        } else if (/text\/plain/.test(mimetype) || originalname?.endsWith('.txt')) {
            ocrText = fs.readFileSync(filePath, 'utf8');
            if (ocrText) ocrHash = crypto.createHash('sha256').update(ocrText).digest('hex');
            forensicScore = JSON.stringify({ score: 100, flags: [], analysis: 'Text verified.' });

            if (ocrText) {
                const summary = await gemini.generateDocumentSummary(ocrText, { score: 100, flags: [] });
                aiSummary = JSON.stringify(summary);
            }
        }

        await progress(75);

        // ── Step 4: Store in SQLite ──
        if (!parent_document_id) {
            const finalExisting = db.prepare('SELECT block_index FROM documents WHERE file_hash = ? AND uploader_email = ?').get(fileHash, uploaderEmail);
            if (finalExisting) {
                if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
                return { success: false, error: 'Duplicate', existing_id: finalExisting.block_index };
            }
        }

        const insertDoc = db.prepare(`
            INSERT INTO documents (filename, file_type, uploaded_by, uploader_email, department, upload_timestamp, file_hash, prev_hash, block_hash, ocr_text, ocr_hash, forensic_score, signature_score, storage_id, signature, signer_fingerprint, merkle_root, merkle_proof, parent_document_id, version_number, version_note, ai_summary)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = insertDoc.run(originalname, mimetype, uploadedBy, uploaderEmail, department, timestamp, fileHash, prevHash, blockHash, ocrText, ocrHash, forensicScore, signatureScore, gridfsId, documentSignature, signerFingerprint, merkleRoot, JSON.stringify(merkleProof), parent_document_id, version_number || 1, version_note, aiSummary);
        const documentId = result.lastInsertRowid;

        // ── IPFS Backup (Async) ──
        ipfs.uploadFile(filePath).then(cid => {
            if (cid) db.prepare('UPDATE documents SET ipfs_cid = ? WHERE block_index = ?').run(cid, documentId);
        }).catch(() => {});

        db.prepare(`INSERT INTO audit_log (document_id, action, actor, details) VALUES (?, ?, ?, ?)`)
            .run(documentId, 'UPLOAD', uploadedBy, `File ${originalname} processed ${job ? 'via queue' : 'instantly'}`);

        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);

        await progress(100);

        const qrData = `https://${process.env.DOMAIN || 'localhost:3000'}/verify.html?hash=${blockHash}`;
        const qrImageBase64 = await qr.generateQR(qrData);

        return {
            success: true,
            document_id: documentId,
            block_hash: blockHash,
            filename: originalname,
            qr_image_base64: qrImageBase64
        };

    } catch (error) {
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
        console.error(`[PROCESSOR] ✗ Processing failed:`, error.message);
        throw error; 
    }
}

module.exports = { initProcessor, processDocument };
