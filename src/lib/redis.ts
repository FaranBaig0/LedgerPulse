import { Redis } from "ioredis";
import { redisConnectionOptions } from "../queues/queue.config.js";

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379", 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

let redisClient: Redis | null = null;
const inMemoryStore = new Map<string, { value: string; expiresAt: number }>();

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD,
      lazyConnect: true,
      maxRetriesPerRequest: 1
    });

    redisClient.on("error", (err) => {
      console.warn("[RedisClient] Warning: Redis connection issue, falling back to memory fallback:", err.message);
    });
  }
  return redisClient;
}

/**
 * Stores a key with a TTL in seconds in Redis (with fallback to in-memory store)
 */
export async function setCacheWithTTL(key: string, value: string, ttlSeconds: number = 900): Promise<void> {
  try {
    const redis = getRedisClient();
    if (redis.status === "ready" || redis.status === "connecting") {
      await redis.set(key, value, "EX", ttlSeconds);
      return;
    }
  } catch (err) {
    console.warn(`[RedisCache] Redis set error for key ${key}, using memory fallback:`, err);
  }

  // Memory fallback
  inMemoryStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

/**
 * Retrieves a key from Redis (with fallback to in-memory store)
 */
export async function getCache(key: string): Promise<string | null> {
  try {
    const redis = getRedisClient();
    if (redis.status === "ready" || redis.status === "connecting") {
      const val = await redis.get(key);
      if (val !== null) return val;
    }
  } catch (err) {
    console.warn(`[RedisCache] Redis get error for key ${key}, checking memory fallback:`, err);
  }

  // Memory fallback check
  const item = inMemoryStore.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    inMemoryStore.delete(key);
    return null;
  }
  return item.value;
}

/**
 * Sets key only if it does not exist (atomic lock/nonce check)
 */
export async function setNXWithTTL(key: string, value: string, ttlSeconds: number = 900): Promise<boolean> {
  try {
    const redis = getRedisClient();
    if (redis.status === "ready" || redis.status === "connecting") {
      const res = await redis.set(key, value, "EX", ttlSeconds, "NX");
      return res === "OK";
    }
  } catch (err) {
    console.warn(`[RedisCache] Redis setNX error for key ${key}, using memory fallback:`, err);
  }

  // Memory fallback
  const item = inMemoryStore.get(key);
  if (item && Date.now() <= item.expiresAt) {
    return false; // Already exists
  }
  inMemoryStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  return true;
}

/**
 * Deletes a key from cache
 */
export async function deleteCache(key: string): Promise<void> {
  try {
    const redis = getRedisClient();
    if (redis.status === "ready" || redis.status === "connecting") {
      await redis.del(key);
    }
  } catch {
    // Ignore error
  }
  inMemoryStore.delete(key);
}
