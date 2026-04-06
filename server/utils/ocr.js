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
        
        tempPath = path.join(path.dirname(filePath), 'temp_ocr_' + path.basename(filePath));
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

module.exports = {
    extractText
};
