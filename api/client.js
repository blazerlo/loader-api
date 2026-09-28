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
      kick: true,
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
      await addLog('script', {
        level: 'error',
        event: 'client_denied',
        kick: true,
        key: Key,
        reason: 'not in whitelist',
        status: keyData ? keyData.status : 'missing',
        used: keyData && keyData.used ? 'yes' : 'no',
      });
      return deny(res, 403, 'Forbidden');
    }

    const clientCode = await redis.get('client:code');
    if (!clientCode) {
      await addLog('script', { level: 'error', event: 'client_missing', kick: true, key: Key, reason: 'client not set' });
      return deny(res, 404, 'Not Found');
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, private');
    return res.send(String(clientCode).replace(/^\s+/, ''));
  } catch (error) {
    console.error('Client error:', error);
    await addLog('script', { level: 'error', event: 'client_error', kick: true, key: Key, reason: String(error.message || error) });
    return deny(res, 500, 'Internal Server Error');
  }
}
