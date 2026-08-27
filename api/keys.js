import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ваш_пароль';

export default async function handler(req, res) {
  // Разрешаем только POST, чтобы не светить пароль в URL
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body;

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Получаем все ключи, начинающиеся с "key:"
    // Используем SCAN для безопасного получения в продакшене
    let cursor = 0;
    let allKeys = [];
    do {
      const reply = await redis.scan(cursor, { match: 'key:*', count: 100 });
      cursor = reply[0];
      const keys = reply[1];
      allKeys = allKeys.concat(keys);
    } while (cursor !== 0);

    // Получаем статусы для каждого ключа
    const keyStatuses = {};
    for (const key of allKeys) {
      const status = await redis.get(key);
      keyStatuses[key.replace('key:', '')] = status; // убираем префикс
    }

    return res.json({ success: true, keys: keyStatuses });
  } catch (error) {
    console.error('Error fetching keys:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
