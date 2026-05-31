const crypto = require('crypto');
const { recordAuthFailure } = require('../utils/abuse');


function apiKeysMatch(provided, system) {
    if (!provided || !system) return false;

    const hash = (val) =>
        crypto.createHash('sha256').update(val, 'utf8').digest();

    return crypto.timingSafeEqual(hash(provided), hash(system));
}

/**
 * Middleware to validate API requests using a static API key.
 *
 * Accepts ONLY the `X-Api-Key` request header.
 *
 * SECURITY: API keys must never be accepted via query parameters.
 * Query strings appear in server access logs, nginx/CDN/proxy logs,
 * browser history, and Referer headers sent to third-party scripts —
 * all channels outside operator control.
 */
const apiKeyMiddleware = async (req, res, next) => {
    const providedKey = req.headers['x-api-key'];
    const systemKey = process.env.API_KEY;

    if (!providedKey && req.query.api_key) {
        await recordAuthFailure(req.ip);
        console.warn(
            `[APIKEY_QUERY_PARAM] Key supplied via query string by ${req.ip} — header required.`
        );
        return res.status(401).json({
            error: 'API_KEY_HEADER_REQUIRED',
            message: 'API keys must be supplied via the X-Api-Key request header, not as a query parameter.'
        });
    }

    if (!providedKey) {
        return res.status(401).json({ error: 'API_KEY_MISSING' });
    }

    if (!apiKeysMatch(providedKey, systemKey)) {
        await recordAuthFailure(req.ip);
        return res.status(403).json({ error: 'API_KEY_INVALID' });
    }

    next();
};

module.exports = apiKeyMiddleware;
// apiKeysMatch is intentionally NOT exported — it is an internal
// security primitive and should not be callable from outside this module.
