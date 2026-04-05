const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database('db.sqlite');

const schemaPath = path.join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

db.exec(schema);

module.exports = db;
