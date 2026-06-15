const isRedisReady = (redisClient) => redisClient?.isReady === true;

const createRedisCommandSender = (redisClient) => async (...args) => {
    if (!isRedisReady(redisClient)) {
        throw new Error('Redis rate-limit store is not ready');
    }

    const command = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
    return redisClient.sendCommand(command);
};

const createRateLimitRedisStore = (redisClient, options = {}) => {
    const { RedisStore } = require('rate-limit-redis');
    return new RedisStore({
        sendCommand: createRedisCommandSender(redisClient),
        ...options
    });
};

module.exports = {
    createRateLimitRedisStore,
    createRedisCommandSender,
    isRedisReady
};
