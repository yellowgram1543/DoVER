const db = require('./server/db/db');
const info = db.prepare("PRAGMA table_info(audit_log)").all();
console.log(JSON.stringify(info, null, 2));
process.exit(0);
