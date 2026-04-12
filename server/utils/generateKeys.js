const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Generates an RSA-2048 key pair and updates the .env file with Base64 encoded versions.
 */
function generateKeys() {
    console.log('Generating RSA-2048 key pair (Base64 mode)...');

    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });

    const envPath = path.resolve(__dirname, '..', '..', '.env');
    let envContent = '';

    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Encode keys as Base64 to avoid line-break issues
    const privateKeyB64 = Buffer.from(privateKey).toString('base64');
    const publicKeyB64 = Buffer.from(publicKey).toString('base64');

    const lines = envContent.split('\n');
    const newLines = [];
    let publicUpdated = false;
    let privateUpdated = false;

    for (let line of lines) {
        if (line.startsWith('PUBLIC_KEY_B64=')) {
            newLines.push(`PUBLIC_KEY_B64="${publicKeyB64}"`);
            publicUpdated = true;
        } else if (line.startsWith('PRIVATE_KEY_B64=')) {
            newLines.push(`PRIVATE_KEY_B64="${privateKeyB64}"`);
            privateUpdated = true;
        } else if (!line.startsWith('PUBLIC_KEY=') && !line.startsWith('PRIVATE_KEY=')) {
            // Only keep non-key lines or lines that aren't the old PEM keys
            if (line.trim() !== '' || line === lines[lines.length - 1]) {
                newLines.push(line);
            }
        }
    }

    if (!publicUpdated) newLines.push(`PUBLIC_KEY_B64="${publicKeyB64}"`);
    if (!privateUpdated) newLines.push(`PRIVATE_KEY_B64="${privateKeyB64}"`);

    fs.writeFileSync(envPath, newLines.join('\n').trim() + '\n');

    console.log('Keys generated and stored as Base64 successfully');
}

generateKeys();
process.exit(0);
