const Tesseract = require('tesseract.js');
const { Jimp } = require('jimp');
const fs = require('fs');
const path = require('path');

/**
 * Extracts text from an image (PNG, JPG) using Tesseract.js with Jimp preprocessing.
 * @param {string} filePath - Absolute path to the file.
 * @returns {Promise<string>} - Extracted text or empty string on failure.
 */
async function extractText(filePath) {
    let tempPath = '';
    try {
        if (!fs.existsSync(filePath)) return '';

        const image = await Jimp.read(filePath);
        
        // Fix 4: Split fluent chain and await write separately
        image.greyscale();
        image.contrast(0.8);
        image.brightness(0.1);
        image.normalize();
        image.scale(2);
        
        tempPath = path.join(path.dirname(filePath), 'temp_ocr_' + Date.now() + '_' + path.basename(filePath));
        await image.write(tempPath);

        // Perform OCR on the cleaned image
        const { data: { text } } = await Tesseract.recognize(
            tempPath,
            'eng',
            { logger: m => {} }
        );

        // Cleanup temp file
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        
        // Fallback to original if needed
        if (!text || text.trim().length === 0) {
            const rawResult = await Tesseract.recognize(filePath, 'eng', { logger: m => {} });
            return rawResult.data.text || '';
        }
        
        return text || '';
    } catch (error) {
        console.error('[OCR_ERROR] Failed during preprocessing or extraction:', error.message);
        if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        return '';
    }
}

/**
 * Calculates the Levenshtein distance between two strings using dynamic programming.
 * @param {string} str1 - First string.
 * @param {string} str2 - Second string.
 * @returns {number} - Levenshtein distance.
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
 * @param {string} text - The text to normalize.
 * @returns {string} - The normalized text.
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
 * @param {string} str1 - First string.
 * @param {string} str2 - Second string.
 * @returns {number} - Similarity score (0-100).
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
    levenshteinDistance,
    calculateSimilarity,
    normalizeText
};
