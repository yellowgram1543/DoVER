const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

async function generate() {
    console.log('--- Generating Demo Digital Certificate ---');
    
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 2); // 2 years

    const attrs = [
        { name: 'commonName', value: 'DoVER Prototype Authority' },
        { name: 'countryName', value: 'IN' },
        { shortName: 'ST', value: 'Maharashtra' },
        { name: 'localityName', value: 'Mumbai' },
        { name: 'organizationName', value: 'DoVER Digital Vault' },
        { shortName: 'OU', value: 'Certification Dept' }
    ];

    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keys.privateKey, forge.md.sha256.create());

    const password = 'demo-password';
    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, cert, password);
    const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
    const p12Buffer = Buffer.from(p12Der, 'binary');

    fs.writeFileSync('cert.p12', p12Buffer);
    
    console.log('✅ Success: cert.p12 created in root directory.');
    console.log('👉 Password: ' + password);
    console.log('\nUpdating .env file with the password...');

    let envContent = '';
    if (fs.existsSync('.env')) {
        envContent = fs.readFileSync('.env', 'utf8');
        if (envContent.includes('SIGNING_P12_PASSWORD')) {
            envContent = envContent.replace(/SIGNING_P12_PASSWORD=.*/, `SIGNING_P12_PASSWORD=${password}`);
        } else {
            envContent += `\nSIGNING_P12_PASSWORD=${password}`;
        }
    } else {
        envContent = `SIGNING_P12_PASSWORD=${password}`;
    }
    fs.writeFileSync('.env', envContent);
    
    console.log('✅ .env updated.');
}

generate();
