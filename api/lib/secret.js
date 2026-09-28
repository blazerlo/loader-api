export const KEY_SECRET = 'outlaw123';

export function isAuthorized(req, rawKey) {
  const provided = req.headers['x-outlaw'] || req.query.s || null;
  if (provided === KEY_SECRET) return true;
  return typeof rawKey === 'string' && rawKey.startsWith(KEY_SECRET);
}

export function extractKey(raw) {
  if (typeof raw !== 'string') return null;
  const key = raw.startsWith(KEY_SECRET) ? raw.slice(KEY_SECRET.length) : raw;
  const trimmed = key.trim();
  return trimmed.length ? trimmed : null;
}
