const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const mime = require('mime-types');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Gemini Summary Service (SDK Version)
 * Simplified for maximum reliability with API Key.
 */

const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyASnQjxTl5JtUEj2_tvqjbtAe_yHxrt47Y";
const genAI = new GoogleGenerativeAI(API_KEY);

async function generateDocumentSummary(ocrText, forensicReport) {
    if (!ocrText || ocrText.trim().length === 0) return { status: "skipped", reason: "No OCR text" };

    try {
        // Use gemini-flash-latest for stable quota
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

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

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();
        
        // Remove markdown fences if present
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        console.log('[GEMINI] ✓ Success');
        return JSON.parse(text);

    } catch (error) {
        console.error('[GEMINI] ✗ Failed:', error.message);
        return { status: "error", reason: error.message };
    }
}

async function extractTextFromImage(filePath) {
    try {
        if (!fs.existsSync(filePath)) throw new Error("File not found");
        
        const mimeType = mime.lookup(filePath) || 'image/jpeg';
        const imageBase64 = fs.readFileSync(filePath).toString('base64');
        
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = "Extract all text from this image exactly as written. Do not add any extra commentary.";
        
        const imagePart = {
            inlineData: {
                data: imageBase64,
                mimeType
            }
        };

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        return response.text().trim();
    } catch (error) {
        console.error('[GEMINI_VISION] ✗ OCR Failed:', error.message);
        throw error;
    }
}

module.exports = { generateDocumentSummary, extractTextFromImage };
