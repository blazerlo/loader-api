import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.storage_KV_REST_API_URL || process.env.storage_REDIS_URL,
  token: process.env.storage_KV_REST_API_TOKEN,
});

const SESSION_TTL = 60; // секунд

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
    // Получаем данные ключа
    const data = await redis.get(`key:${key}`);

    if (!data || data.status !== 'link') {
      return res.status(403).send('Invalid or unlinked key');
    }

    if (data.used) {
      return res.status(403).send('Key already used');
    }

    // Проверяем, не активен ли ключ уже
    const isActive = await redis.get(`active:${key}`);
    if (isActive) {
      return res.status(403).send('Key already in use');
    }

    // Проверяем HWID и MAC (если привязаны)
    if (data.hwid && data.hwid !== hwid) {
      return res.status(403).send('HWID unauthorized');
    }
    if (data.mac && mac && data.mac !== mac) {
      return res.status(403).send('MAC unauthorized');
    }

    // Если HWID или MAC не привязаны – привязываем
    if (!data.hwid) data.hwid = hwid;
    if (mac && !data.mac) data.mac = mac;

    // Если ключ одноразовый – помечаем как used
    if (data.oneTime) {
      data.used = true;
      // Сохраняем привязки и used
      await redis.set(`key:${key}`, data);
      // Не удаляем сразу, чтобы heartbeat не мог продлить, но ключ уже не будет работать
    } else {
      // Сохраняем привязки
      await redis.set(`key:${key}`, data);
    }

    // Устанавливаем активную сессию с TTL
    await redis.set(`active:${key}`, '1', { ex: SESSION_TTL });

    // Получаем код
    const scriptCode = await redis.get('script:code');
    if (!scriptCode) {
      return res.status(404).send('Script code not found');
    }

    res.setHeader('Content-Type', 'text/plain');
    return res.send(scriptCode);
  } catch (error) {
    console.error('Redis Error:', error);
    return res.status(500).send('Internal server error');
  }
}
