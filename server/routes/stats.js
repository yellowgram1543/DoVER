const express = require('express');
const router = express.Router();
const db = require('../db/db');

router.get('/', (req, res) => {
    try {
        const totalDocs = db.prepare('SELECT COUNT(*) as count FROM documents').get().count;
        const tamperedCount = db.prepare('SELECT COUNT(*) as count FROM documents WHERE is_tampered = 1').get().count;

        // Verified today: documents uploaded today that are NOT tampered
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const verifiedToday = db.prepare(
            "SELECT COUNT(*) as count FROM documents WHERE date(upload_timestamp) = ? AND is_tampered = 0"
        ).get(today).count;

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
