const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Gemini Summary Service
 * Uses Gemini 1.5 Pro to extract structured intelligence from OCR text and forensics.
 */

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-1.5-pro";

let genAI = null;
if (API_KEY) {
    genAI = new GoogleGenerativeAI(API_KEY);
}

/**
 * Generates a structured document summary using AI.
 * @param {string} ocrText - Extracted text from the document.
 * @param {Object} forensicReport - The JSON report from the forensic analysis.
 * @returns {Promise<Object>} - Structured JSON with classification, entities, and risk assessment.
 */
async function generateDocumentSummary(ocrText, forensicReport) {
    if (!ocrText || ocrText.trim().length === 0) {
        return {
            status: "skipped",
            reason: "No OCR text available for analysis"
        };
    }

    if (!genAI) {
        console.warn('[GEMINI] API Key missing. Skipping AI analysis.');
        return {
            status: "unavailable",
            reason: "API key not configured"
        };
    }

    try {
        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            generationConfig: {
                responseMimeType: "application/json",
            },
        });

        const prompt = `
            You are an expert forensic document analyst. 
            Analyze the following document OCR text and forensic data.
            
            FORENSIC DATA:
            ${JSON.stringify(forensicReport, null, 2)}
            
            OCR TEXT:
            ${ocrText}

            Return a structured JSON report with the following schema:
            {
              "classification": "string (e.g. Invoice, Identity Document, Legal Deed, Receipt)",
              "summary": "string (2-3 sentence overview)",
              "entities": {
                "parties": ["list of names/organizations"],
                "dates": ["list of important dates found"],
                "amounts": ["list of financial amounts/currencies found"]
              },
              "risk_assessment": {
                "rating": "LOW | MEDIUM | HIGH",
                "reasoning": "string explaining the rating based on both OCR content and forensic flags",
                "flags": ["list of specific red flags found"]
              },
              "confidence_score": "number (0-1)"
            }
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        try {
            return JSON.parse(text);
        } catch (parseError) {
            console.error('[GEMINI] Failed to parse AI response as JSON:', text);
            return {
                status: "error",
                reason: "Invalid AI response format",
                raw: text.substring(0, 500)
            };
        }

    } catch (error) {
        console.error('[GEMINI] AI Analysis failed:', error.message);
        return {
            status: "error",
            reason: error.message
        };
    }
}

module.exports = {
    generateDocumentSummary
};
