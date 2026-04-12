const { Jimp } = require('jimp');

async function tamper() {
    try {
        const image = await Jimp.read('original_cat.jpg');
        const { width, height } = image.bitmap;
        
        // Draw a large black box in the middle to destroy OCR text
        image.scan(Math.floor(width/4), Math.floor(height/4), Math.floor(width/2), Math.floor(height/2), function(x, y, idx) {
            this.bitmap.data[idx + 0] = 0; // R
            this.bitmap.data[idx + 1] = 0; // G
            this.bitmap.data[idx + 2] = 0; // B
            this.bitmap.data[idx + 3] = 255; // A
        });

        await image.write('tampered_cat.jpg');
        console.log('Tampered image saved as tampered_cat.jpg');
    } catch (err) {
        console.error('Tamper failed:', err);
    }
}

tamper();
