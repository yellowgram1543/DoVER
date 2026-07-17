const { Jimp } = require('jimp');

/**
 * Validates that an image contains usable RGBA bitmap data.
 *
 * @param {object} image - Jimp image instance.
 * @returns {object} The validated image.
 * @throws {Error} If the image bitmap is invalid.
 */
function validateBitmap(image) {
    const bitmap = image?.bitmap;
    const width = bitmap?.width;
    const height = bitmap?.height;
    const data = bitmap?.data;

    const hasValidData =
        Buffer.isBuffer(data) || data instanceof Uint8Array;

    if (
        !hasValidData ||
        !Number.isInteger(width) ||
        !Number.isInteger(height) ||
        width <= 0 ||
        height <= 0 ||
        data.length < width * height * 4
    ) {
        throw new Error('Invalid image data');
    }

    return image;
}

/**
 * Reads and validates an image using the Jimp v1 API.
 *
 * @param {string} filePath - Path to the image.
 * @returns {Promise<object>} A validated Jimp image.
 */
async function readImage(filePath) {
    if (typeof filePath !== 'string' || filePath.trim() === '') {
        throw new TypeError('filePath must be a non-empty string');
    }

    const image = await Jimp.read(filePath);
    return validateBitmap(image);
}

/**
 * Reads, validates, and converts an image to greyscale.
 *
 * @param {string} filePath - Path to the image.
 * @returns {Promise<object>} A validated greyscale Jimp image.
 */
async function readGreyscaleImage(filePath) {
    const image = await readImage(filePath);
    image.greyscale();

    return image;
}

module.exports = {
    readImage,
    readGreyscaleImage,
    validateBitmap
};