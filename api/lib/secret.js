export const KEY_SECRET = 'outlaw123';

function sanitize(value) {
  return String(value).replace(/["'`\s<>]/g, '');
}

export function mergeKey(key, secret) {
  const n = Math.max(key.length, secret.length);
  let out = '';
  for (let i = 0; i < n; i++) {
    out += i < key.length ? key[i] : '~';
    out += i < secret.length ? secret[i] : '~';
  }
  return out;
}

export function unmerge(merged) {
  const clean = sanitize(merged);
  if (clean.length < 4 || clean.length % 2 !== 0) return null;
  let key = '';
  let secret = '';
  for (let i = 0; i < clean.length; i += 2) {
    key += clean[i];
    secret += clean[i + 1];
  }
  return { key: key.replace(/~/g, ''), secret: secret.replace(/~/g, '') };
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
