const { recordAuthFailure } = require('../utils/abuse');

/**
 * Middleware to validate API requests using a static API key.
 * Checks for 'x-api-key' header against process.env.API_KEY.
 */
const apiKeyMiddleware = async (req, res, next) => {
    const providedKey = req.headers['x-api-key'] || req.query.api_key;
    const systemKey = process.env.API_KEY;

    if (!providedKey) {
        return res.status(401).json({ error: "API_KEY_MISSING" });
    }

    if (providedKey !== systemKey) {
        await recordAuthFailure(req.ip);
        return res.status(403).json({ error: "API_KEY_INVALID" });
    }

    next();
};

module.exports = apiKeyMiddleware;
