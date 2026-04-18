const express = require('express');
const router = express.Router();
const db = require('../db/db');

router.get('/', (req, res) => {
    try {
        const isAdmin = req.user && req.user.role === 'authority';
        const userName = req.user?.name || '';

        let totalDocs, tamperedCount, verifiedToday;
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

        if (isAdmin) {
            totalDocs = db.prepare('SELECT COUNT(*) as count FROM documents').get().count;
            tamperedCount = db.prepare('SELECT COUNT(*) as count FROM documents WHERE is_tampered = 1').get().count;
            verifiedToday = db.prepare(
                "SELECT COUNT(*) as count FROM documents WHERE date(upload_timestamp) = ? AND is_tampered = 0"
            ).get(today).count;
        } else {
            totalDocs = db.prepare('SELECT COUNT(*) as count FROM documents WHERE uploaded_by = ?').get(userName).count;
            tamperedCount = db.prepare('SELECT COUNT(*) as count FROM documents WHERE uploaded_by = ? AND is_tampered = 1').get(userName).count;
            verifiedToday = db.prepare(
                "SELECT COUNT(*) as count FROM documents WHERE uploaded_by = ? AND date(upload_timestamp) = ? AND is_tampered = 0"
            ).get(userName, today).count;
        }

        res.json({
            total_documents: totalDocs,
            verified_today: verifiedToday,
            tampered_detected: tamperedCount
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Failed to retrieve stats' });
    }
});

module.exports = router;
