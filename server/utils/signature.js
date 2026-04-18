const { Jimp } = require('jimp');
const fs = require('fs');

/**
 * Detects presence of handwritten signatures or official seals in an image.
 * Using Jimp only for pixel-based cluster analysis.
 * @param {string} filePath - Absolute path to the image.
 * @returns {Promise<Object>} - { signature_found, seal_found, signature_region, confidence }
 */
async function detectSignature(filePath) {
    const report = {
        signature_found: false,
        seal_found: false,
        signature_region: null,
        confidence: 0
    };

    try {
        if (!fs.existsSync(filePath)) return report;

        const image = await Jimp.read(filePath);
        if (!image || !image.bitmap || !image.bitmap.data) throw new Error('Invalid image data');
        image.greyscale();
        
        const width = Math.floor(image.bitmap.width);
        const height = Math.floor(image.bitmap.height);
        if (width === 0 || height === 0) throw new Error('Image has zero dimensions');

        const scanHeight = Math.floor(height * 0.3);
        const scanY = Math.floor(height - scanHeight);
        
        const inkThreshold = 120;
        const clusterMinPixels = 200;
        
        let totalInkPixels = 0;
        let bounds = { minX: width, maxX: 0, minY: height, maxY: 0 };

        // Manual loop with STRICT integer indices
        for (let y = 0; y < scanHeight; y++) {
            const actualY = scanY + y;
            if (actualY >= height) break;

            const rowOffset = actualY * width;
            for (let x = 0; x < width; x++) {
                if (x % 2 === 0 && y % 2 === 0) {
                    const idx = (rowOffset + x) * 4;
                    const lum = image.bitmap.data[idx + 0];

                    if (lum < inkThreshold) {
                        if (x > 10 && x < width - 10 && actualY > 10 && actualY < height - 10) {
                            totalInkPixels++;
                            if (x < bounds.minX) bounds.minX = x;
                            if (x > bounds.maxX) bounds.maxX = x;
                            if (actualY < bounds.minY) bounds.minY = actualY;
                            if (actualY > bounds.maxY) bounds.maxY = actualY;
                        }
                    }
                }
            }
        }

        if (totalInkPixels > clusterMinPixels) {
            const clusterW = bounds.maxX - bounds.minX;
            const clusterH = bounds.maxY - bounds.minY;
            const aspectRatio = clusterW / (clusterH || 1);
            
            report.confidence = Math.min(100, Math.floor((totalInkPixels / 1000) * 100));
            
            if (aspectRatio > 0.8 && aspectRatio < 1.5 && totalInkPixels > 1000) {
                report.seal_found = true;
            } else {
                report.signature_found = true;
            }

            report.signature_region = {
                x: bounds.minX,
                y: bounds.minY,
                width: clusterW,
                height: clusterH
            };
        }

        return report;
    } catch (error) {
        console.error('[SIGNATURE_ERROR]', error.message);
        return report;
    }
}

module.exports = {
    detectSignature
};
