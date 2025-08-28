const redis = require('redis');

let client = null;

async function connectRedis() {
  try {
    if (process.env.REDIS_URL) {
      // Connect to Render Redis
      const redisUrl = process.env.REDIS_URL;
      const isExternalUrl = redisUrl.includes('oregon-keyvalue.render.com');
      
      client = redis.createClient({
        url: redisUrl,
        socket: isExternalUrl ? {
          tls: true,
          rejectUnauthorized: false
        } : undefined
      });
      
      client.on('error', (err) => console.error('Redis Client Error:', err));
      client.on('connect', () => console.log('✅ Connected to Render Redis'));
      
      await client.connect();
      return client;
    } else {
      // Use in-memory cache if Redis URL not provided
      console.log('⚠️  Redis URL not configured - using in-memory cache');
      console.log('   To use Render Redis, create one and add REDIS_URL to .env');
      
      const cache = new Map();
      client = {
        get: async (key) => cache.get(key) || null,
        set: async (key, value, options) => {
          cache.set(key, value);
          if (options?.EX) {
            setTimeout(() => cache.delete(key), options.EX * 1000);
          }
          return true;
        },
        del: async (key) => cache.delete(key),
        on: () => {},
        connect: async () => {},
        isReady: true
      };
      
      return client;
    }
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    // Fallback to in-memory cache
    const cache = new Map();
    client = {
      get: async (key) => cache.get(key) || null,
      set: async (key, value) => { cache.set(key, value); return true; },
      del: async (key) => cache.delete(key),
      on: () => {},
      connect: async () => {},
      isReady: false
    };
    return client;
  }
}

function getClient() {
  if (!client) {
    throw new Error('Redis client not initialized');
  }
  return client;
}

module.exports = {
  connectRedis,
  getClient
};