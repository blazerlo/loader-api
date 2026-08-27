import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.storage_KV_REST_API_URL || process.env.storage_REDIS_URL,
  token: process.env.storage_KV_REST_API_TOKEN,
});

const SESSION_TTL = 60;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  const { key, hwid } = req.query;

  if (!key || typeof key !== 'string') {
    return res.status(400).send('Key is required');
  }

  if (!hwid || typeof hwid !== 'string') {
    return res.status(400).send('HWID is required');
  }

  try {
    const data = await redis.get(`key:${key}`);

    if (!data || data.status !== 'link') {
      return res.status(403).send('Invalid or unlinked key');
    }

    if (data.used === true) {
      return res.status(403).send('Key already used');
    }

    const sessionKey = `active:${key}`;
    const activeSession = await redis.get(sessionKey);
    if (activeSession) {
      const sessionData = JSON.parse(activeSession);
      if (sessionData.hwid !== hwid) {
        return res.status(403).send('Key already in use');
      }
      await redis.expire(sessionKey, SESSION_TTL);
    }

    if (!data.hwid) {
      data.hwid = hwid;
    } else if (data.hwid !== hwid) {
      return res.status(403).send('HWID unauthorized');
    }

    const scriptCode = await redis.get('script:code');
    if (!scriptCode) {
      return res.status(404).send('Script code not found');
    }

    if (data.oneTime === true) {
      data.used = true;
      await redis.set(`key:${key}`, data);
    } else {
      await redis.set(`key:${key}`, data);
    }

    await redis.set(sessionKey, JSON.stringify({ hwid }), { ex: SESSION_TTL });

    res.setHeader('Content-Type', 'text/plain');
    return res.send(scriptCode);
  } catch (error) {
    console.error('Redis Error:', error);
    return res.status(500).send('Internal server error');
  }
}
