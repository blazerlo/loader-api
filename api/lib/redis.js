import { Redis } from '@upstash/redis';

const url =
  process.env.OUTLAW_REDIS_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.storage_KV_REST_API_URL;

const token =
  process.env.OUTLAW_REDIS_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.storage_KV_REST_API_TOKEN;

if (!url || !token) {
  throw new Error('Redis not configured: set OUTLAW_REDIS_URL and OUTLAW_REDIS_TOKEN');
}

export const redis = new Redis({ url, token });
