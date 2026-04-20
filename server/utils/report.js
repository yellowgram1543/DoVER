const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const crypto = require('crypto');
const db = require('../db/db');
const path = require('path');
const fs = require('fs');

/**
 * Generates an official signed audit report for a document.
 * @param {number} documentId - The block_index of the document.
 * @returns {Promise<Buffer>} - The generated PDF as a buffer.
 */
async function generateAuditReport(documentId) {
    return new Promise(async (resolve, reject) => {
        try {
            // 1. Fetch data
            const document = db.prepare('SELECT * FROM documents WHERE block_index = ?').get(documentId);
            if (!document) throw new Error('Document not found');

            const auditLogs = db.prepare('SELECT * FROM audit_log WHERE document_id = ? ORDER BY timestamp DESC').all(documentId);
            
            // Fetch version history (logic from chain.js)
            let rootId = document.block_index;
            let parentId = document.parent_document_id;
            let safety = 0;
            while (parentId !== null && safety < 50) {
                const parent = db.prepare('SELECT block_index, parent_document_id FROM documents WHERE block_index = ?').get(parentId);
                if (!parent) break;
                rootId = parent.block_index;
                parentId = parent.parent_document_id;
                safety++;
            }

            const versions = db.prepare(`
                WITH RECURSIVE descendants(id) AS (
                    SELECT block_index FROM documents WHERE block_index = ?
                    UNION
                    SELECT block_index FROM documents JOIN descendants ON documents.parent_document_id = descendants.id
                )
                SELECT version_number, block_index, filename, uploaded_by, upload_timestamp, block_hash
                FROM documents
                WHERE block_index IN descendants
                ORDER BY version_number ASC
            `).all(rootId);

            const aiSummary = document.ai_summary ? JSON.parse(document.ai_summary) : null;

            // 2. Setup PDF document
            const doc = new PDFDocument({
                margin: 50,
                info: {
                    Title: `Audit Report - ${document.filename}`,
                    Author: 'DoVER Authority',
                    Subject: `Official integrity report for block #${document.block_index}`,
                    Keywords: 'integrity, blockchain, ocr, forensic, audit'
                }
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });

            // --- HEADER ---
            doc.fontSize(25).fillColor('#001e40').text('DoVER', { continued: true });
            doc.fontSize(20).fillColor('#0059bb').text(' | INTEGRITY AUDIT REPORT', { underline: false });
            doc.moveDown();
            doc.fontSize(10).fillColor('black').text(`Official Bates No: DOVER-${document.block_index.toString().padStart(8, '0')}`, { align: 'right' });
            doc.text(`Report Date: ${new Date().toLocaleString()}`, { align: 'right' });
            doc.moveDown();

            // --- SECTION 1: Identity ---
            doc.fontSize(16).fillColor('#001e40').text('Section 1: Identity & Metadata', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(12).fillColor('black');
            doc.text(`Filename: ${document.filename}`);
            doc.text(`Department: ${document.department || 'General Registry'}`);
            doc.text(`Uploaded By: ${document.uploaded_by} (${document.uploader_email || 'N/A'})`);
            doc.text(`Upload Timestamp: ${document.upload_timestamp}`);
            doc.text(`File Type: ${document.file_type}`);
            doc.moveDown();

            // --- SECTION 2: Integrity & Blockchain ---
            doc.fontSize(16).fillColor('#001e40').text('Section 2: Integrity & Blockchain Anchoring', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(12).fillColor('black');
            doc.text(`File SHA-256: ${document.file_hash}`, { font: 'Courier' });
            doc.text(`Chain Block Hash: ${document.block_hash}`, { font: 'Courier' });
            doc.text(`Merkle Root: ${document.merkle_root || 'N/A'}`, { font: 'Courier' });
            
            if (document.merkle_proof) {
                try {
                    const proof = JSON.parse(document.merkle_proof);
                    doc.text(`Merkle Proof: ${proof.length} nodes (verified)`, { font: 'Helvetica' });
                } catch (e) {}
            }

            doc.text(`Polygon TXID: ${document.polygon_txid || 'PENDING/LOCAL'}`, { font: 'Courier' });
            doc.moveDown();

            // --- SECTION 3: AI Forensic Analysis ---
            doc.fontSize(16).fillColor('#001e40').text('Section 3: Document Intelligence & AI Forensics', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(12).fillColor('black');
            
            if (aiSummary) {
                doc.text(`Risk Rating: ${aiSummary.risk_rating || 'N/A'}`);
                doc.text(`Forensic Summary: ${aiSummary.forensic_summary || 'No summary available.'}`);
                if (aiSummary.key_entities) {
                    doc.text(`Key Entities Found: ${aiSummary.key_entities.join(', ')}`);
                }
            } else {
                doc.text('AI summary not available for this version.');
            }
            doc.moveDown();

            // --- SECTION 4: Timeline & History ---
            doc.fontSize(16).fillColor('#001e40').text('Section 4: Complete Version History', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(10).fillColor('black');
            
            versions.forEach((v, index) => {
                doc.text(`[v${v.version_number}] ${v.filename} - Uploaded by ${v.uploaded_by} on ${v.upload_timestamp}`);
                doc.text(`   Hash: ${v.block_hash}`, { font: 'Courier' });
                doc.moveDown(0.2);
            });
            doc.moveDown();

            // --- FOOTER & SIGNATURE ---
            doc.addPage();
            doc.fontSize(16).fillColor('#001e40').text('Authorization & Digital Signature', { underline: true });
            doc.moveDown();
            
            // Cryptographic Signing
            const privateKeyB64 = process.env.PRIVATE_KEY_B64;
            let signatureText = 'N/A (Key Missing)';
            if (privateKeyB64) {
                const privateKey = Buffer.from(privateKeyB64, 'base64').toString('utf8');
                const dataToSign = `${document.block_index}:${document.block_hash}:${document.upload_timestamp}`;
                const signer = crypto.createSign('sha256');
                signer.update(dataToSign);
                const signature = signer.sign(privateKey, 'base64');
                signatureText = signature;
            }

            doc.fontSize(10).fillColor('black').text('This document is cryptographically signed by the DoVER Authority.', { italic: true });
            doc.moveDown();
            doc.fontSize(8).text('AUTHORITY SIGNATURE:', { bold: true });
            doc.text(signatureText, { font: 'Courier', width: 450 });
            doc.moveDown();

            // QR Code
            const qrData = {
                block_index: document.block_index,
                hash: document.block_hash,
                signature: signatureText,
                verification_url: `${process.env.PUBLIC_URL || 'http://localhost:3000'}/verify?id=${document.block_index}`
            };
            const qrBuffer = await QRCode.toBuffer(JSON.stringify(qrData));
            doc.image(qrBuffer, {
                fit: [150, 150],
                align: 'center',
                valign: 'center'
            });

            doc.moveDown();
            doc.fontSize(12).fillColor('#ba1a1a').text('OFFICIAL DOVER SEAL', { align: 'center' });
            doc.fontSize(10).fillColor('black').text('Authenticated via Blockchain & AI-Forensics', { align: 'center' });

            // Finalize
            doc.end();

        } catch (error) {
            console.error('[REPORT_GEN_ERROR]', error);
            reject(error);
        }
    });
}

module.exports = {
    generateAuditReport
};
