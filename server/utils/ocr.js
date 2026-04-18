const Tesseract = require('tesseract.js');
const { Jimp } = require('jimp');
const fs = require('fs');
const path = require('path');

/**
 * WorkerPool manages persistent Tesseract workers for different language groups.
 */
class WorkerPool {
    constructor() {
        this.workers = {
            eng: null,
            hin: null,
            indic: null
        };
        this.initialized = false;
        this.initializing = false;
    }

    /**
     * Pre-initializes the workers to avoid delay on first request.
     */
    async init() {
        if (this.initialized || this.initializing) return;
        this.initializing = true;
        console.log('[OCR] Initializing worker pool (eng, hin, kan+tam)...');
        try {
            // engWorker
            this.workers.eng = await Tesseract.createWorker('eng');
            
            // hinWorker
            this.workers.hin = await Tesseract.createWorker('hin');
            
            // indicWorker (Kannada + Tamil)
            this.workers.indic = await Tesseract.createWorker('kan+tam');
            
            this.initialized = true;
            console.log('[OCR] Worker pool ready.');
        } catch (error) {
            console.error('[OCR] Worker pool initialization failed:', error.message);
        } finally {
            this.initializing = false;
        }
    }

    /**
     * Returns the appropriate worker for the given language tag.
     * @param {string} lang - 'eng', 'hin', or 'indic'.
     */
    async getWorker(lang) {
        if (!this.initialized) await this.init();
        return this.workers[lang] || this.workers.eng;
    }
}

const pool = new WorkerPool();

/**
 * Performs Orientation and Script Detection (OSD) to identify the primary script.
 * @param {string} filePath - Path to image file.
 * @returns {Promise<string>} - Detected script (e.g., 'Latin', 'Devanagari', 'Kannada', 'Tamil').
 */
async function detectScript(filePath) {
    let osdWorker = null;
    try {
        // OSD requires legacyCore and legacyLang in Tesseract.js v5+ for .detect()
        // OEM 0 is Legacy, which is required for OSD.
        osdWorker = await Tesseract.createWorker('osd', 0, {
            legacyCore: true,
            legacyLang: true,
            logger: m => {}
        });
        const { data } = await osdWorker.detect(filePath);
        await osdWorker.terminate();
        return data.script || 'Latin';
    } catch (error) {
        console.warn('[OCR] Script detection failed, defaulting to Latin:', error.message);
        if (osdWorker) {
            try { await osdWorker.terminate(); } catch (e) {}
        }
        return 'Latin';
    }
}

/**
 * Extracts text from an image with script detection and worker routing.
 * @param {string} filePath - Absolute path to the file.
 * @returns {Promise<string>} - Extracted text.
 */
async function extractText(filePath) {
    let tempPath = '';
    try {
        if (!fs.existsSync(filePath)) return '';

        // 1. Pre-process for better OCR
        const image = await Jimp.read(filePath);
        image.greyscale();
        image.contrast(0.8);
        image.brightness(0.1);
        image.normalize();
        image.scale(2);
        
        tempPath = path.join(path.dirname(filePath), 'temp_poly_' + Date.now() + '_' + path.basename(filePath));
        await image.write(tempPath);

        // 2. Detect Script
        const script = await detectScript(tempPath);
        console.log(`[OCR] Detected script: ${script} for ${path.basename(filePath)}`);

        // 3. Route to specialized worker
        let workerKey = 'eng';
        if (script === 'Devanagari') workerKey = 'hin';
        else if (script === 'Kannada' || script === 'Tamil') workerKey = 'indic';
        
        console.log(`[OCR] Routing to ${workerKey}Worker`);
        const worker = await pool.getWorker(workerKey);
        
        const { data: { text, confidence } } = await worker.recognize(tempPath);

        // 4. Cleanup
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

        // 5. Fallback if specialized worker had low confidence
        if (confidence < 30 && workerKey !== 'eng') {
            console.log(`[OCR] Low confidence (${confidence}), falling back to engWorker`);
            const engWorker = await pool.getWorker('eng');
            const { data: { text: engText } } = await engWorker.recognize(filePath);
            return engText || text || '';
        }
        
        return text || '';
    } catch (error) {
        console.error('[OCR_ERROR] Polyglot extraction failed:', error.message);
        if (tempPath && fs.existsSync(tempPath)) {
            try { fs.unlinkSync(tempPath); } catch (e) {}
        }
        // Last-ditch attempt on original file with eng
        try {
            const engWorker = await pool.getWorker('eng');
            const { data } = await engWorker.recognize(filePath);
            return data.text || '';
        } catch (e) {
            return '';
        }
    }
}

/**
 * Initializes the OCR worker pool. Should be called at server start.
 */
async function initWorkers() {
    await pool.init();
}

/**
 * Calculates the Levenshtein distance between two strings using dynamic programming.
 */
function levenshteinDistance(str1, str2) {
    if (str1 === str2) return 0;
    if (str1.length === 0) return str2.length;
    if (str2.length === 0) return str1.length;

    const track = Array(str2.length + 1).fill(null).map(() =>
        Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i += 1) track[0][i] = i;
    for (let j = 0; j <= str2.length; j += 1) track[j][0] = j;

    for (let j = 1; j <= str2.length; j += 1) {
        for (let i = 1; i <= str1.length; i += 1) {
            const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
            track[j][i] = Math.min(
                track[j][i - 1] + 1, // deletion
                track[j - 1][i] + 1, // insertion
                track[j - 1][i - 1] + indicator // substitution
            );
        }
    }
    return track[str2.length][str1.length];
}

/**
 * Normalizes text by converting to lowercase, removing extra whitespace/line breaks, and trimming.
 */
function normalizeText(text) {
    if (!text) return '';
    return text
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Calculates the percentage similarity between two strings using Levenshtein distance.
 */
function calculateSimilarity(str1, str2) {
    const s1 = normalizeText(str1);
    const s2 = normalizeText(str2);

    if (s1.length === 0 && s2.length === 0) return 100;
    const distance = levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    if (maxLength === 0) return 100;
    return (1 - distance / maxLength) * 100;
}

module.exports = {
    extractText,
    initWorkers,
    levenshteinDistance,
    calculateSimilarity,
    normalizeText
};
