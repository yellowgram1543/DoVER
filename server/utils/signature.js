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
        image.greyscale();
        const { width, height } = image.bitmap;

        const scanHeight = Math.floor(height * 0.3);
        const scanY = height - scanHeight;
        
        const inkThreshold = 120;
        const clusterMinPixels = 200;
        
        let totalInkPixels = 0;
        let bounds = { minX: width, maxX: 0, minY: height, maxY: 0 };

        // Fix: Use strict object syntax for scan region in v1.6.0
        const region = {
            x: 0,
            y: scanY,
            width: width,
            height: scanHeight
        };

        image.scan(region, (x, y, idx) => {
            if (x % 2 === 0 && y % 2 === 0) {
                const lum = image.bitmap.data[idx + 0];

                if (lum < inkThreshold) {
                    if (x > 10 && x < width - 10 && y > 10 && y < height - 10) {
                        totalInkPixels++;
                        if (x < bounds.minX) bounds.minX = x;
                        if (x > bounds.maxX) bounds.maxX = x;
                        if (y < bounds.minY) bounds.minY = y;
                        if (y > bounds.maxY) bounds.maxY = y;
                    }
                }
            }
        });

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
