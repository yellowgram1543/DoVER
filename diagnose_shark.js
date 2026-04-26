const ocr = require('./server/utils/ocr');
const forensics = require('./server/utils/forensics');
const path = require('path');

async function diagnose() {
    const filePath = path.resolve('shark_test.jpg');
    console.log('--- Diagnosing Shark Image ---');
    
    console.log('1. Running OCR...');
    const text = await ocr.extractText(filePath);
    console.log('Extracted Text (length):', text.length);
    console.log('Sample Text:', text.substring(0, 100));

    console.log('\n2. Running Forensics...');
    const report = await forensics.analyzeImage(filePath);
    console.log('Forensic Report:', JSON.stringify(report, null, 2));

    process.exit(0);
}

diagnose().catch(err => {
    console.error(err);
    process.exit(1);
});
