const ocr = require('../server/utils/ocr');
const path = require('path');
const fs = require('fs');

async function runTest() {
    console.log('--- OCR Multi-Lang Test ---');
    
    // 1. Initialize Workers
    await ocr.initWorkers();
    
    // 2. Test with an existing image
    const testImage = path.resolve(__dirname, '../food_image.jpg');
    if (!fs.existsSync(testImage)) {
        console.error('Test image not found:', testImage);
        return;
    }
    
    console.log('Processing:', testImage);
    const text = await ocr.extractText(testImage);
    
    console.log('--- Extracted Text ---');
    console.log(text.substring(0, 200) + (text.length > 200 ? '...' : ''));
    console.log('--- End of Text ---');
    
    process.exit(0);
}

runTest().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
