import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

/**
 * Check and increment a rate limit counter.
 * Returns a 429 NextResponse if the limit is exceeded, null otherwise.
 * Gracefully skips if Redis is unavailable.
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<NextResponse | null> {
  if (!redis) return null;
  try {
    const count = await redis.get<number>(key);
    if (count !== null && count >= max) {
      const ttl = await redis.ttl(key);
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429, headers: { "Retry-After": String(ttl > 0 ? ttl : windowSeconds) } },
      );
    }
    const newCount = await redis.incr(key);
    if (newCount === 1) await redis.expire(key, windowSeconds);
  } catch {
    // Redis failure = skip rate limit
  }
  return null;
}
