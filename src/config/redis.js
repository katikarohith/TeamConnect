const { createClient } = require('redis');

let redisClient = null;
let redisReady = false;

async function connectRedis() {
  if (!process.env.REDIS_URL) {
    console.warn('REDIS_URL is not configured. Redis features will use safe in-memory fallbacks.');
    return null;
  }

  redisClient = createClient({ url: process.env.REDIS_URL, socket: { reconnectStrategy: (retries) => Math.min(retries * 100, 3000) } });
  redisClient.on('error', (error) => console.error('Redis error:', error.message));
  redisClient.on('ready', () => { redisReady = true; console.log('Connected to Upstash Redis.'); });
  redisClient.on('end', () => { redisReady = false; });

  try {
    await redisClient.connect();
    return redisClient;
  } catch (error) {
    redisReady = false;
    console.warn(`Redis unavailable; continuing without Redis: ${error.message}`);
    return null;
  }
}

function getRedis() {
  return redisReady ? redisClient : null;
}

async function createRedisDuplicate() {
  const client = getRedis();
  if (!client) return null;
  const duplicate = client.duplicate();
  duplicate.on('error', (error) => console.error('Redis adapter error:', error.message));
  await duplicate.connect();
  return duplicate;
}

module.exports = { connectRedis, getRedis, createRedisDuplicate };
