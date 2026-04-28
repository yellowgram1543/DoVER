const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

async function verifyPkiFix() {
    console.log('--- VERIFICATION TEST FOR ENCRYPTED CA KEYS ---');
    
    const certsDir = path.resolve(__dirname, '..', 'certs');
    const interKeyPath = path.join(certsDir, 'dover_intermediate.key');
    
    if (!fs.existsSync(interKeyPath)) {
        console.log('Intermediate key not found. You might need to run the server once to bootstrap CAs.');
        return;
    }
    
    const keyData = fs.readFileSync(interKeyPath, 'utf8');
    
    // 1. Check if it's still a plaintext RSA PRIVATE KEY
    if (keyData.includes('-----BEGIN RSA PRIVATE KEY-----') && !keyData.includes('Proc-Type: 4,ENCRYPTED')) {
        console.log('❌ FAILURE: Key is still in plaintext PEM format.');
        process.exit(1);
    } else {
        console.log('✅ SUCCESS: Key is NOT in plaintext PEM format (or is encrypted PEM).');
    }
    
    // 2. Try to decrypt it with the correct passphrase
    const caPassphrase = process.env.CA_PASSPHRASE || 'default-secure-passphrase';
    try {
        const decryptedKey = forge.pki.decryptRsaPrivateKey(keyData, caPassphrase);
        if (decryptedKey) {
            console.log('✅ SUCCESS: Key successfully decrypted with the correct passphrase.');
        } else {
            throw new Error('Decryption returned null');
        }
    } catch (e) {
        console.log(`❌ FAILURE: Failed to decrypt key with correct passphrase: ${e.message}`);
        process.exit(1);
    }
    
    // 3. Try to decrypt it with a WRONG passphrase
    try {
        const decrypted = forge.pki.decryptRsaPrivateKey(keyData, 'wrong-passphrase');
        if (decrypted) {
            console.log('❌ FAILURE: Key was decrypted with a WRONG passphrase!');
            process.exit(1);
        } else {
            console.log('✅ SUCCESS: Key failed to decrypt with a wrong passphrase.');
        }
    } catch (e) {
        console.log('✅ SUCCESS: Key failed to decrypt with a wrong passphrase (threw error).');
    }
}

verifyPkiFix();
