const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('../db/db');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback',
    scope: ['profile', 'email']
}, (accessToken, refreshToken, profile, done) => {
    try {
        // Find user by google_id
        let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(profile.id);

        const email = profile.emails && profile.emails[0]?.value;
        const picture = profile.photos && profile.photos[0]?.value;

        if (!user) {
            // Create new user
            const userId = profile.id; // Or uuidv4() if you want a separate internal ID
            db.prepare(`
                INSERT INTO users (id, google_id, name, email, picture, last_login)
                VALUES (?, ?, ?, ?, ?, datetime('now'))
            `).run(userId, profile.id, profile.displayName, email, picture);
            
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
