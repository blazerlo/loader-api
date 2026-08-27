import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  const { key } = req.query;

  if (!key || typeof key !== 'string') {
    return res.status(400).send('Key is required');
  }

  try {
    const status = await redis.get(`key:${key}`);

    if (status === 'link') {
      const scriptCode = await redis.get('script:code');
      if (!scriptCode) {
        return res.status(404).send('Script code not found');
      }
      res.setHeader('Content-Type', 'text/plain');
      return res.send(scriptCode);
    } else {
      return res.status(403).send('Invalid or unlinked key');
    }
  } catch (error) {
    console.error('Redis Error:', error);
    return res.status(500).send('Internal server error');
  }
}
