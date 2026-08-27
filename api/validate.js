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

  const { key, hwid, fingerprint } = req.query;

  if (!key || typeof key !== 'string') {
    return res.status(400).send('Key is required');
  }

  if (!hwid || typeof hwid !== 'string') {
    return res.status(400).send('HWID is required');
  }

  if (!fingerprint || typeof fingerprint !== 'string') {
    return res.status(400).send('Fingerprint is required');
  }

  try {
    const data = await redis.get(`key:${key}`);

    if (!data || data.status !== 'link') {
      return res.status(403).send('Invalid or unlinked key');
    }

    // Проверка на использованный (одноразовый)
    if (data.used === true) {
      return res.status(403).send('Key already used');
    }

    // Проверка активной сессии (один игрок одновременно)
    const sessionKey = `active:${key}`;
    const activeSession = await redis.get(sessionKey);
    if (activeSession) {
      // Если активная сессия есть, но это тот же hwid+fingerprint – пропускаем
      const sessionData = JSON.parse(activeSession);
      if (sessionData.hwid !== hwid || sessionData.fingerprint !== fingerprint) {
        return res.status(403).send('Key already in use');
      }
      // Если совпадает – обновляем TTL
      await redis.expire(sessionKey, SESSION_TTL);
    }

    // Привязываем HWID и fingerprint, если ещё не привязаны
    if (!data.hwid) data.hwid = hwid;
    if (!data.fingerprint) data.fingerprint = fingerprint;

    // Если HWID или fingerprint не совпадают – кик
    if (data.hwid !== hwid) {
      return res.status(403).send('HWID unauthorized');
    }
    if (data.fingerprint !== fingerprint) {
      return res.status(403).send('Fingerprint unauthorized');
    }

    const scriptCode = await redis.get('script:code');
    if (!scriptCode) {
      return res.status(404).send('Script code not found');
    }

    // Если ключ одноразовый – помечаем used
    if (data.oneTime === true) {
      data.used = true;
      await redis.set(`key:${key}`, data);
    } else {
      // Сохраняем привязки (если они поменялись)
      await redis.set(`key:${key}`, data);
    }

    // Устанавливаем активную сессию
    await redis.set(sessionKey, JSON.stringify({ hwid, fingerprint }), { ex: SESSION_TTL });

    res.setHeader('Content-Type', 'text/plain');
    return res.send(scriptCode);
  } catch (error) {
    console.error('Redis Error:', error);
    return res.status(500).send('Internal server error');
  }
}
