const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '..', 'db.sqlite');
const db = new Database(dbPath);

const email = process.argv[2];

if (!email) {
    console.error('Usage: node scripts/promote.js <email>');
    process.exit(1);
}

const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
}

try {
    const info = db.prepare("UPDATE users SET role = 'authority' WHERE email = ?").run(email);
    if (info.changes > 0) {
        console.log(`Successfully promoted ${email} to authority.`);
    } else {
        console.log(`No changes made to ${email}.`);
    }
} catch (error) {
    console.error(`Failed to promote user: ${error.message}`);
    process.exit(1);
} finally {
    db.close();
}
