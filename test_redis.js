require('dotenv').config();
const { createClient } = require('redis');

async function test() {
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    console.log('Testing Redis at:', redisUrl);
    const client = createClient({ url: redisUrl });
    await client.connect();

    const key = 'test-nonce-999';
    await client.del(key);

    const res1 = await client.set(key, 'used', { NX: true, EX: 60 });
    console.log('First set result:', res1); // Expected: 'OK'

    const res2 = await client.set(key, 'used', { NX: true, EX: 60 });
    console.log('Second set result:', res2); // Expected: null

    await client.del(key);
    await client.disconnect();
}

test().catch(console.error);
