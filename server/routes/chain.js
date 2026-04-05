const express = require('express');
const router = express.Router();
const db = require('../db/db');

router.get('/', (req, res) => {
    try {
        const documents = db.prepare('SELECT * FROM documents ORDER BY block_index ASC').all();
        res.json(documents);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Failed to retrieve chain' });
    }
});

router.get('/audit', (req, res) => {
    try {
        const auditLogs = db.prepare(`
            SELECT a.document_id, d.filename, a.action, a.actor, a.timestamp, a.details
            FROM audit_log a
            JOIN documents d ON a.document_id = d.block_index
            ORDER BY a.timestamp DESC
        `).all();
        res.json(auditLogs);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Failed to retrieve audit logs' });
    }
});

router.get('/document/:id/history', (req, res) => {
    try {
        const history = db.prepare(`
            SELECT a.document_id, d.filename, a.action, a.actor, a.timestamp, a.details
            FROM audit_log a
            JOIN documents d ON a.document_id = d.block_index
            WHERE a.document_id = ?
            ORDER BY a.timestamp DESC
        `).all(req.params.id);
        res.json(history);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Failed to retrieve document history' });
    }
});

module.exports = router;
