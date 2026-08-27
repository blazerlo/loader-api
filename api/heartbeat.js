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

  const { key, hwid, mac } = req.query;

  if (!key) return res.status(400).send('Key required');
  if (!hwid) return res.status(400).send('HWID required');

  try {
    const data = await redis.get(`key:${key}`);
    if (!data || data.status !== 'link') {
      return res.status(403).send('Invalid key');
    }
    if (data.used) {
      return res.status(403).send('Key already used');
    }
    // Проверяем HWID/MAC
    if (data.hwid && data.hwid !== hwid) {
      return res.status(403).send('HWID unauthorized');
    }
    if (data.mac && mac && data.mac !== mac) {
      return res.status(403).send('MAC unauthorized');
    }

    // Проверяем, активна ли сессия (она должна быть)
    const isActive = await redis.get(`active:${key}`);
    if (!isActive) {
      // Если сессия истекла, но клиент ещё жив – можно пересоздать сессию
      // Но лучше не разрешать автоматическое восстановление, чтобы избежать конфликтов
      return res.status(403).send('Session expired');
    }

    // Продлеваем TTL
    await redis.expire(`active:${key}`, SESSION_TTL);

    return res.send('OK');
  } catch (error) {
    console.error('Heartbeat error:', error);
    return res.status(500).send('Internal server error');
  }
}
