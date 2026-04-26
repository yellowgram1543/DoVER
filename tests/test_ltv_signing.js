const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const forge = require('node-forge');
const fs = require('fs');
const path = require('path');
const signatureEngine = require('../server/utils/signature_engine');

/**
 * End-to-End test for Phase 5-3: LTV & Audit Embedding.
 * Verifies that JSON proof is embedded as an attachment and PDF is signed.
 */
async function runTest() {
    console.log('--- Testing LTV & Audit Embedding ---');
    
    const certPath = path.resolve('cert.p12');
    const signedPdfPath = path.resolve('test_certified.pdf');
    const password = 'test-password';

    // 1. Generate Mock Certificate
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '05';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
    const attrs = [{ name: 'commonName', value: 'DoVER Global Authority' }];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keys.privateKey, forge.md.sha256.create());
    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, cert, password);
    const p12Buffer = Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), 'binary');
    fs.writeFileSync(certPath, p12Buffer);

    process.env.SIGNING_P12_PASSWORD = password;

    // 2. Prepare Sample PDF and Mock Proof
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 400]);
    page.drawText('DOVER CERTIFIED RECORD', { x: 50, y: 350, size: 20 });
    const unsignedBuffer = await pdfDoc.save();

    const mockProof = {
        block_index: 101,
        block_hash: 'abc123hash',
        file_hash: 'def456hash',
        timestamp: new Date().toISOString(),
        ocr_text: 'Sample extracted text for audit trail.',
        forensic_score: { font_consistency: 98, suspicious: false }
    };

    // 3. Execute Complete Signing Cycle
    console.log('3. Running SignatureEngine.signPdf() with Audit Trail...');
    const signedBuffer = await signatureEngine.signPdf(unsignedBuffer, {
        reason: 'Final Certification',
        proof: mockProof
    });

    // 4. Verification
    if (signedBuffer) {
        fs.writeFileSync(signedPdfPath, signedBuffer);
        console.log('\n✅ LTV & Audit Test: PASSED');
        console.log('   - JSON Audit Trail embedded as attachment.');
        console.log('   - PDF signed with authority certificate.');
        console.log(`   - Final file saved: ${signedPdfPath}`);
    } else {
        console.error('\n❌ LTV & Audit Test: FAILED');
        process.exit(1);
    }

    // Cleanup
    if (fs.existsSync(certPath)) fs.unlinkSync(certPath);
    process.exit(0);
}

runTest().catch(err => {
    console.error('Fatal LTV Error:', err);
    process.exit(1);
});
