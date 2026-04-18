require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = express();
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('./utils/passport');
const apiKey = require('./middleware/apiKey');

app.use((req, res, next) => {
  console.log("REQUEST_RECEIVED:", req.method, req.url);
  next();
});

app.use(cors());
app.use(express.json());

// Session Configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'dover_vault_secret',
    resave: false,
    saveUninitialized: false,
    store: (MongoStore.create || MongoStore.default.create)({
        mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/docvault'
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
}));

app.use(passport.initialize());
app.use(passport.session());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'public')));

const uploadRoutes = require('./routes/upload');
const verifyRoutes = require('./routes/verify');
const chainRoutes = require('./routes/chain');
const statsRoutes = require('./routes/stats');
const authRoutes = require('./routes/auth');
const { requireAuth } = require('./middleware/auth');

app.use('/auth', authRoutes);

// Apply requireAuth + apiKey to sensitive routes
app.use('/api/upload', requireAuth, apiKey, uploadRoutes);
app.use('/api/verify', (req, res, next) => {
    // Apply requireAuth and apiKey only to POST /api/verify or GET /api/verify/:id/proof
    if (req.method === 'POST' || req.path.endsWith('/proof')) {
        return requireAuth(req, res, () => apiKey(req, res, next));
    }
    next();
}, verifyRoutes);
app.use('/api/chain', requireAuth, chainRoutes);
app.use('/api/stats', requireAuth, statsRoutes);

// SPA fallback: serve index.html for any non-API route
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
    }
});

// ── Background Integrity Watcher ──
// Automatically checks files every 30 seconds to detect tampering
const db = require('./db/db');
const hasher = require('./utils/hasher');
const { getBucket } = require('./db/mongodb');

setInterval(async () => {
    const bucket = getBucket();
    if (!bucket) return; // Wait for connection

    try {
        const docs = db.prepare(`
            SELECT * FROM documents 
            WHERE is_tampered = 0 
            ORDER BY last_checked_at ASC NULLS FIRST
            LIMIT 50
        `).all();

        for (const doc of docs) {
            // Update last_checked_at timestamp immediately so we don't retry failed/legacy ones forever
            db.prepare("UPDATE documents SET last_checked_at = datetime('now') WHERE block_index = ?").run(doc.block_index);

            const storageId = doc.storage_id || doc.filename;
            // Skip legacy local files that aren't valid MongoDB ObjectIds (24 hex chars)
            if (!/^[0-9a-fA-F]{24}$/.test(storageId)) continue;

            let tmpPath = path.resolve('tmp', `bg_verify_${doc.block_index}`);
            try {
                // Reconstruct from GridFS
                const downloadStream = bucket.openDownloadStream(new (require('mongoose')).Types.ObjectId(storageId));
                const writeStream = fs.createWriteStream(tmpPath);
                downloadStream.pipe(writeStream);

                await new Promise((resolve, reject) => {
                    writeStream.on('finish', resolve);
                    writeStream.on('error', reject);
                });

                const verification = hasher.verifyDocument(doc.block_index, db, tmpPath);
                if (!verification.valid) {
                    db.prepare('UPDATE documents SET is_tampered = 1 WHERE block_index = ?').run(doc.block_index);
                    db.prepare(`INSERT INTO audit_log (document_id, action, actor, details) VALUES (?, ?, ?, ?)`)
                      .run(doc.block_index, 'TAMPER_DETECTED', 'BG_WATCHER', `Automated sweep detected file modification.`);
                }
                
                if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
            } catch (err) {
                // If file is missing in GridFS, it's a real tamper/deletion
                if (err.code !== 'ENOENT') {
                    console.error(`[BG_WATCHER] Error verifying block #${doc.block_index}:`, err.message);
                }
                if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
            }
        }
    } catch (e) {
        // Silently handle database busy errors
    }
}, 30000); // Increased to 30s to reduce load

// ── Batch Queue Processor ──
const { initProcessor } = require('./utils/processor');
initProcessor();

// ── Polyglot OCR Workers ──
const ocr = require('./utils/ocr');
ocr.initWorkers();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
