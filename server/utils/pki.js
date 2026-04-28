const forge = require('node-forge');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CERTS_DIR = path.resolve(__dirname, '..', '..', 'certs');
if (!fs.existsSync(CERTS_DIR)) fs.mkdirSync(CERTS_DIR);

/**
 * PKI Utility for managing 3-tier Certificate Authority (Root -> Intermediate -> Business).
 */
class PKIUtils {
    /**
     * Bootstraps the DoVER Root and Intermediate CAs if they don't exist.
     */
    static async bootstrapCAs() {
        const rootPath = path.join(CERTS_DIR, 'dover_root.pem');
        const rootKeyPath = path.join(CERTS_DIR, 'dover_root.key');
        const interPath = path.join(CERTS_DIR, 'dover_intermediate.pem');
        const interKeyPath = path.join(CERTS_DIR, 'dover_intermediate.key');

        if (fs.existsSync(rootPath) && fs.existsSync(interPath)) {
            console.log('[PKI] CAs already bootstrapped.');
            return;
        }

        console.log('[PKI] Bootstrapping DoVER PKI Hierarchy...');

        // 1. Generate Root CA
        const rootKeys = forge.pki.rsa.generateKeyPair(4096);
        const rootCert = forge.pki.createCertificate();
        rootCert.publicKey = rootKeys.publicKey;
        rootCert.serialNumber = '01';
        rootCert.validity.notBefore = new Date();
        rootCert.validity.notAfter = new Date();
        rootCert.validity.notAfter.setFullYear(rootCert.validity.notBefore.getFullYear() + 10);

        const rootAttrs = [
            { name: 'commonName', value: 'DoVER Root CA' },
            { name: 'organizationName', value: 'DoVER Trust Network' }
        ];
        rootCert.setSubject(rootAttrs);
        rootCert.setIssuer(rootAttrs);
        rootCert.setExtensions([
            { name: 'basicConstraints', cA: true },
            { name: 'keyUsage', keyCertSign: true, cRLSign: true }
        ]);
        rootCert.sign(rootKeys.privateKey, forge.md.sha256.create());

        fs.writeFileSync(rootPath, forge.pki.certificateToPem(rootCert));
        fs.writeFileSync(rootKeyPath, forge.pki.privateKeyToPem(rootKeys.privateKey));

        // 2. Generate Intermediate CA
        const interKeys = forge.pki.rsa.generateKeyPair(2048);
        const interCert = forge.pki.createCertificate();
        interCert.publicKey = interKeys.publicKey;
        interCert.serialNumber = '02';
        interCert.validity.notBefore = new Date();
        interCert.validity.notAfter = new Date();
        interCert.validity.notAfter.setFullYear(interCert.validity.notBefore.getFullYear() + 5);

        const interAttrs = [
            { name: 'commonName', value: 'DoVER Intermediate CA' },
            { name: 'organizationName', value: 'DoVER Trust Network' }
        ];
        interCert.setSubject(interAttrs);
        interCert.setIssuer(rootCert.subject.attributes);
        interCert.setExtensions([
            { name: 'basicConstraints', cA: true },
            { name: 'keyUsage', keyCertSign: true, cRLSign: true }
        ]);
        interCert.sign(rootKeys.privateKey, forge.md.sha256.create());

        fs.writeFileSync(interPath, forge.pki.certificateToPem(interCert));
        fs.writeFileSync(interKeyPath, forge.pki.privateKeyToPem(interKeys.privateKey));

        console.log('[PKI] ✓ PKI Hierarchy created successfully.');
    }

    /**
     * Generates a business certificate signed by the Intermediate CA.
     */
    static generateBusinessP12(businessName, password) {
        const interPath = path.join(CERTS_DIR, 'dover_intermediate.pem');
        const interKeyPath = path.join(CERTS_DIR, 'dover_intermediate.key');
        const rootPath = path.join(CERTS_DIR, 'dover_root.pem');

        if (!fs.existsSync(interPath)) {
            throw new Error('Intermediate CA not bootstrapped. Run bootstrapCAs first.');
        }

        const interCert = forge.pki.certificateFromPem(fs.readFileSync(interPath, 'utf8'));
        const interKey = forge.pki.privateKeyFromPem(fs.readFileSync(interKeyPath, 'utf8'));
        const rootCert = forge.pki.certificateFromPem(fs.readFileSync(rootPath, 'utf8'));

        const keys = forge.pki.rsa.generateKeyPair(2048);
        const cert = forge.pki.createCertificate();
        
        cert.publicKey = keys.publicKey;
        cert.serialNumber = crypto.randomBytes(8).toString('hex');
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date();
        cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

        const attrs = [
            { name: 'commonName', value: businessName },
            { name: 'organizationName', value: 'DoVER Verified Issuer' }
        ];

        cert.setSubject(attrs);
        cert.setIssuer(interCert.subject.attributes);
        cert.setExtensions([
            { name: 'keyUsage', digitalSignature: true, nonRepudiation: true }
        ]);

        cert.sign(interKey, forge.md.sha256.create());

        // Create P12 with full chain: [Business, Intermediate, Root]
        const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
            keys.privateKey, [cert, interCert, rootCert], password, 
            { algorithm: '3des' }
        );
        const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
        const p12Buffer = Buffer.from(p12Der, 'binary');

        const publicKeyPem = forge.pki.publicKeyToPem(keys.publicKey);
        const fingerprint = crypto.createHash('sha256').update(publicKeyPem).digest('hex');

        return {
            p12Buffer,
            publicKeyPem,
            fingerprint,
            serialNumber: cert.serialNumber,
            commonName: businessName
        };
    }

    /**
     * Generates a signed Certificate Revocation List (CRL) as a JSON object.
     */
    static generateCRL(revokedCertificates = []) {
        const interKeyPath = path.join(CERTS_DIR, 'dover_intermediate.key');
        if (!fs.existsSync(interKeyPath)) return null;

        const interKey = fs.readFileSync(interKeyPath, 'utf8');

        const crlData = {
            issuer: 'DoVER Intermediate CA',
            lastUpdate: new Date().toISOString(),
            nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            revoked: revokedCertificates
        };

        const dataStr = JSON.stringify(crlData);
        const sign = crypto.createSign('SHA256');
        sign.update(dataStr);
        const signature = sign.sign(interKey, 'hex');

        return {
            data: crlData,
            signature: signature
        };
    }

    /**
     * Extracts a SHA256 fingerprint from a PEM or Buffer certificate.
     */
    static getFingerprint(certSource) {
        let cert;
        if (Buffer.isBuffer(certSource)) {
            const asn1 = forge.asn1.fromDer(certSource.toString('binary'));
            cert = forge.pki.certificateFromAsn1(asn1);
        } else {
            cert = forge.pki.certificateFromPem(certSource);
        }
        const publicKeyPem = forge.pki.publicKeyToPem(cert.publicKey);
        return crypto.createHash('sha256').update(publicKeyPem).digest('hex');
    }
}

module.exports = PKIUtils;
