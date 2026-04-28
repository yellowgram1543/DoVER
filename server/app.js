require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('./utils/passport');
const apiKey = require('./middleware/apiKey');
const { rateLimit } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { createClient } = require('redis');
const nonceMiddleware = require('./middleware/nonce');
const blocklist = require('./middleware/blocklist');
const hmacMiddleware = require('./middleware/hmac');
const db = require('./db/db');
const PKIUtils = require('./utils/pki');

const app = express();
app.set('trust proxy', 1);

// Redis Client for Rate Limiting
const redisClient = createClient({ 
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    socket: { connectTimeout: 5000 } // 5 second timeout to prevent hangs
});

redisClient.on('error', (err) => console.warn('[REDIS_ERROR] Offline — falling back to memory:', err.message));
redisClient.connect().catch(err => console.warn('[REDIS_CONNECT_FAIL] Moving on without Redis.'));

// Global IP Blocklist
app.use(blocklist);

// Global Rate Limiter: 100 requests per 15 minutes
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    validate: { keyGeneratorIpFallback: false },
    store: redisClient.isOpen ? new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
    }) : undefined, // Falls back to MemoryStore if Redis is closed
    handler: (req, res, next, options) => {
        db.prepare(`INSERT INTO audit_log (document_id, action, actor, details) VALUES (?, ?, ?, ?)`)
          .run(0, 'RATE_LIMIT_EXCEEDED', req.ip, `Global limit hit: ${req.method} ${req.url}`);
        res.status(options.statusCode).json({
            success: false,
            error: 'Too many requests',
            message: options.message,
            retry_after: Math.ceil(options.windowMs / 1000)
        });
    }
});

app.use(globalLimiter);
app.use(nonceMiddleware);

app.use((req, res, next) => {
  console.log("REQUEST_RECEIVED:", req.method, req.url);
  next();
});

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json());

// Session Configuration
app.use(session({
    secret: process.env.SESSION_SECRET || (() => { console.warn('[SECURITY] SESSION_SECRET not set! Using random ephemeral key.'); return require('crypto').randomBytes(32).toString('hex'); })(),
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
const adminRoutes = require('./routes/admin');
const { requireAuth } = require('./middleware/auth');

app.use('/auth', authRoutes);
// Apply hmac + requireAuth + apiKey to sensitive routes
app.use('/api/upload', hmacMiddleware, requireAuth, apiKey, uploadRoutes);
app.use('/api/verify', (req, res, next) => {
    // Apply hmac, requireAuth, and apiKey only to POST /api/verify or GET /api/verify/:id/proof
    if (req.method === 'POST' || req.path.endsWith('/proof')) {
        return hmacMiddleware(req, res, () => requireAuth(req, res, () => apiKey(req, res, next)));
    }
    next();
}, verifyRoutes);
app.use('/api/chain', hmacMiddleware, requireAuth, chainRoutes);
app.use('/api/stats', hmacMiddleware, requireAuth, statsRoutes);
app.use('/api/admin', hmacMiddleware, requireAuth, adminRoutes);

// ── Public CRL Endpoint ──
app.get('/api/public/crl', (req, res) => {
    try {
        const revoked = db.prepare("SELECT serial_number, revoked_at FROM key_registry WHERE status = 'revoked' AND serial_number IS NOT NULL").all();
        const certInfos = revoked.map(r => ({
            serialNumber: r.serial_number,
            revocationDate: r.revoked_at
        }));
        const crl = PKIUtils.generateCRL(certInfos);
        res.json(crl);
    } catch (error) {
        console.error('[PUBLIC_CRL_ERROR]', error);
        res.status(500).json({ error: 'Failed to generate CRL' });
    }
});

// SPA fallback: serve index.html for any non-API route
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
    }
});

// ── Background Integrity Watcher ──
// Automatically checks files every 30 seconds to detect tampering
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

                const verification = await hasher.verifyDocumentAsync(doc.block_index, db, tmpPath);
                if (!verification.valid) {
                    db.prepare('UPDATE documents SET is_tampered = 1 WHERE block_index = ?').run(doc.block_index);
                    db.prepare(`INSERT INTO audit_log (document_id, action, actor, details) VALUES (?, ?, ?, ?)`)
                      .run(doc.block_index, 'TAMPER_DETECTED', 'BG_WATCHER', `Automated sweep detected file modification.`);
                }
                
                if (fs.existsSync(tmpPath)) {
                    try {
                        fs.unlinkSync(tmpPath);
                    } catch (e) {
                        // On Windows, files are often locked briefly. Silent fallback.
                    }
                }
            } catch (err) {
                // If file is missing in GridFS, it's a real tamper/deletion
                if (err.code !== 'ENOENT') {
                    console.error(`[BG_WATCHER] Error verifying block #${doc.block_index}:`, err.message);
                }
                if (fs.existsSync(tmpPath)) {
                    try {
                        fs.unlinkSync(tmpPath);
                    } catch (e) {}
                }
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

// ── PKI Bootstrap ──
PKIUtils.bootstrapCAs().catch(err => console.error('[PKI_BOOTSTRAP_ERROR]', err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
