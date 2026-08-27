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

  // MAC опционален, но если передан – проверяем
  // if (!mac) return res.status(400).send('MAC is required'); // можно сделать обязательным

  try {
    const data = await redis.get(`key:${key}`);

    if (!data || data.status !== 'link') {
      return res.status(403).send('Invalid or unlinked key');
    }

    if (data.used) {
      return res.status(403).send('Key already used');
    }

    // Если уже привязан HWID – проверяем
    if (data.hwid && data.hwid !== hwid) {
      return res.status(403).send('HWID unauthorized');
    }

    // Если уже привязан MAC – проверяем (если передан)
    if (data.mac && mac && data.mac !== mac) {
      return res.status(403).send('MAC unauthorized');
    }

    // Привязываем HWID и MAC (если не привязаны)
    if (!data.hwid) data.hwid = hwid;
    if (!data.mac && mac) data.mac = mac;

    // Получаем код
    const scriptCode = await redis.get('script:code');
    if (!scriptCode) {
      return res.status(404).send('Script code not found');
    }

    // Если ключ одноразовый – удаляем или помечаем как used
    if (data.oneTime) {
      data.used = true;
      await redis.set(`key:${key}`, data);
      // Можно также удалить ключ полностью:
      // await redis.del(`key:${key}`);
    } else {
      // Сохраняем привязки
      await redis.set(`key:${key}`, data);
    }

    res.setHeader('Content-Type', 'text/plain');
    return res.send(scriptCode);
  } catch (error) {
    console.error('Redis Error:', error);
    return res.status(500).send('Internal server error');
  }
}
