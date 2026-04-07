const { Jimp } = require('jimp');
const fs = require('fs');

async function modifyImage() {
    try {
        const image = await Jimp.read('test.png');
        // Draw a small white box over a piece of text (e.g., at x:50, y:50)
        // This is a subtle change that should alter the OCR result
        const white = { r: 255, g: 255, b: 255, a: 255 };
        const region = { x: 50, y: 50, width: 30, height: 15 };
        
        image.scan(region.x, region.y, region.width, region.height, (x, y, idx) => {
            image.bitmap.data[idx + 0] = 255;
            image.bitmap.data[idx + 1] = 255;
            image.bitmap.data[idx + 2] = 255;
            image.bitmap.data[idx + 3] = 255;
        });

        await image.write('modified.png');
        console.log('Successfully created modified.png');
    } catch (err) {
        console.error('Error modifying image:', err.message);
    }
}

modifyImage();