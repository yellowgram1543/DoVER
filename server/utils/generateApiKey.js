const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Generates a random API key and updates the .env file.
 */
function generateApiKey() {
    const apiKey = crypto.randomBytes(32).toString('hex');
    const envPath = path.resolve(__dirname, '..', '..', '.env');
    let envContent = '';

    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
    }

    const lines = envContent.split('\n');
    const newLines = [];
    let updated = false;

    for (let line of lines) {
        if (line.startsWith('API_KEY=')) {
            newLines.push(`API_KEY=${apiKey}`);
            updated = true;
        } else if (line.trim() !== '' || line === lines[lines.length - 1]) {
            newLines.push(line);
        }
    }

    if (!updated) {
        newLines.push(`API_KEY=${apiKey}`);
    }

    fs.writeFileSync(envPath, newLines.join('\n').trim() + '\n');
    console.log(`API Key generated: ${apiKey}`);
}

generateApiKey();
process.exit(0);
