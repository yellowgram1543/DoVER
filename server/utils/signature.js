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

        // 1. Scan only the bottom 30% of the image
        const scanHeight = Math.floor(height * 0.3);
        const scanY = height - scanHeight;
        
        // Settings for detection
        const inkThreshold = 120; // Darkness level to be considered "ink"
        const clusterMinPixels = 200; // Threshold from user request
        
        let totalInkPixels = 0;
        let bounds = { minX: width, maxX: 0, minY: height, maxY: 0 };

        // 2. Simple density scan to find the main "ink cluster"
        const region = {
            x: 0,
            y: scanY,
            width: width,
            height: scanHeight
        };

        // Jimp v1.6.0: scan uses positional args (x, y, w, h, callback)
        image.scan(0, scanY, width, scanHeight, (x, y, idx) => {
            // Check every 2nd pixel to save performance
            if (x % 2 === 0 && y % 2 === 0) {
                const lum = image.bitmap.data[idx + 0]; // R=G=B in greyscale

                if (lum < inkThreshold) {
                    // Exclude borders (10px) to avoid detecting scanner artifacts/frames
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

        // 3. Analyze the cluster
        if (totalInkPixels > clusterMinPixels) {
            const clusterW = bounds.maxX - bounds.minX;
            const clusterH = bounds.maxY - bounds.minY;
            const aspectRatio = clusterW / (clusterH || 1);
            
            report.confidence = Math.min(100, Math.floor((totalInkPixels / 1000) * 100));
            
            // Circular/Square-ish (aspect ratio near 1) = likely a seal
            // Highly irregular/Wide (high aspect ratio) = likely a signature
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
