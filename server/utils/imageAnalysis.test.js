const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Worker } = require('node:worker_threads');
const { after, before, test } = require('node:test');
const { Jimp } = require('jimp');

const {
    readImage,
    readGreyscaleImage
} = require('./imageLoader');
const { analyzeImage } = require('./forensics');
const { detectSignature } = require('./signature');

const workerPath = path.join(__dirname, 'analysis_worker.js');

let temporaryDirectory;
let validImagePath;
let tinyImagePath;
let corruptImagePath;

before(async () => {
    temporaryDirectory = fs.mkdtempSync(
        path.join(os.tmpdir(), 'dover-jimp-v1-')
    );

    validImagePath = path.join(temporaryDirectory, 'valid.png');
    tinyImagePath = path.join(temporaryDirectory, 'tiny.png');
    corruptImagePath = path.join(temporaryDirectory, 'corrupt.png');

    await new Jimp({
        width: 100,
        height: 100,
        color: 0xffffffff
    }).write(validImagePath);

    await new Jimp({
        width: 4,
        height: 4,
        color: 0xffffffff
    }).write(tinyImagePath);

    fs.writeFileSync(
        corruptImagePath,
        Buffer.from('not a valid image')
    );
});

after(() => {
    fs.rmSync(temporaryDirectory, {
        recursive: true,
        force: true
    });
});

function runWorker(filePath, type) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(workerPath, {
            workerData: {
                filePath,
                type
            }
        });

        const timeout = setTimeout(() => {
            worker.terminate();
            reject(new Error(`Worker timed out for analysis type: ${type}`));
        }, 15000);

        worker.once('message', message => {
            clearTimeout(timeout);

            worker.terminate()
                .then(() => resolve(message))
                .catch(reject);
        });

        worker.once('error', error => {
            clearTimeout(timeout);
            reject(error);
        });
    });
}

test('readImage loads a valid image with Jimp v1', async () => {
    const image = await readImage(validImagePath);

    assert.equal(image.bitmap.width, 100);
    assert.equal(image.bitmap.height, 100);
    assert.ok(image.bitmap.data.length >= 100 * 100 * 4);
});

test('readGreyscaleImage exposes the Jimp v1 greyscale API', async () => {
    const image = await readGreyscaleImage(validImagePath);

    assert.equal(typeof image.greyscale, 'function');
    assert.equal(image.bitmap.width, 100);
    assert.equal(image.bitmap.height, 100);
});

test('image loader rejects an empty path', async () => {
    await assert.rejects(
        readImage(''),
        /filePath must be a non-empty string/
    );
});

test('image loader rejects corrupt image contents', async () => {
    await assert.rejects(
        readImage(corruptImagePath)
    );
});

test('direct forensic analysis returns finite scores', async () => {
    const result = await analyzeImage(validImagePath);

    assert.equal(typeof result.suspicious, 'boolean');
    assert.ok(Array.isArray(result.flags));
    assert.ok(Number.isFinite(result.font_consistency));
    assert.ok(Number.isFinite(result.alignment_score));
});

test('direct forensic analysis handles tiny images without NaN', async () => {
    const result = await analyzeImage(tinyImagePath);

    assert.ok(Number.isFinite(result.font_consistency));
    assert.ok(Number.isFinite(result.alignment_score));
});

test('direct signature analysis preserves its public result shape', async () => {
    const result = await detectSignature(validImagePath);

    assert.equal(typeof result.signature_found, 'boolean');
    assert.equal(typeof result.seal_found, 'boolean');
    assert.ok(Number.isFinite(result.confidence));

    assert.ok(
        result.signature_region === null ||
        typeof result.signature_region === 'object'
    );
});

test('worker performs forensic analysis with Jimp v1', async () => {
    const message = await runWorker(validImagePath, 'forensics');

    assert.equal(message.success, true);
    assert.equal(typeof message.data.suspicious, 'boolean');
    assert.ok(Array.isArray(message.data.flags));
    assert.ok(Number.isFinite(message.data.font_consistency));
    assert.ok(Number.isFinite(message.data.alignment_score));
});

test('worker performs signature analysis with Jimp v1', async () => {
    const message = await runWorker(validImagePath, 'signature');

    assert.equal(message.success, true);
    assert.equal(typeof message.data.signature_found, 'boolean');
    assert.ok(Number.isFinite(message.data.confidence));

    assert.ok(
        message.data.signature_region === null ||
        typeof message.data.signature_region === 'object'
    );
});

test('worker handles tiny images without NaN scores', async () => {
    const message = await runWorker(tinyImagePath, 'forensics');

    assert.equal(message.success, true);
    assert.ok(Number.isFinite(message.data.font_consistency));
    assert.ok(Number.isFinite(message.data.alignment_score));
});

test('worker rejects corrupt images without hanging', async () => {
    const message = await runWorker(corruptImagePath, 'forensics');

    assert.equal(message.success, false);
    assert.equal(typeof message.error, 'string');
    assert.ok(message.error.length > 0);
});

test('worker reports unsupported analysis types', async () => {
    const message = await runWorker(
        validImagePath,
        'unsupported-analysis'
    );

    assert.deepEqual(message, {
        success: false,
        error: 'Unsupported analysis type: unsupported-analysis'
    });
});