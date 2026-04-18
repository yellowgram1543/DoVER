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
        if (!image || !image.bitmap || !image.bitmap.data) throw new Error('Invalid image data');
        image.greyscale();
        
        const width = Math.floor(image.bitmap.width);
        const height = Math.floor(image.bitmap.height);
        if (width === 0 || height === 0) return { score: 100, suspicious: false };

        const cellW = Math.floor(width / 10);
        const cellH = Math.floor(height / 10);
        const variances = [];

        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 10; col++) {
                // Yield to event loop to allow Bull to renew lock
                await new Promise(r => setImmediate(r));
                
                const pixels = [];
                const startX = Math.floor(col * cellW);
                const startY = Math.floor(row * cellH);

                if (cellW > 0 && cellH > 0) {
                    // Manual loop with STRICT integer indices
                    for (let y = 0; y < cellH; y++) {
                        const actualY = startY + y;
                        if (actualY >= height) break;
                        
                        for (let x = 0; x < cellW; x++) {
                            const actualX = startX + x;
                            if (actualX >= width) break;

                            if (actualX % 5 === 0 && actualY % 5 === 0) {
                                const idx = (actualY * width + actualX) * 4;
                                const r = image.bitmap.data[idx + 0];
                                const g = image.bitmap.data[idx + 1];
                                const b = image.bitmap.data[idx + 2];
                                pixels.push((r + g + b) / 3);
                            }
                        }
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

        const relStd = (stdVal / (meanVal + 1)) * 100;
        let score = Math.max(0, 100 - relStd);
        
        return { score, suspicious: score < 60 };
    } catch (e) {
        console.error('[FONT_CHECK_ERROR]', e.message);
        return { score: 100, suspicious: false };
    }
}

/**
 * Detects horizontal text lines and checks for consistent baseline angles and rotations.
 * @param {string} filePath - Absolute path to the image file.
 * @returns {Promise<Object>} - { score: 0-100, suspicious: bool, misaligned_regions: [] }
 */
async function alignmentCheck(filePath) {
    try {
        const image = await Jimp.read(filePath);
        if (!image || !image.bitmap || !image.bitmap.data) throw new Error('Invalid image data');
        image.greyscale();
        
        const width = Math.floor(image.bitmap.width);
        const height = Math.floor(image.bitmap.height);
        if (width === 0 || height === 0) return { score: 100, suspicious: false, misaligned_regions: [] };

        const misaligned_regions = [];
        let score = 100;

        const lineY = [];
        for (let y = 0; y < height; y++) {
            if (y % 100 === 0) await new Promise(r => setImmediate(r)); // Yield every 100 lines
            
            let darkPixels = 0;
            const rowOffset = y * width;
            for (let x = 0; x < width; x += 2) {
                const idx = (rowOffset + x) * 4;
                const r = image.bitmap.data[idx + 0];
                if (r < 150) darkPixels++;
            }
            if (darkPixels > width * 0.05) lineY.push(y);
        }

        let jitterCount = 0;
        for (let i = 1; i < lineY.length; i++) {
            const diff = lineY[i] - lineY[i-1];
            if (diff > 1 && diff < 5) jitterCount++;
        }

        if (jitterCount > 50) {
            score -= 30;
            misaligned_regions.push('Multiple inconsistent baseline shifts detected');
        }

        let rotationJitter = 0;
        for (let i = 0; i < lineY.length; i += 10) {
            const y = lineY[i];
            let leftDark = 0, rightDark = 0;
            const rowOffset = y * width;
            
            const quarterWidth = Math.floor(width / 4);
            for (let x = 0; x < quarterWidth; x++) {
                const idx = (rowOffset + x) * 4;
                if (image.bitmap.data[idx + 0] < 150) leftDark++;
            }
            
            const threeQuarterWidth = Math.floor((width * 3) / 4);
            for (let x = threeQuarterWidth; x < width; x++) {
                const idx = (rowOffset + x) * 4;
                if (image.bitmap.data[idx + 0] < 150) rightDark++;
            }
            if (Math.abs(leftDark - rightDark) > width * 0.1) rotationJitter++;
        }

        if (rotationJitter > 10) {
            score -= 20;
            misaligned_regions.push('Potential rotation mismatch detected in text blocks');
        }

        return { score: Math.max(0, score), suspicious: score < 65, misaligned_regions };
    } catch (e) {
        console.error('[ALIGN_CHECK_ERROR]', e.message);
        return { score: 100, suspicious: false, misaligned_regions: [] };
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

        const fontResult = await fontConsistencyCheck(filePath);
        report.font_consistency = Math.round(fontResult.score);
        if (fontResult.suspicious) {
            report.flags.push(`Inconsistent font texture detected (Score: ${report.font_consistency})`);
        }

        const alignResult = await alignmentCheck(filePath);
        report.alignment_score = Math.round(alignResult.score);
        if (alignResult.suspicious) {
            report.flags.push(...alignResult.misaligned_regions.map(r => `${r} (Score: ${report.alignment_score})`));
        }

        const image = await Jimp.read(filePath);
        if (!image || !image.bitmap || !image.bitmap.data) return report;
        const width = Math.floor(image.bitmap.width);
        const height = Math.floor(image.bitmap.height);

        const pixels = [];
        const stepX = Math.max(1, Math.floor(width / 10));
        const stepY_noise = Math.max(1, Math.floor(height / 10));
        
        for (let y = 0; y < height; y += stepY_noise) {
            const rowOffset = y * width;
            for (let x = 0; x < width; x += stepX) {
                const idx = (rowOffset + x) * 4;
                const r = image.bitmap.data[idx + 0];
                const g = image.bitmap.data[idx + 1];
                const b = image.bitmap.data[idx + 2];
                pixels.push((r + g + b) / 3);
            }
        }

        const tensor = tf.tensor1d(pixels);
        const mean = tensor.mean();
        const std = tensor.sub(mean).square().mean().sqrt();
        const stdVal = (await std.data())[0];
        
        if (stdVal < 5) {
            report.font_consistency -= 15;
            report.flags.push('Low pixel variance detected (possible flat digital edit)');
        }

        if (report.font_consistency < 80 || report.alignment_score < 80) {
            report.suspicious = true;
        }

        tensor.dispose(); mean.dispose(); std.dispose();
        return report;
    } catch (error) {
        console.error('[FORENSICS_ERROR]', error.message);
        return report;
    }
}

module.exports = {
    analyzeImage
};
