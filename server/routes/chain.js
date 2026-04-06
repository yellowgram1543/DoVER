const express = require('express');
const router = express.Router();
const db = require('../db/db');
const documentQueue = require('../utils/queue');

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

// ── Batch Status ──
router.get('/batch/:batch_id/status', async (req, res) => {
    try {
        const batchId = parseInt(req.params.batch_id);

        // Fetch all jobs across every state in parallel
        const [waiting, active, completed, failed, delayed] = await Promise.all([
            documentQueue.getWaiting(),
            documentQueue.getActive(),
            documentQueue.getCompleted(),
            documentQueue.getFailed(),
            documentQueue.getDelayed()
        ]);

        const allJobs = [...waiting, ...active, ...completed, ...failed, ...delayed];

        // Filter to jobs belonging to this batch
        const batchJobs = allJobs.filter(j => j.data.batch_id === batchId);

        if (batchJobs.length === 0) {
            return res.status(404).json({ success: false, error: 'No jobs found for this batch_id' });
        }

        // Map each job to a clean status object
        const jobs = batchJobs.map(j => {
            let status;
            if (waiting.find(x => x.id === j.id))   status = 'queued';
            else if (active.find(x => x.id === j.id)) status = 'processing';
            else if (failed.find(x => x.id === j.id)) status = 'failed';
            else                                       status = 'completed';

            return {
                job_id: j.id,
                filename: j.data.originalname,
                status,
                progress: j._progress || 0,
                error: j.failedReason || null,
                document_id: j.returnvalue ? j.returnvalue.document_id : null
            };
        });

        const counts = jobs.reduce((acc, j) => {
            acc[j.status] = (acc[j.status] || 0) + 1;
            return acc;
        }, {});

        res.json({
            batch_id: batchId,
            total: jobs.length,
            completed: counts.completed || 0,
            failed: counts.failed || 0,
            processing: counts.processing || 0,
            queued: counts.queued || 0,
            jobs
        });

    } catch (error) {
        console.error('[BATCH_STATUS_ERROR]', error);
        res.status(500).json({ success: false, error: 'Failed to get batch status' });
    }
});

module.exports = router;
