export const KEY_SECRET = 'outlaw123';

export function mergeKey(key, secret) {
  let out = '';
  for (let i = 0; i < key.length; i++) {
    out += key[i];
    if (i < secret.length) out += secret[i];
  }
  if (secret.length > key.length) out += secret.slice(key.length);
  return out;
}

export function unmerge(merged) {
  if (typeof merged !== 'string' || merged.length < 4) return null;
  let key = '';
  let secret = '';
  for (let i = 0; i < merged.length; i += 2) {
    key += merged[i];
    if (i + 1 < merged.length) secret += merged[i + 1];
  }
  return { key, secret };
}

export function resolveKey(req) {
  const raw = req.query.Key;

  const split = unmerge(raw);
  if (split && split.secret === KEY_SECRET && split.key) {
    return split.key;
  }

  const provided = req.headers['x-outlaw'] || req.query.s || null;
  if (provided === KEY_SECRET && typeof raw === 'string' && raw.trim()) {
    return raw.trim();
  }

  return null;
}
