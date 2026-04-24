# Auth & Data

Supabase auth patterns, Prisma/DB conventions, and SWR client-side data fetching.

**Read when:** writing API routes, adding auth guards, modifying the Prisma schema, running migrations, or wiring new client-side hooks.

## Supabase Auth

Sources: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`, `src/proxy.ts`.

- **Client Components:** `createClient()` (sync) from `@/lib/supabase/client`
- **Server Components / Route Handlers:** `await createClient()` from `@/lib/supabase/server`
- **Middleware:** `src/proxy.ts` calls `updateSession()` from `src/lib/supabase/middleware.ts`
- After `signInWithPassword`, call `ensureUserInDb(user)` from `@/lib/supabase/ensureUser`.
- OAuth callback syncs user via `src/app/auth/callback/route.ts`.
- **Shared OAuth hook:** `src/app/auth/useOAuthSignIn.ts` — used by both signin and signup. Returns `{ googleLoading, appleLoading, handleGoogleSignIn, handleAppleSignIn }`.
- **OAuth upsert:** use `where: { email }` (not `id`) to avoid P2002 errors when same email exists across providers.

### GET vs mutation pattern

- **GET routes** → `getClaims()` (local JWT verification, fast).
  - Extract user ID via `claims.claims.sub`, email via `claims.claims.email`.
- **Mutations** → `getUser()` (server-side validation).

### Auth callback security

- `next` query param: validated to start with `/` and not `//` before redirect. Never trust raw param.
- `GET = withLogging(...)` — callback is wrapped like all other handlers.

## Prisma / Database

- Client imported from `@/generated/prisma/client` (**NOT** `@prisma/client`).
- `DATABASE_URL` = pooled (port 6543, `?pgbouncer=true`); `DIRECT_URL` = direct (port 5432, migrations).
- Prisma v7 requires a driver adapter: `new PrismaClient({ adapter: new PrismaPg(...) })`.
- Singleton in `src/lib/prisma.ts` — follow the same `globalThis` pattern for other heavy clients (`src/lib/openai.ts`, `src/lib/groq.ts`, `src/lib/redis.ts`).
- Prefer `select` over `include` — only fetch columns the frontend uses.

### Suggestion model

- Fields: `id, user_id, title, rationale, exercises (Json), presets (String[]), draft_id (unique FK → Workout, onDelete: SetNull), created_at`.
- `draft_id` unique constraint enforces 1:1 with Workout. `onDelete: SetNull` — deleting a draft nulls the link but preserves history.
- `exercises` stored as JSONB (matches `SuggestedExercise[]`). No normalized table — display-only.
- Helpers in `src/lib/suggestion.ts` — `persistSuggestion`, `getSuggestionState`, `linkDraftToSuggestion`.

### Seeding

- `seedExercises()` never deletes exercises (cascade would wipe workout data). Upserts only.
- `seedWorkouts()` inserts dev workouts for user `66894e73...`. Uses `[seed]` tag for idempotency.

## SWR Client-Side Data

Global config: `src/components/layout/Providers.tsx` (wraps `ThemeProvider` + `SWRConfig`). `layout.tsx` uses `<Providers>`, not `<ThemeProvider>` directly.

- **Fetcher:** global `swrFetcher` in `Providers.tsx` delegates to `fetchWithAuth` from `src/lib/fetch.ts` — single 401-redirect implementation.
- Use `fetchWithAuth` directly for non-SWR calls (POST/PUT/PATCH/DELETE).
- **YOU MUST NOT** reimplement 401 handling elsewhere.

### Hook conventions

- SWR hooks: `useWorkoutDetail`, `useExerciseSearch`, `useNavbar` profile, `useRecovery`, `useProgress` — all use `useSWR`.
- Shared hooks live in `src/lib/hooks.ts`. `useNavbar` profile typed as `UserProfile` from `@/types/user`.
- Do not repeat `revalidateOnFocus: false` per hook — set globally. Only override `dedupingInterval` when 5s default is too short.
- Next.js `staleTimes`: `dynamic: 30, static: 300` in `next.config.ts` — warm navigations skip `loading.tsx` skeletons.

### Mutation invalidation

After mutations, call `globalMutate(keyFilter)` from `swr` alongside `router.refresh()`.

Key filters:
- Workouts → `k.startsWith("/api/workouts/")`
- Profile → `"/api/user/profile"`
- Exercises → `k.startsWith("/api/exercises")`
