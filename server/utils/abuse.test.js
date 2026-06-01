const test = require('node:test');
const assert = require('node:assert/strict');

const abuse = require('./abuse');

function offlineRedisFactory() {
    return {
        isOpen: false,
        on() {},
        async connect() {
            throw new Error('redis unavailable');
        }
    };
}

test('auth failures fall back to memory and block after threshold', async (t) => {
    abuse.__test.memoryStore.reset();
    abuse.__test.setRedisClientFactory(offlineRedisFactory);
    t.after(() => abuse.__test.resetRedisClientFactory());

    for (let i = 1; i <= 4; i += 1) {
        const count = await abuse.recordAuthFailure('203.0.113.10');
        assert.equal(count, i);
    }

    assert.equal(await abuse.isIpBlocked('203.0.113.10'), false);

    const count = await abuse.recordAuthFailure('203.0.113.10');
    assert.equal(count, 5);
    assert.equal(await abuse.isIpBlocked('203.0.113.10'), true);
});

test('upload velocity still records rapid upload signal during Redis outage', async (t) => {
    abuse.__test.memoryStore.reset();
    abuse.__test.setRedisClientFactory(offlineRedisFactory);
    t.after(() => abuse.__test.resetRedisClientFactory());

    await abuse.recordUploadVelocity(42);
    await abuse.recordUploadVelocity(42);
    await abuse.recordUploadVelocity(42);

    const score = await abuse.__test.memoryStore.get('abuse:score:42');
    assert.equal(score, 3);
});

