const gemini = require('../server/utils/gemini');

async function runTest() {
    console.log('--- STARTING AI INTEGRATION TEST ---');
    
    const mockOcrText = `
        OFFICIAL RECEIPT
        LOREM SHOP INC.
        Date: 12-April-2026
        Item: Laptop Pro 14
        Total: $1,200.00
        Status: PAID
    `;

    const mockForensicReport = {
        font_consistency: 95,
        alignment_score: 92,
        suspicious: false,
        flags: []
    };

    try {
        const result = await gemini.generateDocumentSummary(mockOcrText, mockForensicReport);
        
        console.log('\n--- AI RESPONSE ---');
        console.log(JSON.stringify(result, null, 2));
        
        if (result.classification && !result.reason) {
            console.log('\n✅ TEST SUCCESS: Gemini is working perfectly with the new key!');
        } else {
            console.log('\n❌ TEST FAILED: Response received but looks invalid.');
        }
    } catch (error) {
        console.error('\n❌ TEST CRASHED:', error.message);
    }
}

runTest();
