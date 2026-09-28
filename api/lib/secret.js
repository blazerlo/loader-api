export const KEY_PREFIX = 'outlaw123';

export function extractKey(raw) {
  if (typeof raw !== 'string' || !raw.startsWith(KEY_PREFIX)) return null;
  const key = raw.slice(KEY_PREFIX.length).trim();
  return key.length ? key : null;
}
