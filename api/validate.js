import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.storage_KV_REST_API_URL || process.env.storage_REDIS_URL,
  token: process.env.storage_KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  const { key, hwid, mac } = req.query;

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

    // ⚠️ ПРОВЕРКА НА ИСПОЛЬЗОВАННЫЙ КЛЮЧ
    if (data.used === true) {
      return res.status(403).send('Key already used');
    }

    if (data.hwid && data.hwid !== hwid) {
      return res.status(403).send('HWID unauthorized');
    }

    if (data.mac && mac && mac !== "" && data.mac !== mac) {
      return res.status(403).send('MAC unauthorized');
    }

    if (!data.hwid) data.hwid = hwid;
    if (!data.mac && mac && mac !== "") data.mac = mac;

    const scriptCode = await redis.get('script:code');
    if (!scriptCode) {
      return res.status(404).send('Script code not found');
    }

    // ⚠️ ПОМЕЧАЕМ КЛЮЧ КАК ИСПОЛЬЗОВАННЫЙ, ЕСЛИ ОН ОДНОРАЗОВЫЙ
    if (data.oneTime === true) {
      data.used = true;
    }

    await redis.set(`key:${key}`, data);

    res.setHeader('Content-Type', 'text/plain');
    return res.send(scriptCode);
  } catch (error) {
    console.error('Redis Error:', error);
    return res.status(500).send('Internal server error');
  }
}
