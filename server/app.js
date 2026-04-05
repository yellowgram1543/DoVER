require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'public')));

const uploadRoutes = require('./routes/upload');
const verifyRoutes = require('./routes/verify');
const chainRoutes = require('./routes/chain');
const statsRoutes = require('./routes/stats');

app.use('/api/upload', uploadRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/chain', chainRoutes);
app.use('/api/stats', statsRoutes);

// SPA fallback: serve index.html for any non-API route
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
    }
});

// ── Background Integrity Watcher ──
// Automatically checks files every 10 seconds to detect tampering
const db = require('./db/db');
const hasher = require('./utils/hasher');
setInterval(() => {
    try {
        const docs = db.prepare('SELECT block_index, is_tampered FROM documents').all();
        docs.forEach(doc => {
            const verification = hasher.verifyDocument(doc.block_index, db);
            if (!verification.valid && !doc.is_tampered) {
                // System discovered tampering during background sweep
                db.prepare('UPDATE documents SET is_tampered = 1 WHERE block_index = ?').run(doc.block_index);
                db.prepare(`
                    INSERT INTO audit_log (document_id, action, actor, details)
                    VALUES (?, ?, ?, ?)
                `).run(doc.block_index, 'TAMPER_DETECTED', 'BG_WATCHER', `Automated sweep detected file modification.`);
                console.log(`[BG_WATCHER] Tampering detected on document #${doc.block_index}`);
            }
        });
    } catch (e) {
        console.error('[BG_WATCHER] Error during integrity sweep:', e.message);
    }
}, 10000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
