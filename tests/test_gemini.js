const gemini = require('../server/utils/gemini');
const assert = require('assert');

async function testGemini() {
    console.log('Testing Gemini Summary Service...');

    // Test 1: Missing OCR text
    console.log('Test 1: Missing OCR text');
    const result1 = await gemini.generateDocumentSummary('', {});
    assert.strictEqual(result1.status, 'skipped');
    console.log('✓ Passed');

    // Test 2: Missing API Key (assuming GEMINI_API_KEY is not set in this environment)
    console.log('Test 2: Missing API Key');
    // We can't easily unset env vars in node once loaded by dotenv, 
    // but we can check if it returns unavailable if no key was provided at startup.
    const result2 = await gemini.generateDocumentSummary('Some OCR text', {});
    if (!process.env.GEMINI_API_KEY) {
        assert.strictEqual(result2.status, 'unavailable');
        console.log('✓ Passed (Key missing)');
    } else {
        console.log('Skipping Test 2 because GEMINI_API_KEY is present');
    }

    console.log('Gemini tests completed.');
}

testGemini().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
