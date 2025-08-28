// Simple in-memory cache for demo (would use Redis in production)
const cache = new Map();

async function getCache(key) {
  return cache.get(key);
}

async function setCache(key, value, ttl = 300) {
  cache.set(key, value);
  
  // Auto-expire after TTL
  setTimeout(() => {
    cache.delete(key);
  }, ttl * 1000);
  
  return true;
}

module.exports = {
  getCache,
  setCache,
  cache
};