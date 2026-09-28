import { xorEncrypt, hashFingerprint } from './lib/crypto.js';
import { redis } from './lib/redis.js';
import { addLog } from './lib/logs.js';

const CHUNK_SPLIT = process.env.SPLIT_SCRIPT !== 'off';

function splitLua(code) {
  const lines = code.split('\n');
  const chunks = [];
  let current = [];
  let depth = 0;
  let inBlockComment = false;

  for (const line of lines) {
    current.push(line);

    const trimmed = line.trim();
    if (inBlockComment) {
      if (trimmed.includes('*/')) inBlockComment = false;
    } else if (trimmed.startsWith('--[[') || trimmed.startsWith('--[[[')) {
      inBlockComment = !trimmed.includes(']]');
    }

    for (const ch of line) {
      if (ch === '(' || ch === '{' || ch === '[') depth++;
      else if (ch === ')' || ch === '}' || ch === ']') depth--;
    }
    if (depth < 0) depth = 0;

    if (!inBlockComment && depth === 0 && trimmed === '') {
      chunks.push(current.join('\n'));
      current = [];
    }
  }

  if (current.length) chunks.push(current.join('\n'));
  return chunks.filter(c => c.trim().length);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  const token = req.headers['x-session-token'];
  const fingerprint = req.headers['fingerprint'];
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';

  if (!token) return res.status(400).send('Session token required');
  if (!fingerprint) return res.status(400).send('Fingerprint required');

  try {
    const tokenData = await redis.get(`token:${token}`);
    if (!tokenData) {
      await addLog('script', { level: 'error', event: 'pull_token_expired', ip });
      return res.status(403).send('Invalid or expired session');
    }

    const fpHash = hashFingerprint(tokenData.hwid, fingerprint);
    if (tokenData.fingerprint !== fpHash) {
      await addLog('script', { level: 'error', event: 'pull_fingerprint_mismatch', key: tokenData.key, ip });
      return res.status(403).send('Fingerprint mismatch');
    }

    const scriptCode = await redis.get('script:code');
    if (!scriptCode) {
      await addLog('script', { level: 'error', event: 'script_missing', key: tokenData.key, ip });
      return res.status(404).send('Script not found');
    }

    if (!CHUNK_SPLIT) {
      const encrypted = xorEncrypt(scriptCode, token);
      await addLog('script', { level: 'success', event: 'script_pulled', key: tokenData.key, hwid: tokenData.hwid, size: scriptCode.length, chunks: 1, ip });
      res.setHeader('Content-Type', 'text/plain');
      return res.send(encrypted);
    }

    const chunks = splitLua(scriptCode);
    const payload = chunks.map((chunk, i) => xorEncrypt(chunk, `${token}:${i}`));

    await addLog('script', {
      level: 'success',
      event: 'script_pulled',
      key: tokenData.key,
      hwid: tokenData.hwid,
      size: scriptCode.length,
      chunks: payload.length,
      ip,
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(JSON.stringify({ iv: token, chunks: payload }));
  } catch (error) {
    console.error('Pull error:', error);
    await addLog('script', { level: 'error', event: 'pull_error', reason: String(error.message || error), ip });
    return res.status(500).send('Internal server error');
  }
}
