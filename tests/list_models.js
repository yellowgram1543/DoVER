const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyASnQjxTl5JtUEj2_tvqjbtAe_yHxrt47Y";

async function listModels() {
    console.log('--- FETCHING SUPPORTED MODELS ---');
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.error('Error:', data.error.message);
            return;
        }

        console.log('Available models for your key:');
        data.models.forEach(m => {
            if (m.supportedGenerationMethods.includes('generateContent')) {
                console.log(` - ${m.name.replace('models/', '')} (${m.displayName})`);
            }
        });
    } catch (error) {
        console.error('Failed to list models:', error.message);
    }
}

listModels();
