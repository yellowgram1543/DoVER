const forge = require('node-forge');
const { P12Signer } = require('@signpdf/signer-p12');
const signpdf = require('@signpdf/signpdf').default;
const { pdflibAddPlaceholder } = require('@signpdf/placeholder-pdf-lib');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

/**
 * SignatureEngine manages digital certificates (P12/PFX) 
 * and provides methods to sign PDF documents.
 */
class SignatureEngine {
    constructor() {
        this.p12Buffer = null;
        this.password = process.env.SIGNING_P12_PASSWORD || '';
        this.signer = null;
        this.certificate = null;
    }

    /**
     * Loads the P12 certificate from Base64 env or local file.
     */
    async loadCertificate() {
        try {
            this.password = process.env.SIGNING_P12_PASSWORD || '';
            
            // 1. Load Buffer
            if (process.env.SIGNING_P12_B64) {
                console.log('[SIGNER] Loading certificate from environment variable...');
                this.p12Buffer = Buffer.from(process.env.SIGNING_P12_B64, 'base64');
            } else if (fs.existsSync('cert.p12')) {
                console.log('[SIGNER] Loading certificate from cert.p12 file...');
                this.p12Buffer = fs.readFileSync('cert.p12');
            } else {
                throw new Error('No certificate found (missing SIGNING_P12_B64 or cert.p12)');
            }

            // 2. Validate and Parse using forge (to check expiry/identity)
            const asn1 = forge.asn1.fromDer(this.p12Buffer.toString('binary'));
            const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, this.password);
            
            // Get the first certificate for validation
            const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
            this.certificate = bags[forge.pki.oids.certBag][0].cert;

            const commonName = this.certificate.subject.getField('CN').value;
            const expiry = this.certificate.validity.notAfter;
            
            console.log(`[SIGNER] Certificate Loaded: ${commonName}`);
            console.log(`[SIGNER] Expiry Date: ${expiry}`);

            if (new Date() > expiry) {
                console.warn('[SIGNER] ⚠️ WARNING: Certificate has expired!');
            }

            // 3. Initialize the Signer for @signpdf
            this.signer = new P12Signer(this.p12Buffer, { passphrase: this.password });
            
            return true;
        } catch (error) {
            console.error('[SIGNER] ✗ Load failed:', error.message);
            return false;
        }
    }

    /**
     * Embeds a JSON audit trail (proof) and PDF/A-3 metadata into the document.
     */
    async embedMetadataAndAuditTrail(pdfDoc, proofData) {
        try {
            console.log('[SIGNER] Embedding JSON audit trail as attachment...');
            
            const proofBuffer = Buffer.from(JSON.stringify(proofData, null, 2));
            
            // Attach the JSON file
            await pdfDoc.attach(proofBuffer, 'dover_proof.json', {
                mimeType: 'application/json',
                description: 'DoVER Cryptographic Proof of Integrity',
                creationDate: new Date(),
                modificationDate: new Date(),
            });

            // Set PDF/A-3 Metadata (Basic)
            pdfDoc.setTitle('DoVER Certified Document');
            pdfDoc.setAuthor('DoVER Official Portal');
            pdfDoc.setSubject('Cryptographically Verified Record');
            pdfDoc.setKeywords(['DoVER', 'Blockchain', 'Verified', 'Official']);
            pdfDoc.setProducer('DoVER Signature Engine');
            pdfDoc.setCreator('Decentralized Official Vault');
            
            return true;
        } catch (error) {
            console.error('[SIGNER] ✗ Embedding failed:', error.message);
            return false;
        }
    }

    /**
     * Digitally signs a PDF buffer.
     * @param {Buffer} pdfBuffer - The raw PDF data.
     * @param {Object} options - reason, location, contactInfo, proof.
     * @returns {Promise<Buffer>} - The signed PDF buffer.
     */
    async signPdf(pdfBuffer, options = {}) {
        try {
            if (!this.signer) {
                const loaded = await this.loadCertificate();
                if (!loaded) throw new Error('Signer not initialized');
            }

            console.log('[SIGNER] Preparing PDF for signing...');

            // 1. Add visible signature info using pdf-lib
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            
            // 1.1 Embed Audit Trail if provided
            if (options.proof) {
                await this.embedMetadataAndAuditTrail(pdfDoc, options.proof);
            }

            const pages = pdfDoc.getPages();
            const lastPage = pages[pages.length - 1];
            const { width, height } = lastPage.getSize();
            const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

            const commonName = this.certificate.subject.getField('CN').value;
            const dateStr = new Date().toISOString().split('T')[0];

            // Draw a professional signature box at the bottom right
            lastPage.drawRectangle({
                x: width - 210,
                y: 50,
                width: 180,
                height: 60,
                borderColor: rgb(0, 0.12, 0.25), // Primary Blue
                borderWidth: 1,
                color: rgb(0.95, 0.96, 0.97),
            });

            lastPage.drawText('DIGITALLY SIGNED BY', {
                x: width - 200,
                y: 95,
                size: 7,
                font,
                color: rgb(0.4, 0.4, 0.4),
            });

            lastPage.drawText(commonName.toUpperCase(), {
                x: width - 200,
                y: 82,
                size: 9,
                font,
                color: rgb(0, 0.12, 0.25),
            });

            lastPage.drawText(`Date: ${dateStr}`, {
                x: width - 200,
                y: 70,
                size: 7,
                font,
                color: rgb(0.4, 0.4, 0.4),
            });

            lastPage.drawText('AUTHENTICATED BY DOVER', {
                x: width - 200,
                y: 58,
                size: 6,
                font,
                color: rgb(0, 0.35, 0.73), // Secondary Blue
            });

            // 2. Add cryptographic placeholder
            pdflibAddPlaceholder({
                pdfDoc: pdfDoc,
                reason: options.reason || 'Document Integrity Verification',
                location: options.location || 'DoVER Secure Vault',
                contactInfo: options.contactInfo || 'authority@dover.io',
                name: commonName,
                signatureLength: 8192,
            });

            const pdfWithPlaceholder = await pdfDoc.save();
            console.log(`[SIGNER] Placeholder added and saved. Size: ${pdfWithPlaceholder.length} bytes.`);

            // 3. Cryptographic Signing
            console.log('[SIGNER] Applying cryptographic signature...');
            const signedPdf = await signpdf.sign(pdfWithPlaceholder, this.signer);

            console.log('[SIGNER] ✓ PDF signed successfully.');
            return Buffer.from(signedPdf);

        } catch (error) {
            console.error('[SIGNER] ✗ Signing failed:', error.message);
            throw error;
        }
    }
}

module.exports = new SignatureEngine();
