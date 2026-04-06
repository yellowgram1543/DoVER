const qrcode = require('qrcode')
module.exports = {
  generateQR: (data) => qrcode.toDataURL(JSON.stringify(data))
}