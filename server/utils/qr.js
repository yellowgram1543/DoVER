const qrcode = require('qrcode')
module.exports = {
  generateQR: (data) => qrcode.toDataURL(typeof data === 'string' ? data : JSON.stringify(data))
}