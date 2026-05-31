const { recordAuthFailure } = require('../utils/abuse');

/**
 * Middleware to validate API requests using a static API key.
 * Checks ONLY the 'x-api-key' header against process.env.API_KEY.
 *
 * SECURITY: API keys must never be accepted via query parameters.
 * Query strings appear in server logs, browser history, referrer headers,
 * and proxy/CDN logs — all of which may be outside the operator's control.
 */
const apiKeyMiddleware = async (req, res, next) => {
    const providedKey = req.headers['x-api-key'];
    const systemKey = process.env.API_KEY;

    // Reject requests that attempt to pass the key via query string.
    // This provides an explicit, auditable signal rather than silently ignoring it.
    if (!providedKey && req.query.api_key) {
        await recordAuthFailure(req.ip);
        return res.status(401).json({
            error: 'API_KEY_HEADER_REQUIRED',
            message: 'API keys must be supplied via the X-Api-Key request header, not as a query parameter.'
        });
    }

    if (!providedKey) {
        return res.status(401).json({ error: 'API_KEY_MISSING' });
    }

    if (providedKey !== systemKey) {
        await recordAuthFailure(req.ip);
        return res.status(403).json({ error: 'API_KEY_INVALID' });
    }

    next();
};

module.exports = apiKeyMiddleware;
