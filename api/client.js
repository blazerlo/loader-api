import { redis } from './lib/redis.js';
import { addLog } from './lib/logs.js';
import { resolveKey, unmerge } from './lib/secret.js';

function deny(res, status, detail) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json({ detail });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return deny(res, 405, 'Method Not Allowed');
  }

  const Key = resolveKey(req);

  if (!Key) {
    const split = unmerge(req.query.Key);
    await addLog('script', {
      level: 'error',
      event: 'client_forbidden',
      got: String(req.query.Key || '').slice(0, 40),
      len: String(req.query.Key || '').length,
      partKey: split ? split.key : 'n/a',
      partSecret: split ? split.secret : 'n/a',
    });
    return deny(res, 403, 'Forbidden');
  }

  try {
    const keyData = await redis.get(`key:${Key}`);

    if (!keyData || keyData.status !== 'link' || keyData.used) {
      await addLog('script', { level: 'error', event: 'client_denied', key: Key, reason: 'not in whitelist' });
      return deny(res, 403, 'Forbidden');
    }

    const clientCode = await redis.get('client:code');
    if (!clientCode) {
      return deny(res, 404, 'Not Found');
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, private');
    return res.send(String(clientCode).replace(/^\s+/, ''));
  } catch (error) {
    console.error('Client error:', error);
    return deny(res, 500, 'Internal Server Error');
  }
}
