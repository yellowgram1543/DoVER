const { VertexAI } = require('@google-cloud/vertexai');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Vertex AI Service (Google Cloud Enterprise Version)
 * This uses the official Google Cloud Project ID and IAM credentials.
 */

// Replace with your project ID from the screenshot
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'dover-493719';
const LOCATION = process.env.GOOGLE_CLOUD_REGION || 'us-central1';

const vertexAI = new VertexAI({ project: PROJECT_ID, location: LOCATION });

async function generateDocumentSummary(ocrText, forensicReport) {
    if (!ocrText || ocrText.trim().length === 0) return { status: "skipped", reason: "No OCR text" };

    try {
        const generativeModel = vertexAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
        });

        const prompt = `
            You are a forensic document analyst. Analyze this document.
            OCR TEXT: ${ocrText}
            FORENSIC DATA: ${JSON.stringify(forensicReport)}

            Return a raw JSON object with this exact schema:
            {
              "classification": "string",
              "summary": "string",
              "confidence_score": 0.95,
              "entities": { "parties": [], "dates": [], "amounts": [] },
              "risk_assessment": { "rating": "LOW|MEDIUM|HIGH", "reasoning": "string", "flags": [] }
            }
            Note: confidence_score must be a float between 0.0 and 1.0 based on data quality and forensic health.
        `;

        const request = {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        };

        const result = await generativeModel.generateContent(request);
        const response = await result.response;
        let text = response.candidates[0].content.parts[0].text;
        
        // Remove markdown fences if present
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        console.log('[VERTEX AI] ✓ Success');
        return JSON.parse(text);

    } catch (error) {
        console.error('[VERTEX AI] ✗ Failed:', error.message);
        return { status: "error", reason: error.message };
    }
}

module.exports = { generateDocumentSummary };
