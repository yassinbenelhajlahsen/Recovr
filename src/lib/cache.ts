import { redis } from "@/lib/redis";
import type { MuscleRecovery } from "@/types/recovery";
import type { WorkoutSuggestion } from "@/types/suggestion";

// TTLs in seconds
const RECOVERY_TTL = 300; // 5 minutes
const SUGGESTION_TTL = 3600; // 1 hour
const EXERCISES_TTL = 86400; // 24 hours

// ---- Recovery ----

export async function getCachedRecovery(
  userId: string,
): Promise<MuscleRecovery[] | null> {
  if (!redis) return null;
  try {
    return await redis.get<MuscleRecovery[]>(`recovery:${userId}`);
  } catch {
    return null;
  }
}

export async function setCachedRecovery(
  userId: string,
  data: MuscleRecovery[],
): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(`recovery:${userId}`, data, { ex: RECOVERY_TTL });
  } catch {
    // ignore
  }
}

export async function invalidateRecovery(userId: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(`recovery:${userId}`);
  } catch {
    // ignore
  }
}

// ---- AI Suggestions ----

export async function getCachedSuggestion(
  userId: string,
): Promise<WorkoutSuggestion | null> {
  if (!redis) return null;
  try {
    return await redis.get<WorkoutSuggestion>(`suggestion:${userId}`);
  } catch {
    return null;
  }
}

export async function setCachedSuggestion(
  userId: string,
  suggestion: WorkoutSuggestion,
): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(`suggestion:${userId}`, suggestion, { ex: SUGGESTION_TTL });
  } catch {
    // ignore
  }
}

/** Returns remaining TTL in seconds, or 0 if no active suggestion. */
export async function getSuggestionCooldown(userId: string): Promise<number> {
  if (!redis) return 0;
  try {
    const ttl = await redis.ttl(`suggestion:${userId}`);
    return ttl > 0 ? ttl : 0;
  } catch {
    return 0;
  }
}

/** Stores the draft workout ID created from the cached suggestion. TTL matches the suggestion key. */
export async function getSuggestionDraftId(userId: string): Promise<string | null> {
  if (!redis) return null;
  try {
    return await redis.get<string>(`suggestion-draft:${userId}`);
  } catch {
    return null;
  }
}

export async function setSuggestionDraftId(userId: string, draftId: string): Promise<void> {
  if (!redis) return;
  try {
    // Match TTL to remaining suggestion window so both expire together
    const ttl = await redis.ttl(`suggestion:${userId}`);
    const ex = ttl > 0 ? ttl : SUGGESTION_TTL;
    await redis.set(`suggestion-draft:${userId}`, draftId, { ex });
  } catch {
    // ignore
  }
}

export async function invalidateSuggestionDraftId(userId: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(`suggestion-draft:${userId}`);
  } catch {
    // ignore
  }
}

/** Stores the DB Suggestion row ID alongside the cached suggestion. TTL synced to suggestion key. */
export async function setCachedSuggestionId(userId: string, suggestionId: string): Promise<void> {
  if (!redis) return;
  try {
    const ttl = await redis.ttl(`suggestion:${userId}`);
    const ex = ttl > 0 ? ttl : SUGGESTION_TTL;
    await redis.set(`suggestion-id:${userId}`, suggestionId, { ex });
  } catch {
    // ignore
  }
}

export async function getCachedSuggestionId(userId: string): Promise<string | null> {
  if (!redis) return null;
  try {
    return await redis.get<string>(`suggestion-id:${userId}`);
  } catch {
    return null;
  }
}

/** Dev-only: set a short-lived bypass so the next getSuggestionState ignores the cooldown. */
export async function setCooldownBypass(userId: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(`suggestion-bypass:${userId}`, "1", { ex: 30 });
  } catch {
    // ignore
  }
}

export async function getCooldownBypass(userId: string): Promise<boolean> {
  if (!redis || process.env.NODE_ENV === "production") return false;
  try {
    const val = await redis.get(`suggestion-bypass:${userId}`);
    return val === "1";
  } catch {
    return false;
  }
}

// ---- Exercise library ----

export async function getCachedExercises(
  userId: string,
): Promise<unknown[] | null> {
  if (!redis) return null;
  try {
    return await redis.get<unknown[]>(`exercises:${userId}`);
  } catch {
    return null;
  }
}

export async function setCachedExercises(
  userId: string,
  data: unknown[],
): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(`exercises:${userId}`, data, { ex: EXERCISES_TTL });
  } catch {
    // ignore
  }
}

export async function invalidateExercises(userId: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(`exercises:${userId}`);
  } catch {
    // ignore
  }
}
