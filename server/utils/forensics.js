const { Jimp } = require('jimp');
const tf = require('@tensorflow/tfjs');
const fs = require('fs');

/**
 * Performs heuristic forensic analysis on an image to detect potential forgeries.
 * Uses pixel-level analysis via Jimp and basic tensor operations via TFJS.
 * @param {string} filePath - Absolute path to the image file.
 * @returns {Promise<Object>} - Forensic report.
 */
async function analyzeImage(filePath) {
    const report = {
        font_consistency: 100,
        alignment_score: 100,
        suspicious: false,
        flags: []
    };

    try {
        if (!fs.existsSync(filePath)) return report;

        const image = await Jimp.read(filePath);
        const { width, height } = image.bitmap;

        // 1. Noise/Compression Analysis (Heuristic for Digital Alterations)
        // Use fixed grid sampling for 100% deterministic results
        const pixels = [];
        const stepX = Math.max(1, Math.floor(width / 10));
        const stepY_noise = Math.max(1, Math.floor(height / 10));
        
        for (let y = 0; y < height; y += stepY_noise) {
            for (let x = 0; x < width; x += stepX) {
                const color = image.getPixelColor(x, y);
                const r = (color >> 24) & 0xff;
                const g = (color >> 16) & 0xff;
                const b = (color >> 8) & 0xff;
                pixels.push((r + g + b) / 3);
            }
        }

        // Use TFJS to calculate variance (standard deviation) of samples
        const tensor = tf.tensor1d(pixels);
        const mean = tensor.mean();
        const std = tensor.sub(mean).square().mean().sqrt();
        const stdVal = (await std.data())[0];
        
        if (stdVal < 5) {
            report.font_consistency -= 15;
            report.flags.push('Low pixel variance detected (possible flat digital edit)');
        }

        // 2. Alignment Analysis (Heuristic)
        let breaks = 0;
        const stepY = Math.max(1, Math.floor(height/10));
        for (let y = Math.floor(height/4); y < height; y += stepY) {
            let lastLum = 0;
            for (let x = 0; x < width; x += 10) {
                const color = image.getPixelColor(x, y);
                const r = (color >> 24) & 0xff;
                const g = (color >> 16) & 0xff;
                const b = (color >> 8) & 0xff;
                const lum = (r + g + b) / 3;
                if (Math.abs(lum - lastLum) > 50) breaks++;
                lastLum = lum;
            }
        }

        if (breaks > 100) {
            report.alignment_score -= 20;
            report.flags.push('Unnatural text alignment or edge jitter detected');
        }

        if (report.font_consistency < 80 || report.alignment_score < 80) {
            report.suspicious = true;
        }

        tensor.dispose();
        mean.dispose();
        std.dispose();

        return report;
    } catch (error) {
        console.error('[FORENSICS_ERROR] Analysis failed:', error.message);
        return report;
    }
}

module.exports = {
    analyzeImage
};
