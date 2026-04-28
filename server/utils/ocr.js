const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const gemini = require('./gemini');

/**
 * WorkerPool manages persistent Tesseract workers for different language groups.
 */
class WorkerPool {
    constructor() {
        this.workers = {
            eng: null,
            hin: null,
            indic: null,
            ara: null
        };
        this.initialized = false;
        this.initializing = false;
    }

    async init() {
        if (this.initialized || this.initializing) return;
        this.initializing = true;
        console.log('[OCR] Initializing worker pool (eng, hin, kan+tam, ara)...');
        try {
            const commonParams = { user_defined_dpi: '300' };

            this.workers.eng = await Tesseract.createWorker('eng');
            await this.workers.eng.setParameters(commonParams);

            this.workers.hin = await Tesseract.createWorker('hin');
            await this.workers.hin.setParameters(commonParams);

            this.workers.indic = await Tesseract.createWorker('kan+tam');
            await this.workers.indic.setParameters(commonParams);

            this.workers.ara = await Tesseract.createWorker('ara');
            await this.workers.ara.setParameters(commonParams);

            this.initialized = true;
            console.log('[OCR] Worker pool ready.');
        } catch (error) {
            console.error('[OCR] Worker pool initialization failed:', error.message);
        } finally {
            this.initializing = false;
        }
    }

    async getWorker(lang) {
        if (!this.initialized) {
            if (this.initializing) {
                while (this.initializing) {
                    await new Promise(r => setTimeout(r, 200));
                }
            } else {
                await this.init();
            }
        }
        return this.workers[lang] || this.workers.eng;
    }

    async recycleWorker(lang) {
        console.log(`[OCR] Recycling ${lang}Worker due to timeout or failure...`);
        const workerKey = this.workers[lang] ? lang : 'eng';
        try {
            if (this.workers[workerKey]) await this.workers[workerKey].terminate();
        } catch (e) {
            console.error(`[OCR] Error terminating ${workerKey}Worker:`, e.message);
        }
        try {
            const langMap = { eng: 'eng', hin: 'hin', indic: 'kan+tam', ara: 'ara' };
            this.workers[workerKey] = await Tesseract.createWorker(langMap[workerKey]);
            await this.workers[workerKey].setParameters({ user_defined_dpi: '300' });
            console.log(`[OCR] ${workerKey}Worker recycled successfully.`);
        } catch (error) {
            console.error(`[OCR] ${workerKey}Worker recycling failed:`, error.message);
            this.workers[workerKey] = null;
        }
    }
}

const pool = new WorkerPool();

async function withTimeout(promise, ms, label = 'Operation') {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

async function detectScript(imageSource) {
    let osdWorker = null;
    try {
        osdWorker = await Tesseract.createWorker('osd', 0, {
            legacyCore: true,
            legacyLang: true,
            logger: m => {}
        });
        await osdWorker.setParameters({ user_defined_dpi: '300' });
        const { data } = await withTimeout(osdWorker.detect(imageSource), 15000, 'OSD detection');
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
 * NOTE: Jimp preprocessing removed — v1.6 dropped image-processing plugins.
 * Tesseract handles raw buffers directly with good results.
 */
async function extractText(filePath) {
    const OCR_TIMEOUT = 45000;

    try {
        if (!fs.existsSync(filePath)) return { text: '', confidence: 0, lowConfidence: true };

        console.log(`[OCR] Attempting extraction with Gemini Vision...`);
        try {
            const text = await gemini.extractTextFromImage(filePath);
            if (text) {
                console.log(`[OCR] Gemini Vision extraction successful.`);
                return { text: text, confidence: 95, lowConfidence: false };
            }
        } catch (geminiError) {
            console.error('[OCR] Gemini Vision failed, falling back to Tesseract:', geminiError.message);
        }

        // Read raw file buffer — pass directly to Tesseract (no Jimp preprocessing)
        const imageBuffer = fs.readFileSync(filePath);

        // Detect script
        const script = await detectScript(imageBuffer);
        console.log(`[OCR] Detected script: ${script} for ${path.basename(filePath)}`);

        const SUPPORTED_SCRIPTS = {
            'Latin': 'eng',
            'Devanagari': 'hin',
            'Kannada': 'indic',
            'Tamil': 'indic',
            'Arabic': 'ara'
        };
        let workerKey = SUPPORTED_SCRIPTS[script] || 'eng';
        if (!SUPPORTED_SCRIPTS[script]) {
            console.warn(`[OCR] Unsupported script "${script}" — falling back to engWorker.`);
        }

        console.log(`[OCR] Routing to ${workerKey}Worker`);
        const worker = await pool.getWorker(workerKey);
        await worker.setParameters({ user_defined_dpi: '300' });

        let recognitionResult;
        try {
            recognitionResult = await withTimeout(
                worker.recognize(imageBuffer),
                OCR_TIMEOUT,
                `${workerKey} recognition`
            );
        } catch (recognizeError) {
            console.error(`[OCR] ${workerKey}Worker failed:`, recognizeError.message);
            if (recognizeError.message.includes('timed out')) {
                pool.recycleWorker(workerKey).catch(() => {});
            }
            throw recognizeError;
        }

        const { data: { text, confidence } } = recognitionResult;
        const isLowConfidence = confidence < 20 || (text.trim().length < 5 && confidence < 50);

        // Fallback to eng if specialized worker had low confidence
        if (confidence < 30 && workerKey !== 'eng') {
            console.log(`[OCR] Low confidence (${confidence}), falling back to engWorker`);
            const engWorker = await pool.getWorker('eng');
            let engResult;
            try {
                await engWorker.setParameters({ user_defined_dpi: '300' });
                engResult = await withTimeout(
                    engWorker.recognize(imageBuffer),
                    OCR_TIMEOUT,
                    'eng fallback recognition'
                );
            } catch (engError) {
                console.error('[OCR] engWorker fallback failed:', engError.message);
                if (engError.message.includes('timed out')) {
                    pool.recycleWorker('eng').catch(() => {});
                }
                throw engError;
            }
            const { data: { text: engText, confidence: engConf } } = engResult;
            return {
                text: engText || text || '',
                confidence: Math.max(confidence, engConf),
                lowConfidence: (Math.max(confidence, engConf) < 20)
            };
        }

        return { text: text || '', confidence, lowConfidence: isLowConfidence };

    } catch (error) {
        console.error('[OCR_ERROR] Polyglot extraction failed:', error.message);
        // Last-ditch attempt on original file with eng
        try {
            const engWorker = await pool.getWorker('eng');
            await engWorker.setParameters({ user_defined_dpi: '300' });
            const imageBuffer = fs.existsSync(filePath) ? fs.readFileSync(filePath) : null;
            if (!imageBuffer) return { text: '', confidence: 0, lowConfidence: true };
            const { data } = await withTimeout(
                engWorker.recognize(imageBuffer),
                OCR_TIMEOUT,
                'last-ditch eng recognition'
            );
            return {
                text: data.text || '',
                confidence: data.confidence,
                lowConfidence: (data.confidence < 20)
            };
        } catch (e) {
            console.error('[OCR_ERROR] Last-ditch attempt also failed:', e.message);
            return { text: '', confidence: 0, lowConfidence: true };
        }
    }
}

async function initWorkers() {
    await pool.init();
}

function levenshteinDistance(str1, str2) {
    const MAX_LEN = 20000;
    const s1 = str1.length > MAX_LEN ? str1.substring(0, MAX_LEN) : str1;
    const s2 = str2.length > MAX_LEN ? str2.substring(0, MAX_LEN) : str2;

    if (s1 === s2) return 0;
    if (s1.length === 0) return s2.length;
    if (s2.length === 0) return s1.length;

    let a = s1, b = s2;
    if (a.length > b.length) [a, b] = [b, a];

    const n = a.length, m = b.length;
    let prevRow = new Int32Array(n + 1);
    let currRow = new Int32Array(n + 1);

    for (let i = 0; i <= n; i++) prevRow[i] = i;

    for (let j = 1; j <= m; j++) {
        currRow[0] = j;
        for (let i = 1; i <= n; i++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            currRow[i] = Math.min(
                currRow[i - 1] + 1,
                prevRow[i] + 1,
                prevRow[i - 1] + cost
            );
        }
        [prevRow, currRow] = [currRow, prevRow];
    }
    return prevRow[n];
}

function normalizeText(text) {
    if (!text) return '';
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function calculateSimilarity(str1, str2) {
    const s1 = normalizeText(str1);
    const s2 = normalizeText(str2);
    if (s1.length === 0 && s2.length === 0) return 100;
    const distance = levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    if (maxLength === 0) return 100;
    return (1 - distance / maxLength) * 100;
}

module.exports = { extractText, initWorkers, levenshteinDistance, calculateSimilarity, normalizeText };
