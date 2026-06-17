const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
    createRedisCommandSender,
    isRedisReady
} = require('./rateLimitRedisStore');

test('isRedisReady checks the command-ready client state', () => {
    assert.equal(isRedisReady({ isOpen: true, isReady: false }), false);
    assert.equal(isRedisReady({ isOpen: true, isReady: true }), true);
});

test('createRedisCommandSender rejects before Redis is ready', async () => {
    const sendCommand = createRedisCommandSender({
        isOpen: true,
        isReady: false,
        sendCommand: async () => 'unexpected'
    });

    await assert.rejects(
        () => sendCommand('INCR', 'rl:global:test'),
        /not ready/
    );
});

test('createRedisCommandSender forwards rate-limit-redis command arguments as an array', async () => {
    const calls = [];
    const sendCommand = createRedisCommandSender({
        isReady: true,
        sendCommand: async (command) => {
            calls.push(command);
            return 'OK';
        }
    });

    const result = await sendCommand('INCR', 'rl:global:test');

    assert.equal(result, 'OK');
    assert.deepEqual(calls, [['INCR', 'rl:global:test']]);
});

test('createRedisCommandSender keeps pre-arrayed commands compatible', async () => {
    const calls = [];
    const sendCommand = createRedisCommandSender({
        isReady: true,
        sendCommand: async (command) => {
            calls.push(command);
            return 'OK';
        }
    });

    await sendCommand(['PEXPIRE', 'rl:global:test', '60000']);

    assert.deepEqual(calls, [['PEXPIRE', 'rl:global:test', '60000']]);
});
