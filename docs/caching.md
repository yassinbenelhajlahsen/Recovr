# Caching

Redis (Upstash) cache keys, TTLs, and invalidation rules.

**Read when:** adding a new cache key, touching a route that reads/writes cached data, or debugging cache-related staleness.

## Setup

- Redis singleton: `src/lib/redis.ts` — uses `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (Vercel KV). Returns `null` if env vars are absent (graceful local-dev fallback).
- Cache helpers: `src/lib/cache.ts` — all ops wrapped in try/catch. **Redis failure = cache miss; the app never crashes.**

## Cache keys and TTLs

| Key | TTL | Invalidation |
|---|---|---|
| `recovery:{userId}` | 300s (5min) | Workout POST/PUT/DELETE, draft PATCH (publish) |
| `suggestion:{userId}` | 3600s (1h) | Rehydrated from DB if expired |
| `suggestion-id:{userId}` | synced to suggestion | DB Suggestion row ID for current cached suggestion |
| `suggestion-draft:{userId}` | synced to suggestion | Draft Workout ID for current suggestion window |
| `exercises:{userId}` | 86400s (24h) | Exercise POST, draft POST (if custom exercises created) |

## Cache-aside wrappers

Always use these — never call the underlying compute function directly from routes:

- `getRecovery(userId)` in `src/lib/recovery.ts` — wraps `calculateRecovery`. `calculateRecovery` stays pure.
- `getSuggestionState(userId)` in `src/lib/suggestion.ts` — checks Redis first, falls back to DB. DB is source of truth for cooldown enforcement.

## Invalidation rules

- Draft creation (`POST /api/workouts/draft`) does **NOT** invalidate recovery — drafts are excluded from the recovery engine.
- Publishing a draft (`PATCH /api/workouts/[id]`) **does** invalidate `recovery:{userId}`.

## Cooldown

- `getCooldownBypass()` in `src/lib/cache.ts` returns `false` in production unconditionally (guard inside the function, not just at the route level).
- Cooldown is enforced by the DB (`Suggestion.created_at`), not Redis — Redis is just a perf cache.
