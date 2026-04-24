# Testing & Security

Vitest/Playwright setup, mock conventions, jsdom gotchas, security headers, validation, rate limiting, logging.

**Read when:** writing tests, debugging test mocks, adding a new API route, or touching validation/rate-limit/logging code.

---

# Testing

Unit/integration/component via **Vitest + RTL**. E2E via **Playwright**.

## Commands

- `npm run test:run` — all Vitest tests (287).
- `npm run test:e2e` — Playwright smoke + authenticated E2E suites.

## Structure

- `src/lib/__tests__/`
- `src/store/__tests__/`
- `src/components/**/__tests__/`
- `src/app/api/**/__tests__/`
- `e2e/` — runs separately via `playwright test`. Vitest `include: ["src/**/*.test.{ts,tsx}"]` keeps them from overlapping.

## Mock aliases

Defined in `vitest.config.ts` (array format, specific before generic):

- `@/generated/prisma/client`
- `@/lib/prisma`
- `@/lib/supabase/server`
- `@/lib/supabase/client`
- `@/lib/openai`
- `@/lib/groq`
- `@/lib/redis`
- `@/lib/logger`

All map to `src/test/mocks/`.

**`@/lib/cache` is intentionally NOT aliased** — tests hit real cache logic against the redis mock.

## Mocks that require `vi.mock()` inline

These are NOT aliased; must be mocked per-test via `vi.mock()`:

- `@/lib/suggestion`
- `@/lib/recovery`
- `@supabase/supabase-js` (admin client used in `user/delete`)

## Redis mock

`src/test/mocks/redis.ts` exports a non-null object with `get/set/del/ttl/incr/expire` as `vi.fn()`.

Defaults: `get → null`, `ttl → -2` (key not found), `set/del/incr/expire → OK/1`.

Tests override per-test with `mockResolvedValue`.

## Auth mock

`src/test/mocks/supabase-server.ts` exports:

- `mockSupabase`, `createClient`, `TEST_USER_ID`
- `mockUnauthorized()`, `mockAuthorized()`
- Also includes `exchangeCodeForSession` for auth callback tests

Import these in API route tests.

## beforeEach pattern

Use `vi.clearAllMocks()` (**NOT** `resetAllMocks`) — clears call history without wiping `mockResolvedValue` implementations.

Re-set default mock values in `beforeEach` after clearing, especially:
- `redis.ttl` (default `-2`)
- `redis.get` (default `null`)

## Other conventions

- `withLogging` mock is a passthrough (`(fn) => fn`) — route handlers don't need wrapping in tests.
- **`vi.mock()` does NOT override `resolve.alias` entries** — aliases win. Use the aliased mock directly (import it, configure with `mockResolvedValue`).
- `[id]` route params: pass as `Promise.resolve({ id: "..." })` — routes declare `params: Promise<{ id: string }>`.
- `useSuggestion` hook tests: mock `swr` via `vi.mock('swr', ...)` to control `useSWR` return value. Use `vi.useFakeTimers()` for timer tests. No wrapper needed (SWR fully mocked).

## jsdom gotchas

- **FormData path:** jsdom's `request.formData()` can't parse real multipart bodies. Use a mock request with `formData: vi.fn().mockResolvedValue(mockFormData)` where `mockFormData.get` returns the audio blob. Don't use real `FormData.append()` with fake Blobs (jsdom enforces strict `instanceof` check).
- **Overriding `Blob.size`:** jsdom defines `size` as own property on each Blob instance, blocking subclass override. For fake large blobs use `Object.defineProperty(new File([...], ...), "size", { get: () => N, configurable: true })` — `File` allows this. For non-Blob objects, use a plain object (won't pass `instanceof Blob`).

## Playwright E2E

- **Self-contained runs:** `setup.spec.ts` creates a fresh account (signup + onboarding), all tests run, `teardown.spec.ts` deletes it.
- **Env:** `E2E_TEST_EMAIL` + `E2E_TEST_PASSWORD`. No pre-existing test user needed.
- **Projects (4, with dependencies):** `setup` → `chromium` (unauthenticated: smoke + auth) + `authenticated` (dashboard, workout, recovery, progress) → `teardown`.
- **Stale-account handling:** if `E2E_TEST_EMAIL` already exists from a previous failed run, setup falls back to sign-in instead of failing.

---

# Security

## HTTP headers

In `next.config.ts` `headers()`:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (set globally)

## Route handlers

**YOU MUST wrap every exported route handler with `withLogging`** — including `src/app/auth/callback/route.ts`:

```
export const GET = withLogging(async function GET(...) { ... })
```

## Error responses

**YOU MUST return generic error messages** (e.g. `"Failed to generate workout suggestion"`). Never forward raw SDK/library error messages to clients.

## Input validation

Shared helpers: `src/lib/workout-validation.ts` — `validateWorkoutDate`, `validateExercises`, `parseDuration`, `parseBodyWeight`, `syncProfileWeight`. Used by:

- `POST /api/workouts`
- `PUT /api/workouts/[id]`
- `POST /api/workouts/draft`

Workout input limits (constants in `src/lib/constants.ts`):

- Max 50 exercises per workout
- Max 20 sets per exercise
- Reps and weight each < 10,000

Enforced in **both** `POST /api/workouts` and `PUT /api/workouts/[id]`.

## Rate limiting

Shared helper: `src/lib/rate-limit.ts` — `checkRateLimit(key, max, windowSeconds)` returns a 429 `NextResponse` or `null`. Graceful no-op if Redis is unavailable.

Current rate limit keys:

- `voice:{userId}` — 10/hr (transcribe)
- `voice-parse:{userId}` — 20/hr (parse)

## Logging

- `src/lib/logger.ts` — pino singleton (`logger`) + `withLogging` HOF.
- Levels: `logger.error` for 5xx, `logger.warn` for 4xx, `logger.info` for 2xx/3xx.
- Use `logger.child({ ... })` for request-scoped context.
