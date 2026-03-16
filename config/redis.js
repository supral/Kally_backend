const redis = require('redis');

let client = null;

if (process.env.REDIS_URL) {
  client = redis.createClient({
    url: process.env.REDIS_URL,
  });
  client.on('error', (err) => {
    console.error('Redis error:', err.message || err);
  });
  client
    .connect()
    .then(() => {
      console.log('Redis connected');
    })
    .catch((err) => {
      console.error('Redis connect failed, continuing without cache:', err.message || err);
      client = null;
    });
} else {
  console.log('REDIS_URL not set, Redis cache disabled.');
}

function isReady() {
  return !!client && client.isOpen;
}

async function getJson(key) {
  if (!isReady()) return null;
  try {
    const raw = await client.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Redis getJson error:', err.message || err);
    return null;
  }
}

async function setJson(key, value, ttlSeconds = 30) {
  if (!isReady()) return;
  try {
    const payload = JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await client.setEx(key, ttlSeconds, payload);
    } else {
      await client.set(key, payload);
    }
  } catch (err) {
    console.error('Redis setJson error:', err.message || err);
  }
}

module.exports = {
  redisClient: client,
  getJson,
  setJson,
};

