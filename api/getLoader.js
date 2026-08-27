import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.storage_KV_REST_API_URL || process.env.storage_REDIS_URL,
  token: process.env.storage_KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  try {
    const loaderCode = await redis.get('loader:code');
    if (!loaderCode) {
      return res.status(404).send('Loader code not found');
    }
    res.setHeader('Content-Type', 'text/plain');
    res.send(loaderCode);
  } catch (error) {
    console.error('Error loading loader:', error);
    return res.status(500).send('Internal server error');
  }
}
