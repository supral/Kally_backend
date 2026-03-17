const redis = require('redis');

let client = null;

function buildRedisUrlFromParts() {
  const host = (process.env.REDIS_HOST || '').trim();
  const port = (process.env.REDIS_PORT || '').trim();
  const user = (process.env.REDIS_USER || 'default').trim();
  const password = (process.env.REDIS_PASSWORD || '').trim();
  const tls = String(process.env.REDIS_TLS || '').trim();

  if (!host) return null;
  const hasProtocol = /^rediss?:\/\//i.test(host);
  if (hasProtocol) return host;

  const scheme = tls === '1' || /^true$/i.test(tls) ? 'rediss' : 'redis';
  const auth =
    password
      ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}@`
      : (user ? `${encodeURIComponent(user)}@` : '');
  const hp = port ? `${host}:${port}` : host;
  return `${scheme}://${auth}${hp}`;
}

const redisUrl = (process.env.REDIS_URL || '').trim() || buildRedisUrlFromParts();

if (redisUrl) {
  client = redis.createClient({
    url: redisUrl,
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
  console.log('Redis config not set (REDIS_URL or REDIS_HOST/REDIS_PORT), Redis cache disabled.');
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

