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

        // 1. Preprocess image with Jimp to improve OCR accuracy
        const image = await Jimp.read(filePath);
        
        // Convert to grayscale, increase contrast, and sharpen
        // We also upscale slightly to help read small text/punctuation
        tempPath = path.join(path.dirname(filePath), 'temp_ocr_' + path.basename(filePath));
        
        await image
            .greyscale()            // Remove color noise
            .contrast(0.8)          // Make text pop
            .brightness(0.1)        // Brighten background
            .normalize()            // Standardize colors
            .scale(2)               // Upscale for better small char detection
            .write(tempPath);

        // 2. Perform OCR on the cleaned image
        const { data: { text } } = await Tesseract.recognize(
            tempPath,
            'eng',
            { 
                logger: m => {},
                // Tesseract config for better digit/punctuation reading
                tessedit_char_whitelist: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.,:$%-/ '
            }
        );

        // 3. Cleanup temp file
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        
        return text || '';
    } catch (error) {
        console.error('[OCR_ERROR] Failed during preprocessing or extraction:', error.message);
        // Cleanup on failure
        if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        return '';
    }
}

module.exports = {
    extractText
};
