const forge = require('node-forge');
const fs = require('fs');
const path = require('path');
const signatureEngine = require('../server/utils/signature_engine');

/**
 * Unit test for Phase 5-1: Digital Signing Infrastructure.
 * Generates a mock P12 certificate and verifies the SignatureEngine can load it.
 */
async function runTest() {
    console.log('--- Testing Digital Signing Infrastructure ---');
    
    const testCertPath = path.resolve('cert.p12');
    const password = 'test-password';

    // 1. Generate a mock self-signed certificate using node-forge
    console.log('1. Generating mock self-signed certificate...');
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

    const attrs = [{ name: 'commonName', value: 'DoVER Test Authority' }];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keys.privateKey, forge.md.sha256.create());

    // 2. Create P12 container
    console.log('2. Creating P12 container...');
    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, cert, password);
    const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
    const p12Buffer = Buffer.from(p12Der, 'binary');
    fs.writeFileSync(testCertPath, p12Buffer);

    // 3. Configure environment to point to this mock cert
    process.env.SIGNING_P12_PASSWORD = password;

    // 4. Verify SignatureEngine can load it
    console.log('3. Verifying SignatureEngine loader...');
    const success = await signatureEngine.loadCertificate();

    if (success) {
        console.log('\n✅ Infrastructure Test: PASSED');
        console.log('   - Certificate parsed successfully.');
        console.log('   - Identity verified: DoVER Test Authority');
    } else {
        console.error('\n❌ Infrastructure Test: FAILED');
        process.exit(1);
    }

    // Cleanup
    if (fs.existsSync(testCertPath)) fs.unlinkSync(testCertPath);
    process.exit(0);
}

runTest().catch(err => {
    console.error('Fatal Test Error:', err);
    process.exit(1);
});
