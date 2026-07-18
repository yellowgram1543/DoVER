require('dotenv').config();

// ── Production Process Guards ──
process.on('uncaughtException', (err) => {
    const msg = (err.message || "").toLowerCase();
    if (!msg.includes('redis')) {
        console.error('[ERROR] Critical System Exception:', err.message);
    }
});

process.on('unhandledRejection', (reason) => {
    const msg = (reason?.message || reason || "").toString();
    if (!msg.toLowerCase().includes('redis')) {
        console.error('[ERROR] Unhandled Promise Rejection:', msg);
    }
});

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('./utils/passport');
const apiKey = require('./middleware/apiKey');
const { rateLimit } = require('express-rate-limit');
const { createClient } = require('redis');
const nonceMiddleware = require('./middleware/nonce');
const blocklist = require('./middleware/blocklist');
const hmacMiddleware = require('./middleware/hmac');
const db = require('./db/db');
const PKIUtils = require('./utils/pki');
const { createRateLimitRedisStore } = require('./utils/rateLimitRedisStore');

// ── Startup Initialization ──
const requiredDirs = ['tmp', 'uploads', 'certs'];
requiredDirs.forEach(dir => {
    const dirPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`[INIT] Created directory: ${dir}`);
    }
});

const app = express();
app.set('trust proxy', 1);

// Redis Client for Rate Limiting
const REDIS_URL_MAIN = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const isMainTLS = REDIS_URL_MAIN.startsWith('rediss://');
const redisClient = createClient({
    url: REDIS_URL_MAIN,
    socket: {
        connectTimeout: 5000,
        ...(isMainTLS ? { tls: true } : {})
    }
});

redisClient.on('error', (err) => console.warn('[REDIS_ERROR] Offline — falling back to memory:', err.message));
redisClient.connect().catch(err => console.warn('[REDIS_CONNECT_FAIL] Moving on without Redis.'));

// Global IP Blocklist
app.use(blocklist);

// Global Rate Limiter: 100 requests per 15 minutes
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 500, // Increased for Demo Resilience
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    validate: { keyGeneratorIpFallback: false },
    store: createRateLimitRedisStore(redisClient, { prefix: 'rl:global:' }),
    passOnStoreError: false,
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

// ── Strict CORS Configuration ─────────────────────────────────────────────────
// Build an explicit allowlist from the CORS_ORIGIN environment variable.
// The variable may be a single origin or a comma-separated list of origins.
// Rules:
//   • Each entry must be an absolute HTTPS URL in production (HTTP only allowed
//     for localhost during development).
//   • Wildcards ('*') are never permitted — they are incompatible with
//     credentials: true and would defeat session/cookie protection entirely.
//   • An unrecognised or missing Origin header is rejected (origin: false).
//   • If CORS_ORIGIN is not set, only http://localhost:3000 is allowed so that
//     production deployments without explicit config fail securely rather than
//     accidentally becoming open.
const _isProd = process.env.NODE_ENV === 'production';

const _allowedOrigins = (() => {
    const raw = process.env.CORS_ORIGIN || 'http://localhost:3000';
    return raw
        .split(',')
        .map(o => o.trim())
        .filter(o => {
            if (!o) return false;
            if (o === '*') {
                console.error('[CORS] Wildcard origin ("*") is not permitted with credentials. Entry ignored.');
                return false;
            }
            try {
                const u = new URL(o);
                const isLocalhost = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
                if (_isProd && u.protocol !== 'https:' && !isLocalhost) {
                    console.error(`[CORS] Non-HTTPS origin rejected in production: ${o}`);
                    return false;
                }
                return true;
            } catch {
                console.error(`[CORS] Invalid origin URL ignored: ${o}`);
                return false;
            }
        });
})();

if (_allowedOrigins.length === 0) {
    console.error('[CORS] No valid origins configured — all cross-origin requests will be blocked.');
}

console.log('[CORS] Allowed origins:', _allowedOrigins);

app.use(cors({
    origin(requestOrigin, callback) {
        // Same-origin requests (e.g. server-side curl, direct browser navigation)
        // have no Origin header — allow them through.
        if (!requestOrigin) return callback(null, false);

        if (_allowedOrigins.includes(requestOrigin)) {
            return callback(null, true);
        }

        // Log the rejected origin for visibility but return a generic error so
        // attackers get no information about our allowlist.
        console.warn(`[CORS] Rejected origin: ${requestOrigin}`);
        return callback(new Error('CORS_ORIGIN_NOT_ALLOWED'));
    },
    credentials: true,
}));
app.use(express.json());

// Session Configuration
app.use(session({
    secret: process.env.SESSION_SECRET || (() => { console.warn('[SECURITY] SESSION_SECRET not set! Using random ephemeral key.'); return require('crypto').randomBytes(32).toString('hex'); })(),
    resave: false,
    saveUninitialized: false,
    store: (MongoStore.create || MongoStore.default.create)({
        clientPromise: require('./db/mongodb').getConn().asPromise().then(c => c.getClient()),
        dbName: 'docvault'
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000, // 1 day
        // SECURITY: httpOnly prevents JavaScript (including XSS payloads)
        // from reading the session cookie via document.cookie.
        httpOnly: true,
        // SECURITY: sameSite 'strict' prevents the browser from sending
        // this cookie on any cross-origin request, which blocks CSRF
        // attacks against session-authenticated endpoints.
        // Use 'lax' instead if you need top-level navigations from
        // external sites to land authenticated (e.g. OAuth redirects),
        // but 'strict' is the more secure default.
        sameSite: 'strict'
    }
}));

app.use(passport.initialize());
app.use(passport.session());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'public')));

const uploadRoutes      = require('./routes/upload');
const verifyRoutes      = require('./routes/verify');        // privileged endpoints
const verifyPublicRoutes = require('./routes/verify_public'); // unauthenticated endpoints
const chainRoutes       = require('./routes/chain');
const statsRoutes       = require('./routes/stats');
const authRoutes        = require('./routes/auth');
const adminRoutes       = require('./routes/admin');
const { requireAuth }   = require('./middleware/auth');

app.use('/auth', authRoutes);

// Upload routes: GET /status/:id is fully public (guest-compatible), everything else requires HMAC + auth + apiKey
app.use('/api/upload', (req, res, next) => {
    if (req.method === 'GET' && req.path.startsWith('/status/')) {
        return next(); // public — job ID is the access token, guest mode compatible
    }
    return hmacMiddleware(req, res, () => requireAuth(req, res, () => apiKey(req, res, next)));
}, uploadRoutes);

// ── Public verification (/api/public/verify) ─────────────────
// Rate-limited, no API key, no session required.
// Deliberately mounted on a separate prefix so it can NEVER
// accidentally inherit middleware from the privileged block below.
app.use('/api/public/verify', verifyPublicRoutes);

// ── Privileged verification (/api/verify) ────────────────────
// POST / and GET /:id/proof also require HMAC + auth (applied here).
// GET /:hash requires only apiKey (applied inside the router itself).
app.use('/api/verify', (req, res, next) => {
    if (req.method === 'POST' || req.path.endsWith('/proof')) {
        return hmacMiddleware(req, res, () => requireAuth(req, res, () => next()));
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
const { getBucket, mongoose: mongooseConn } = require('./db/mongodb');
// Import Types once at module level — avoids repeated inline require() inside the interval
const { Types: MongooseTypes } = mongooseConn;

setInterval(async () => {
    const bucket = getBucket();
    if (!bucket) return; // Wait for GridFS connection to initialise

    try {
        const docs = db.prepare(`
            SELECT * FROM documents 
            WHERE is_tampered = 0 
            ORDER BY last_checked_at ASC NULLS FIRST
            LIMIT 50
        `).all();

        for (const doc of docs) {
            const storageId = doc.storage_id || doc.filename;
            // Skip legacy local files that aren't valid MongoDB ObjectIds (24 hex chars)
            if (!/^[0-9a-fA-F]{24}$/.test(storageId)) continue;

            let tmpPath = path.resolve('tmp', `bg_verify_${doc.block_index}`);
            try {
                // Reconstruct from GridFS using the module-level MongooseTypes import
                const downloadStream = bucket.openDownloadStream(new MongooseTypes.ObjectId(storageId));
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

                // Only advance last_checked_at after a clean, definitive check (pass or tamper verdict).
                // Leaving the timestamp unchanged on infrastructure errors lets the next watcher run retry.
                db.prepare("UPDATE documents SET last_checked_at = datetime('now') WHERE block_index = ?").run(doc.block_index);

                if (fs.existsSync(tmpPath)) {
                    try { fs.unlinkSync(tmpPath); } catch (e) {
                        // On Windows, files are often locked briefly — silent fallback.
                    }
                }
            } catch (err) {
                // Infrastructure error (GridFS stream failure, hash I/O error, etc.).
                // Do NOT update last_checked_at — preserve the original timestamp so this
                // document is retried on the next watcher interval rather than silently skipped.
                console.error(`[BG_WATCHER] Infrastructure error on block #${doc.block_index} — will retry:`, err.message);
                if (fs.existsSync(tmpPath)) {
                    try { fs.unlinkSync(tmpPath); } catch (e) { }
                }
            }
        }
    } catch (e) {
        // Outer catch: database-level failure (SQLite busy, schema error, etc.)
        console.error('[BG_WATCHER] Fatal watcher cycle error — skipping batch:', e.message);
    }
}, 30000); // 30 s interval to reduce load

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