const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('../db/db');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ── Google OAuth Configuration ──
let clientID = process.env.GOOGLE_CLIENT_ID;
let clientSecret = process.env.GOOGLE_CLIENT_SECRET;

try {
    // Look for client_secret JSON file in the project root
    const rootDir = path.resolve(__dirname, '..', '..');
    const files = fs.readdirSync(rootDir);
    const secretFile = files.find(f => f.startsWith('client_secret_') && f.endsWith('.json'));

    if (secretFile) {
        console.log(`[AUTH] Using credentials from: ${secretFile}`);
        const config = JSON.parse(fs.readFileSync(path.join(rootDir, secretFile), 'utf8'));
        if (config.web) {
            clientID = config.web.client_id;
            clientSecret = config.web.client_secret;
        }
    }
} catch (e) {
    console.warn('[AUTH] Failed to read client_secret.json, falling back to .env:', e.message);
}

if (!clientID || !clientSecret) {
    console.error('[AUTH] CRITICAL ERROR: Google OAuth credentials not found in JSON or .env');
}

passport.use(new GoogleStrategy({
    clientID: clientID,
    clientSecret: clientSecret,
    callbackURL: '/auth/google/callback',
    scope: ['profile', 'email']
}, (accessToken, refreshToken, profile, done) => {
    try {
        // Find user by google_id
        let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(profile.id);

        const email = profile.emails && profile.emails[0]?.value;
        const picture = profile.photos && profile.photos[0]?.value;

        if (!user) {
            // Create new user with a generated API Secret for signing
            const userId = profile.id; 
            const apiSecret = require('crypto').randomBytes(32).toString('hex');
            
            db.prepare(`
                INSERT INTO users (id, google_id, name, email, picture, api_secret, last_login)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            `).run(userId, profile.id, profile.displayName, email, picture, apiSecret);
            
            user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        } else {
            // Update last_login
            db.prepare("UPDATE users SET last_login = datetime('now'), name = ?, email = ?, picture = ? WHERE id = ?").run(profile.displayName, email, picture, user.id);
            user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
        }

        return done(null, user);
    } catch (error) {
        return done(error);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    try {
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
        if (!user) return done(null, false); // No user found, clear session
        done(null, user);
    } catch (error) {
        done(error);
    }
});

module.exports = passport;
