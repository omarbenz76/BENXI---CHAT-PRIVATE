/**
 * BENXI — Redis Connection
 */

'use strict';

const Redis = require('ioredis');

let redis;

async function connectRedis() {
  redis = new Redis({
    host:     process.env.REDIS_HOST || 'redis',
    port:     parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    lazyConnect: true,
    enableOfflineQueue: false,
  });

  await redis.connect();

  if (process.env.LOG_LEVEL !== 'none') {
    console.log('[redis] Connected');
  }
}

module.exports = { connectRedis, get redis() { return redis; } };
