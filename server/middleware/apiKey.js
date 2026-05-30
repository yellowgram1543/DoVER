const crypto = require('crypto');
const { recordAuthFailure } = require('../utils/abuse');

function normalizeApiKey(value) {
    if (Array.isArray(value)) return value[0];
    return value;
}

function digestApiKey(value) {
    return crypto.createHash('sha256').update(String(value), 'utf8').digest();
}

function apiKeysMatch(providedKey, systemKey) {
    if (!providedKey || !systemKey) return false;

    const providedDigest = digestApiKey(providedKey);
    const systemDigest = digestApiKey(systemKey);

    return crypto.timingSafeEqual(providedDigest, systemDigest);
}

/**
 * Middleware to validate API requests using a static API key.
 * Checks for 'x-api-key' header against process.env.API_KEY.
 */
const apiKeyMiddleware = async (req, res, next) => {
    const providedKey = normalizeApiKey(req.headers['x-api-key'] || req.query.api_key);
    const systemKey = process.env.API_KEY;

    if (!providedKey) {
        return res.status(401).json({ error: "API_KEY_MISSING" });
    }

    if (!apiKeysMatch(providedKey, systemKey)) {
        await recordAuthFailure(req.ip);
        return res.status(403).json({ error: "API_KEY_INVALID" });
    }

    next();
};

module.exports = apiKeyMiddleware;
module.exports.apiKeysMatch = apiKeysMatch;
