export const KEY_SECRET = 'outlaw123';

function sanitize(value) {
  return String(value).replace(/["'`\s<>]/g, '');
}

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
  const clean = sanitize(merged);
  if (clean.length < 4) return null;
  let key = '';
  let secret = '';
  for (let i = 0; i < clean.length; i += 2) {
    key += clean[i];
    if (i + 1 < clean.length) secret += clean[i + 1];
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
  if (provided === KEY_SECRET) {
    const plain = sanitize(raw || '');
    if (plain) return plain;
  }

  return null;
}
