const { isIpBlocked } = require('../utils/abuse');

module.exports = async (req, res, next) => {
    const blocked = await isIpBlocked(req.ip);
    if (blocked) {
        return res.status(403).json({ 
            error: 'Access Denied', 
            message: 'Your IP has been temporarily blocked due to multiple authentication failures. Please try again in 15 minutes.' 
        });
    }
    next();
};
