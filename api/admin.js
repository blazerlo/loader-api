import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.storage_KV_REST_API_URL || process.env.storage_REDIS_URL,
  token: process.env.storage_KV_REST_API_TOKEN,
});

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ваш_пароль';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password, action, key, status, code, loader, hwid, oneTime, fingerprint } = req.body;

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    switch (action) {
      case 'listKeys': {
        const keys = await redis.keys('key:*');
        const result = [];
        for (const k of keys) {
          const data = await redis.get(k);
          const keyName = k.replace('key:', '');
          result.push({
            key: keyName,
            status: data?.status || 'unlink',
            hwid: data?.hwid || null,
            fingerprint: data?.fingerprint || null,
            oneTime: data?.oneTime || false,
            used: data?.used || false
          });
        }
        return res.json({ success: true, keys: result });
      }

      case 'setKey': {
        if (!key || !['link', 'unlink'].includes(status)) {
          return res.status(400).json({ error: 'Invalid key or status' });
        }
        const data = { status };
        if (hwid !== undefined) data.hwid = hwid;
        if (fingerprint !== undefined) data.fingerprint = fingerprint;
        if (oneTime !== undefined) data.oneTime = oneTime;
        data.used = false;
        await redis.set(`key:${key}`, data);
        return res.json({ success: true, message: `Key ${key} set to ${status}` });
      }

      case 'deleteKey': {
        if (!key) return res.status(400).json({ error: 'Key required' });
        await redis.del(`key:${key}`);
        return res.json({ success: true, message: `Key ${key} deleted` });
      }

      case 'setLoader': {
        if (!loader) return res.status(400).json({ error: 'Loader code required' });
        await redis.set('loader:code', loader);
        return res.json({ success: true, message: 'Loader code updated' });
      }

      case 'getLoader': {
        const currentLoader = await redis.get('loader:code');
        return res.json({ success: true, loader: currentLoader });
      }

      case 'setCode': {
        if (!code) return res.status(400).json({ error: 'Code required' });
        await redis.set('script:code', code);
        return res.json({ success: true, message: 'Script code updated' });
      }

      case 'getCode': {
        const currentCode = await redis.get('script:code');
        return res.json({ success: true, code: currentCode });
      }

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Admin error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
