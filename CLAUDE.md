# Recvr — Project Context

## Stack

- **Next.js 16** (App Router, `src/` directory, `@/*` import alias)
- **Tailwind CSS v4** (class-based dark mode via `@custom-variant dark`)
- **Supabase Auth** (`@supabase/ssr`) — email/password + Google OAuth
- **Prisma 7** (schema in `prisma/schema.prisma`, client output in `src/generated/prisma`)
- **TypeScript**

## Key Commands

```bash
npm run dev              # Start dev server (http://localhost:3000)
npx prisma migrate dev   # Create and apply a new migration
npx prisma generate      # Regenerate Prisma client after schema change
npx prisma db seed       # Seed default exercises
npx prisma studio        # Open Prisma Studio (DB GUI)
npm run test             # Run Vitest in watch mode
npm run test:run         # Run Vitest once (CI mode)
npm run test:e2e         # Run Playwright E2E tests
```

## Code Style & Modularity

- **Keep files focused** — components render JSX, not business logic. Extract to hooks if >~150 lines.
- **Extract hooks for non-trivial logic** — `useState` + `useEffect` + handlers → colocated `hooks/` directory.
- **No duplicate UI** — shared UI lives in `src/components/ui/`.
- **All shared types in `src/types/`** — use `import type { Foo } from "@/types/workout"`.
- **`useRef` typing (React 19)**: `useRef<T>(null)` returns `RefObject<T | null>` — prop types that accept refs must use `RefObject<T | null>`, not `RefObject<T>`.
- **Shared icons in `src/components/ui/icons.tsx`** — never define SVG icons inline.
- **Colocate hooks** — single-feature hooks go in `hooks/` next to the component. App-wide hooks go in `src/lib/` or `src/hooks/`.
- **`toLocalISODate(d?)`** in `src/lib/utils.ts` — returns current (or given) date as `YYYY-MM-DD` in local time. Use this everywhere instead of inline date formatting.

## Auth Patterns

- **Client Components**: `createClient()` from `@/lib/supabase/client`
- **Server Components / Route Handlers**: `await createClient()` from `@/lib/supabase/server`
- **Middleware**: `src/proxy.ts` calls `updateSession()` from `src/lib/supabase/middleware.ts`
- After `signInWithPassword`, call `ensureUserInDb(user)` from `@/lib/supabase/ensure-user`
- OAuth callback syncs user via `src/app/auth/callback/route.ts`
- **OAuth upsert**: use `where: { email }` (not `id`) to avoid P2002 errors when same email exists across providers
- **GET routes** use `getClaims()` (local JWT verification, fast). **Mutations** use `getUser()` (server-side validation).
- `getClaims()` → extract user ID via `claims.claims.sub`, email via `claims.claims.email`

## Database

- Prisma client imported from `@/generated/prisma/client` (NOT `@prisma/client`)
- `DATABASE_URL` = pooled (port 6543, `?pgbouncer=true`), `DIRECT_URL` = direct (port 5432, migrations)
- Prisma v7 requires driver adapter: `new PrismaClient({ adapter: new PrismaPg(...) })`
- Singleton in `src/lib/prisma.ts` — follow the same `globalThis` singleton pattern for any other heavy clients (e.g. `src/lib/openai.ts`)
- Prefer `select` over `include` — only fetch columns the frontend uses

### Suggestion Model

- `Suggestion` model: `id, user_id, title, rationale, exercises (Json), presets (String[]), draft_id (unique FK → Workout, onDelete: SetNull), created_at`
- `draft_id` unique constraint enforces 1:1 with Workout. `onDelete: SetNull` — deleting a draft nulls the link but preserves history.
- `exercises` stored as JSONB (matches `SuggestedExercise[]`). No normalized table — display-only.
- `src/lib/suggestion.ts` — `persistSuggestion`, `getSuggestionState`, `linkDraftToSuggestion`
- History API: `GET /api/suggest/history` (cursor pagination, `?cursor=<ISO>&limit=20`), `GET /api/suggest/[id]`

### Seeding

- `seedExercises()` never deletes exercises (cascade would wipe workout data). Upserts only.
- `seedWorkouts()` inserts dev workouts for user `66894e73...`. Uses `[seed]` tag for idempotency.

### Muscle group naming

- Lowercase string arrays: `["core", "abs"]`. Search uses `hasSome`. Never `"core/Abs"`.

## Loading States

- `loading.tsx` files for `/dashboard`, `/recovery`, `/progress`
- Use `className="skeleton"` (custom shimmer in `globals.css`), NOT `animate-pulse`
- Skeletons mirror the real page layout

## Design System

- **Fonts**: Fraunces (`font-display`, headlines), Geist Sans (`font-sans`, body)
- **Color tokens**: CSS custom properties in `globals.css`, mapped via `@theme inline`
- **Semantic classes**: `bg-bg`, `bg-surface`, `bg-elevated`, `text-primary`, `text-secondary`, `text-muted`, `text-accent`, `border-border`, `border-border-subtle`, `text-danger`, `text-success`, `text-recovery-yellow`
- **Accent**: terracotta `#D4552A` (light) / `#E8633A` (dark)
- **Palette**: warm neutrals (not zinc). Light: `#F7F7F4`. Dark: `#0B0B0A`
- **Light mode colors**: muted earthy tones, not vivid. SVG fills in 50-65% lightness range.
- **Typography**: serif italic headlines, sans body, uppercase tracking-wider section labels
- **Cards**: `bg-surface border border-border-subtle rounded-xl`
- **Buttons**: Primary `bg-accent text-white rounded-lg`, Secondary `border border-border`, Ghost `text-secondary`
- **Drawer** (`src/components/ui/Drawer.tsx`): backdrop and panel are sibling elements (React fragment wrapper). Backdrop is `z-40`, panel is `z-50` with `role="dialog"`.

## Dark Mode

- `dark` class on `<html>`, managed by `ThemeProvider` + localStorage
- Anti-FOUC inline script in `layout.tsx`. Do NOT read theme server-side.

## Mobile Gate

- Desktop-only app — viewports <768px redirect to `/mobile` placeholder page
- **Server-side**: `src/proxy.ts` detects mobile User-Agent via regex, redirects to `/mobile` before auth runs
- **Client-side**: `src/components/layout/MobileGate.tsx` listens to resize events, redirects if viewport < `md` breakpoint
- **Allowed routes** (bypass gate): `/`, `/mobile`, `/api`, `/_next`, `/favicon`, `/privacy`, `/terms-of-service`

## Legal Pages

- **Privacy Policy** (`/privacy`) — 9 sections covering Supabase, OpenAI, Groq, Upstash, Vercel as third parties
- **Terms of Service** (`/terms-of-service`) — 11 sections, AI disclaimer (not medical advice)
- Both pages are public routes (added to `src/lib/supabase/middleware.ts` public list)
- Legal links appear in: signup form, Settings drawer footer, shared `Footer` component
- `src/components/ui/BackButton.tsx` — simple `history.back()` nav used on legal pages
- `src/components/layout/Footer.tsx` — shared footer with Privacy/Terms links + copyright, rendered in `layout.tsx`

## Routing

- `/` — public landing page (auth-aware CTAs: "Go to Dashboard" when logged in, "Get Started" + "Log in" when not)
- `/dashboard` — home: workout list + recovery panel + drawer (create/view/edit/summary)
- `/onboarding` — locked 4-step flow (name → gender → metrics → goal). Server-side gate.
- `/recovery` — SVG body maps + tap-to-inspect muscle detail
- `/progress` — 1RM charts + body weight chart, side-by-side. Full-width layout.
- `/privacy` — Privacy Policy (public, no auth required)
- `/terms-of-service` — Terms of Service (public, no auth required)
- `/mobile` — Mobile placeholder page (desktop-only message)

## Key Architecture

### File Structure

```
src/
├── types/              # Shared types (workout.ts, recovery.ts, user.ts, progress.ts, theme.ts, ui.ts)
├── app/                # Pages + API routes
│   ├── api/exercises|workouts|recovery|user|progress/   # REST endpoints
│   └── recovery|progress|onboarding|privacy|terms-of-service|mobile/
├── components/
│   ├── DashboardClient.tsx
│   ├── workout/        # WorkoutDetailDrawer, WorkoutForm, ExerciseCard, etc. + hooks/
│   ├── recovery/       # RecoveryPanel, RecoveryView, BodyMap*, MuscleDetailPanel + hooks/
│   ├── progress/       # ProgressClient, charts, selectors + hooks/
│   ├── layout/         # Navbar, UserMenu, ThemeProvider, PageTransition, Footer, MobileGate + hooks/
│   ├── onboarding/     # OnboardingFlow, MetricsInputs
│   ├── settings/       # SettingsDrawer, AccountTab, FitnessTab + hooks/
│   └── ui/             # Modal, Drawer, DropdownMenu, FloatingInput, GoalSelector, BackButton, icons
├── store/              # Zustand: workoutStore, appStore, clientStore
├── lib/                # prisma.ts, openai.ts, recovery.ts, units.ts, utils.ts, fetch.ts, hooks.ts, logger.ts, supabase/
└── proxy.ts            # Route protection
```

### State Management (Zustand)

- `workoutStore` — drawer open/close, view routing (`create|view|edit|summary`), preview data, session summary
- `appStore` — `isOnboarding` flag
- `clientStore` — SSR hydration safety (`mounted`, `isDark` via MutationObserver)
- **Pattern**: pass data through store, not refetch. Components render immediately with available data.

### Recovery Engine

- Computed on-the-fly from last 96h workouts — no DB tables. See `src/lib/recovery.ts`.
- Status thresholds: `recovered` ≥ 0.85, `partial` ≥ 0.45, `fatigued` < 0.45
- SVG body maps via `@mjcdev/react-body-highlighter`, HSL interpolation in `recoveryColors.ts`; `gender` prop (`"male"` | `"female"`, defaults to `"male"` for `null`) flows from DB through page → RecoveryView/RecoveryPanel → BodyMapFront/BodyMapBack. Library only supports male/female — no neutral option.
- `RecoveryPanel` (dashboard) is view-only. Full interaction on `/recovery`.

### Body Weight Tracking

- `body_weight Float?` on Workout — optional per-workout entry
- API syncs to `User.weight_lbs` only if it's the most recent workout with body_weight
- Progress chart reads from `Workout.body_weight`, not `User.weight_lbs`

### Progress Charts

- `ProgressChart` accepts either single-line (`dataKey`/`color`) or multi-line (`lines: LineConfig[]`) mode. Export `LineConfig` type from `ProgressChart.tsx`.
- `MetricMode = "1rm" | "topWeight" | "both"` in `src/types/progress.ts`. State lives in `useProgressFilters` hook.
- `MetricSelector` is a dropdown (uses `DropdownMenu`/`DropdownMenuItem`) placed inline with `ExerciseSelector`.
- Legend renders inside the chart card header when `resolvedLines.length > 1`.
- `isAnimationActive={false}` on all `<Line>` — Recharts animations block tooltip hover until complete; keep disabled.
- `grow` prop on `ProgressChart`: switches card to `flex flex-col flex-1` and chart area to `flex-1 min-h-[220px]`. Use on the body weight chart (right column) so it stretches to match the left column height in the grid row. Right column must be wrapped in `<div className="flex flex-col">`.
- Recharts remount fix: `chartKey` prop passed as `key` to `<LineChart>` — include `metricMode` in the key so switching metrics forces a clean remount.

### Onboarding

- Locked 4-step flow, server-side gate on dashboard + OAuth callback
- Steps: Name (0) → Gender (1) → Body Metrics (2) → Goals (3). All fields optional.
- User fields: `height_inches`, `weight_lbs`, `fitness_goals` (String[]), `gender` (String? — `"male"` | `"female"` | `null`), `onboarding_completed`
- Goals: up to 3 presets OR 1 custom (mutually exclusive)

### AI Suggestions (`/recovery` page)

- `SuggestionTrigger` (server-rendered, receives recovery data) opens a `size="lg"` Drawer
- `SuggestionPanel` + `useSuggestion` hook handle idle/loading/streaming/result states; hook uses AbortController to cancel in-flight requests on dismiss
- API route `POST /api/suggest` calls OpenAI via singleton `src/lib/openai.ts`; do NOT trust client-supplied recovery data — always recompute server-side
- **Gender prompt bias**: `gender="male"` → "Gender: Male" fact added to user prompt; `gender="female"` → "Gender: Female"; `null` → omitted. System prompt's GENDER CONSIDERATION section acts as a tiebreaker: male lowers partial-recovery threshold to 50% for upper-body muscles; female lowers it to 50% for lower-body muscles. Recovery always takes priority — gender never overrides fatigue rules.
- **Streaming**: `POST /api/suggest` uses `stream: true` and returns `text/x-ndjson`. Each line is a `SuggestionStreamEvent` (defined in `src/types/suggestion.ts`): `meta | title | rationale | exercise | done | error`. Cache hits still return instant `application/json` (no streaming).
- `useSuggestion` reads the NDJSON stream line-by-line via `ReadableStream`, building a `PartialSuggestion` and calling `setState` on each event. Detects response type via `Content-Type` header to handle both paths.
- `isStreaming` flag (`state.isLoading && state.suggestion !== null`) drives progressive UI: skeleton cards fill to 4 while exercises arrive, footer hidden until stream completes, scalar fields (title/rationale) animate in individually.
- Server-side: `extractExercises(buffer, alreadyEmitted)` rescans the full accumulated buffer from the exercises array start on each chunk — avoids incremental-state bugs from chunk-boundary splits.
- `SuggestionStreamEvent` types in `src/types/suggestion.ts` — import from there, not inline. `done` event now carries optional `suggestionId` (DB row ID).
- Result footer has "Save as Draft" / "View workout" buttons; `useSaveDraft` hook in `recovery/hooks/useSaveDraft.ts` POSTs to `/api/workouts/draft` with optional `suggestionId`
- **Suggestion history**: `SuggestionTrigger` has "History" secondary button. `SuggestionPanel` supports views: `planner | history | historical-detail`. Historical detail reuses `ExerciseCard` layout; no cooldown timer shown. `useSuggestionHistory` hook uses `useSWRInfinite` with cursor pagination. Viewing a historical suggestion calls `viewHistorical(detail)` on `useSuggestion` which sets `isHistorical = true`.
- **Cooldown timer**: shown only for the most recent suggestion (`!isHistorical`) in the result view footer and on the first (latest) card in the history list.

### Workout Drafts

- `is_draft Boolean @default(false)` and `source String @default("manual")` on Workout model
- Drafts excluded from recovery engine (`is_draft: false` in `calculateRecovery` where clause)
- Drafts excluded from progress charts (all 3 Prisma queries in `src/app/progress/page.tsx`)
- Dashboard includes drafts — "Draft" badge (`text-recovery-yellow`) on workout cards
- Deep-link: after saving draft from `/recovery` → `router.push('/?draft={id}')` → DashboardClient `openDraftId` prop opens drawer on mount, then `router.replace('/')` clears the param
- `POST /api/workouts/draft` — exercise matching (exact name → substring → create custom, resolved **sequentially** to avoid duplicate custom exercises) + creates with `is_draft: true, source: "suggested"`
- `WorkoutForm` also shows "Save as Draft" (ghost button, appears once form has ≥1 exercise) — POSTs to `/api/workouts` with `is_draft: true, source: "manual"`
- `PATCH /api/workouts/[id]` — only flips `is_draft`; used for publish flow from draft view
- Draft view in WorkoutViewDetail shows "Save Workout" (accent) + "Edit" + Delete instead of just Edit + Delete
- `source` field (`"manual"` | `"suggested"`) is internal only, never shown to users

### Redis Caching (Upstash)

- Redis singleton: `src/lib/redis.ts` — uses `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (Vercel KV). Returns `null` if env vars are absent (graceful local-dev fallback).
- Cache helpers: `src/lib/cache.ts` — all ops wrapped in try/catch; Redis failure = cache miss, app never crashes.
- **Cache keys and TTLs**:
  - `recovery:{userId}` — 300s (5min). Invalidated on workout POST/PUT/DELETE and draft PATCH (publish).
  - `suggestion:{userId}` — 3600s (1h). Fast cache for most recent suggestion. Rehydrated from DB if expired.
  - `suggestion-id:{userId}` — synced TTL to suggestion key. Stores the DB Suggestion row ID for the cached suggestion.
  - `suggestion-draft:{userId}` — synced TTL. Stores the draft Workout ID for the current suggestion window.
  - `exercises:{userId}` — 86400s (24h). Invalidated on exercise POST and draft POST (if custom exercises created).
- **`getRecovery(userId)`** in `src/lib/recovery.ts` — cache-aside wrapper around `calculateRecovery`. Use this in all API routes; keep `calculateRecovery` pure.
- **`getSuggestionState(userId)`** in `src/lib/suggestion.ts` — checks Redis first, falls back to DB if Redis is empty. DB is source of truth for cooldown enforcement (`Suggestion.created_at`). Use in all suggest/cooldown routes.
- **AI suggestion cooldown**: `POST /api/suggest` returns `_cooldown` (seconds remaining) + `_cached: true` on cache hits. `GET /api/suggest/cooldown` returns `{ cooldown, suggestionId? }`. `useSuggestion` manages countdown timer. Cooldown blocked if `timeSinceLast < 1hr` (DB authoritative).
- Draft creation (`POST /api/workouts/draft`) does NOT invalidate recovery (drafts excluded from recovery engine).

### Voice Workout Logging

- **Flow**: Record audio → Groq Whisper transcription → OpenAI GPT-4o-mini structured parsing → DB exercise matching → populate WorkoutForm
- **Groq singleton**: `src/lib/groq.ts` — `globalThis` pattern, used only for Whisper transcription. Env var: `GROQ_API_KEY`.
- **Shared exercise matcher**: `src/lib/exercise-matcher.ts` — `resolveExercise(name, muscleGroups, allExercises, userId)`. Used by both `POST /api/workouts/draft` and `POST /api/voice/transcribe`.
- **API**: `POST /api/voice/transcribe` — accepts `FormData` with `audio` blob. Auth via `getUser()`. Returns `VoiceTranscribeResponse` (transcript + matched exercises + unmatched names).
- **Rate limiting**: Redis key `voice:{userId}` — max 10 requests/hour. Graceful skip if Redis unavailable.
- **Types**: `src/types/voice.ts` — `ParsedExercise`, `VoiceTranscribeResponse`
- **Hook**: `src/components/workout/hooks/useVoiceRecorder.ts` — states: `idle → requesting → recording → processing → done → error`. Auto-stops at 120s. Uses `fetchWithAuth` for API call.
- **Component**: `src/components/workout/VoiceInput.tsx` — mic button next to "Add Exercise" in WorkoutForm. Hidden if `MediaRecorder` unsupported.
- **Bulk add**: `useExerciseList.bulkAddExercises()` — merges sets when same `exercise_id` appears multiple times, appends new exercises.
- **Icons**: `MicIcon`, `StopIcon` in `src/components/ui/icons.tsx`

## Client-Side Data Fetching (SWR)

- **SWR** installed. Global config in `src/components/layout/Providers.tsx` (wraps ThemeProvider + SWRConfig). `layout.tsx` uses `<Providers>` instead of `<ThemeProvider>`.
- **Next.js `staleTimes`**: `dynamic: 30, static: 300` in `next.config.ts` — warm navigations skip `loading.tsx` skeletons.
- **SWR fetcher**: global `swrFetcher` in `Providers.tsx` delegates to `fetchWithAuth` from `src/lib/fetch.ts` — single 401-redirect implementation. Use `fetchWithAuth` directly for non-SWR calls (POST/PUT/PATCH/DELETE). Do NOT reimplement 401 handling elsewhere.
- **SWR hooks**: `useWorkoutDetail`, `useExerciseSearch`, `useNavbar` profile, `useRecovery`, `useProgress` all use `useSWR`. Do not revert to manual fetch.
- **Per-hook config**: do not repeat `revalidateOnFocus: false` — set globally. Only override `dedupingInterval` when 5s default is too short.
- **Mutation invalidation**: call `globalMutate(keyFilter)` from `swr` alongside `router.refresh()`. Key filters: workouts → `k.startsWith("/api/workouts/")`, profile → `"/api/user/profile"`, exercises → `k.startsWith("/api/exercises")`.
- **Shared hooks**: `useRecovery`, `useProgress`, `useDebouncedValue` in `src/lib/hooks.ts`. `useNavbar` profile typed as `UserProfile` from `@/types/user`.

## Testing

- **Vitest + RTL** for unit/integration/component tests. **Playwright** for E2E.
- `npm run test:run` — all Vitest tests (259 as of Tier 3 test expansion). `npm run test:e2e` — Playwright smoke + authenticated E2E suites.
- **Mock aliases** in `vitest.config.ts` (array format, specific before generic): `@/generated/prisma/client`, `@/lib/prisma`, `@/lib/supabase/server`, `@/lib/supabase/client`, `@/lib/openai`, `@/lib/groq`, `@/lib/redis`, `@/lib/logger` all map to `src/test/mocks/`.
- **`@/lib/cache` intentionally NOT aliased** — tests hit real cache logic against the redis mock.
- **Redis mock** (`src/test/mocks/redis.ts`) exports a non-null object with `get/set/del/ttl/incr/expire` as `vi.fn()`. Default: `get→null`, `ttl→-2` (key not found), `set/del/incr/expire→OK/1`. Tests override per-test with `mockResolvedValue`.
- **`vi.mock("@/lib/suggestion")` / `vi.mock("@/lib/recovery")`** for routes that call these — they are NOT aliased, so must be mocked inline via `vi.mock`.
- **`vi.mock("@supabase/supabase-js")`** for the admin client used in `user/delete` route.
- **Auth mock pattern**: `src/test/mocks/supabase-server.ts` exports `mockSupabase`, `createClient`, `TEST_USER_ID`, `mockUnauthorized()`, `mockAuthorized()`. Mock also includes `exchangeCodeForSession` for auth callback tests. Import these in API route tests.
- **`vi.clearAllMocks()` in `beforeEach`** (NOT `resetAllMocks`) — clears call history without wiping `mockResolvedValue` implementations. Re-set default mock values in `beforeEach` after clearing, especially for `redis.ttl` (default -2) and `redis.get` (default null).
- **`withLogging` mock** is a passthrough (`(fn) => fn`) — route handlers don't need wrapping in tests.
- **FormData path testing in jsdom**: jsdom's `request.formData()` can't parse real multipart bodies. Use a mock request object with `formData: vi.fn().mockResolvedValue(mockFormData)` where `mockFormData.get` returns the audio blob. Don't use real `FormData.append()` with fake Blobs (jsdom enforces strict instanceof check).
- **Overriding Blob.size in tests**: jsdom defines `size` as own property on each Blob instance, blocking subclass override. For a fake large blob use `Object.defineProperty(new File([...], ...), "size", { get: () => N, configurable: true })` — `File` allows this. For non-Blob objects, use a plain object (won't pass `instanceof Blob` check).
- **`vi.mock()` does NOT override `resolve.alias` entries** — aliases win. Use the aliased mock directly (import it, configure with `mockResolvedValue`).
- **E2E tests** live in `e2e/` and run separately via `playwright test`. Vitest `include: ["src/**/*.test.{ts,tsx}"]` ensures no overlap.
- **E2E auth**: `e2e/global-setup.ts` signs in once via UI and saves cookies to `e2e/.auth/user.json`. Set `E2E_TEST_EMAIL` + `E2E_TEST_PASSWORD` env vars. Test user must have `onboarding_completed = true` in DB.
- **Playwright projects**: `chromium` (unauthenticated — smoke + auth spec), `authenticated` (uses stored state — dashboard, workout, recovery, progress specs).
- **`[id]` route params**: pass as `Promise.resolve({ id: "..." })` in tests — routes declare `params: Promise<{ id: string }>`.
- **useSuggestion hook tests**: mock `swr` module via `vi.mock('swr', ...)` to control `useSWR` return value. Use `vi.useFakeTimers()` for timer decrement tests. Mount with no wrapper needed (SWR is fully mocked).
- **Test structure**: `src/lib/__tests__/`, `src/store/__tests__/`, `src/components/**/__tests__/`, `src/app/api/**/__tests__/`

## Logging

- `src/lib/logger.ts` — pino singleton (`logger`) + `withLogging` HOF. Every exported route handler must be wrapped: `export const GET = withLogging(async function GET(...) { ... })`.
- Log levels: `logger.error` for 5xx, `logger.warn` for 4xx, `logger.info` for 2xx/3xx. Use `logger.child({ ... })` for request-scoped context.

## Environment Variables

See `.env.example`. Key vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL`, `OPENAI_API_KEY`, `GROQ_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`
