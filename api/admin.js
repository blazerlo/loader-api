import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ваш_пароль';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password, action, key, status, code } = req.body;

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    switch (action) {
      case 'setKey':
        if (!key || !['link', 'unlink'].includes(status)) {
          return res.status(400).json({ error: 'Invalid key or status' });
        }
        await redis.set(`key:${key}`, status);
        return res.json({ success: true, message: `Key ${key} set to ${status}` });

      case 'deleteKey':
        if (!key) return res.status(400).json({ error: 'Key required' });
        await redis.del(`key:${key}`);
        return res.json({ success: true, message: `Key ${key} deleted` });

      case 'setCode':
        if (!code) return res.status(400).json({ error: 'Code required' });
        await redis.set('script:code', code);
        return res.json({ success: true, message: 'Script code updated' });

      case 'getCode':
        const currentCode = await redis.get('script:code');
        return res.json({ success: true, code: currentCode });

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Admin error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
