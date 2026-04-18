const { parentPort, workerData } = require('worker_threads');
const { Jimp } = require('jimp');
const tf = require('@tensorflow/tfjs');
const fs = require('fs');

/**
 * Heavy computation worker for image analysis.
 */
async function runAnalysis() {
    const { filePath, type } = workerData;
    
    try {
        if (type === 'forensics') {
            const result = await analyzeImageInternal(filePath);
            parentPort.postMessage({ success: true, data: result });
        } else if (type === 'signature') {
            const result = await detectSignatureInternal(filePath);
            parentPort.postMessage({ success: true, data: result });
        }
    } catch (error) {
        parentPort.postMessage({ success: false, error: error.message });
    }
}

async function fontConsistencyCheckInternal(filePath) {
    const image = await Jimp.read(filePath);
    if (!image || !image.bitmap || !image.bitmap.data) throw new Error('Invalid image data');
    image.greyscale();
    
    const width = Math.floor(image.bitmap.width);
    const height = Math.floor(image.bitmap.height);
    const cellW = Math.floor(width / 10);
    const cellH = Math.floor(height / 10);
    const variances = [];

    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
            const pixels = [];
            const startX = Math.floor(col * cellW);
            const startY = Math.floor(row * cellH);

            if (cellW > 0 && cellH > 0) {
                for (let y = 0; y < cellH; y++) {
                    const actualY = startY + y;
                    if (actualY >= height) break;
                    const rowOffset = actualY * width;
                    for (let x = 0; x < cellW; x++) {
                        const actualX = startX + x;
                        if (actualX >= width) break;
                        if (actualX % 5 === 0 && actualY % 5 === 0) {
                            const idx = (rowOffset + actualX) * 4;
                            pixels.push((image.bitmap.data[idx] + image.bitmap.data[idx+1] + image.bitmap.data[idx+2]) / 3);
                        }
                    }
                }
            }
            if (pixels.length > 1) {
                const t = tf.tensor1d(pixels);
                variances.push(t.sub(t.mean()).square().mean().dataSync()[0]);
                t.dispose();
            }
        }
    }

    const vTensor = tf.tensor1d(variances);
    const stdVal = vTensor.sub(vTensor.mean()).square().mean().sqrt().dataSync()[0];
    const meanVal = vTensor.mean().dataSync()[0];
    vTensor.dispose();

    const relStd = (stdVal / (meanVal + 1)) * 100;
    let score = Math.max(0, 100 - relStd);
    return { score, suspicious: score < 60 };
}

async function alignmentCheckInternal(filePath) {
    const image = await Jimp.read(filePath);
    image.greyscale();
    const width = image.bitmap.width;
    const height = image.bitmap.height;
    const lineY = [];

    for (let y = 0; y < height; y++) {
        let darkPixels = 0;
        const offset = y * width;
        for (let x = 0; x < width; x += 2) {
            if (image.bitmap.data[(offset + x) * 4] < 150) darkPixels++;
        }
        if (darkPixels > width * 0.05) lineY.push(y);
    }

    const misaligned_regions = [];
    let score = 100;
    let jitter = 0;
    for (let i = 1; i < lineY.length; i++) if (lineY[i] - lineY[i-1] < 5) jitter++;
    if (jitter > 50) { score -= 30; misaligned_regions.push('Inconsistent baseline shifts'); }

    return { score: Math.max(0, score), suspicious: score < 65, misaligned_regions };
}

async function analyzeImageInternal(filePath) {
    const fontResult = await fontConsistencyCheckInternal(filePath);
    const alignResult = await alignmentCheckInternal(filePath);
    
    // Additional simple variance check
    const image = await Jimp.read(filePath);
    const pixels = [];
    for (let i=0; i<image.bitmap.data.length; i+=1000) pixels.push(image.bitmap.data[i]);
    const t = tf.tensor1d(pixels);
    const stdVal = t.sub(t.mean()).square().mean().sqrt().dataSync()[0];
    t.dispose();

    const flags = [];
    if (fontResult.suspicious) flags.push(`Font texture mismatch (Score: ${Math.round(fontResult.score)})`);
    if (alignResult.suspicious) flags.push(...alignResult.misaligned_regions);
    if (stdVal < 5) flags.push('Low pixel variance (Possible digital edit)');

    return {
        font_consistency: Math.round(fontResult.score),
        alignment_score: Math.round(alignResult.score),
        suspicious: fontResult.suspicious || alignResult.suspicious || stdVal < 5,
        flags
    };
}

async function detectSignatureInternal(filePath) {
    const image = await Jimp.read(filePath);
    image.greyscale();
    const { width, height } = image.bitmap;
    const scanHeight = Math.floor(height * 0.3);
    const scanY = height - scanHeight;
    let totalInk = 0;
    let bounds = { minX: width, maxX: 0, minY: height, maxY: 0 };

    for (let y = scanY; y < height; y++) {
        const offset = y * width;
        for (let x = 0; x < width; x++) {
            if (x % 2 === 0 && y % 2 === 0) {
                if (image.bitmap.data[(offset + x) * 4] < 120) {
                    if (x > 10 && x < width - 10) {
                        totalInk++;
                        if (x < bounds.minX) bounds.minX = x;
                        if (x > bounds.maxX) bounds.maxX = x;
                        if (y < bounds.minY) bounds.minY = y;
                        if (y > bounds.maxY) bounds.maxY = y;
                    }
                }
            }
        }
    }

    const found = totalInk > 200;
    return {
        signature_found: found,
        confidence: Math.min(100, Math.floor((totalInk / 1000) * 100)),
        signature_region: found ? { x: bounds.minX, y: bounds.minY, width: bounds.maxX-bounds.minX, height: bounds.maxY-bounds.minY } : null
    };
}

runAnalysis();
