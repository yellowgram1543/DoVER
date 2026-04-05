const { Jimp } = require('jimp');
const tf = require('@tensorflow/tfjs');
const fs = require('fs');

/**
 * Analyzes pixel variance across a 10x10 grid to detect font inconsistencies.
 * @param {string} filePath - Absolute path to the image file.
 * @returns {Promise<Object>} - { score: 0-100, suspicious: bool }
 */
async function fontConsistencyCheck(filePath) {
    try {
        const image = await Jimp.read(filePath);
        image.greyscale();
        const { width, height } = image.bitmap;
        const cellW = Math.floor(width / 10);
        const cellH = Math.floor(height / 10);
        const variances = [];

        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 10; col++) {
                const pixels = [];
                for (let y = row * cellH; y < (row + 1) * cellH; y += Math.max(1, Math.floor(cellH/5))) {
                    for (let x = col * cellW; x < (col + 1) * cellW; x += Math.max(1, Math.floor(cellW/5))) {
                        const color = image.getPixelColor(x, y);
                        pixels.push(((color >> 24) & 0xff + (color >> 16) & 0xff + (color >> 8) & 0xff) / 3);
                    }
                }
                
                if (pixels.length > 1) {
                    const t = tf.tensor1d(pixels);
                    const m = t.mean();
                    const v = t.sub(m).square().mean();
                    variances.push((await v.data())[0]);
                    t.dispose(); m.dispose(); v.dispose();
                }
            }
        }

        const vTensor = tf.tensor1d(variances);
        const vMean = vTensor.mean();
        const vStd = vTensor.sub(vMean).square().mean().sqrt();
        const stdVal = (await vStd.data())[0];
        const meanVal = (await vMean.data())[0];
        
        vTensor.dispose(); vMean.dispose(); vStd.dispose();

        // High relative standard deviation indicates inconsistent texture/fonts
        const relStd = (stdVal / (meanVal + 1)) * 100;
        let score = Math.max(0, 100 - relStd);
        
        return { score, suspicious: score < 60 };
    } catch (e) {
        return { score: 100, suspicious: false };
    }
}

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

        // OCR-F2: Font Consistency Check
        const fontResult = await fontConsistencyCheck(filePath);
        report.font_consistency = Math.round(fontResult.score);
        if (fontResult.suspicious) {
            report.flags.push(`Inconsistent font texture detected (Score: ${report.font_consistency})`);
        }

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
