const { Jimp } = require('jimp');
async function test() {
    try {
        const image = new Jimp({ width: 100, height: 100, color: 0x000000ff });
        console.log('Jimp created.');
        try {
            image.scan({x: 0, y: 0, width: 10, height: 10}, () => {});
            console.log('Object signature works');
        } catch (e) {
            console.log('Object signature failed:', e.message);
        }
        try {
            image.scan(0, 0, 10, 10, () => {});
            console.log('5-arg signature works');
        } catch (e) {
            console.log('5-arg signature failed:', e.message);
        }
    } catch (e) {
        console.error(e);
    }
}
test();
