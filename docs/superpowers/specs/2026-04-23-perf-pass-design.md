# Performance Pass Design — Optimistic Updates, Server Caching, Bundle Shrink

## Summary

A unified performance pass across three independent workstreams, designed together and shipped separately:

- **W1 — Optimistic updates:** Write optimistic data into the SWR cache on mutation submit so UI reflects the change without waiting for the server round-trip.
- **W2 — Server-side Redis caching:** Extend the existing `getRecovery` cache-aside pattern to `/api/progress` (always cached) and the unfiltered dashboard list (cache bypass when filters are present).
- **W3 — Lazy-load Recharts:** Move Recharts out of the shared JS bundle via `next/dynamic`, deferring its ~200KB gzipped weight to the one route (`/progress`) that uses it.

## Motivation

The app already has Redis (recovery/suggestion/exercises), DB indexes, SWR with a global config, Next `<Link>` bundle prefetch, `staleTimes`, and hover-based SWR data prefetch. The remaining user-visible latency comes from three sources:

1. **Mutation latency.** Today, create/edit/delete/save-draft/publish wait on the server response before SWR revalidates and the UI updates. Under normal network the gap is ~200-500ms; under Slow 3G or flaky connections it's multiple seconds. Optimistic writes collapse this gap for the success path.
2. **Uncached Prisma reads on repeat nav.** `/api/progress` runs 3 Prisma queries on every visit; the dashboard server component runs 1 query with `include`. Both re-execute on repeat nav, even when nothing has changed.
3. **Heavy main bundle.** Recharts is only rendered on `/progress` but ships in the shared client JS chunk, inflating TTI for every other route (`/`, `/dashboard`, `/recovery`, settings).

Outcome: mutations feel instant (W1), repeat nav to `/progress` and unfiltered `/dashboard` skips Prisma (W2), and first-load TTI drops by the Recharts weight on every non-progress route (W3).

## Non-Goals

- No API contract changes. Response shapes (`{ id }`, `{ ok: true }`, full user object) stay as-is.
- No new toast vocabulary. Rollback errors reuse existing copy from `CLAUDE.md`'s toast list.
- No bundle analyzer installation — use `.next/build-manifest.json` diff for W3 verification.
- No optimistic updates for voice (already local) or suggestion cooldown (already optimistic).
- No caching of filtered dashboard queries — see W2 scope rationale.
- No migration off server component for dashboard — stays server-rendered, cache is cache-aside inside the server component.

## Pre-Implementation Verification

Confirmed during exploration:

- `/api/progress` is uncached, runs 2 Prisma queries in parallel, response varies only by `userId` (no query params). Drafts excluded (`is_draft: false`).
- Dashboard query at `src/app/dashboard/page.tsx:52-99` takes `datePreset`, `search`, `muscles` filter params. Drafts included.
- Existing cache pattern: `src/lib/recovery.ts:26-32` (`getRecovery`), helpers in `src/lib/cache.ts:5-42`. TTL 300s for recovery. All ops try/catch-wrapped.
- Existing invalidation sites for `recovery:` key: `src/app/api/workouts/route.ts:155` (non-draft only), `src/app/api/workouts/[id]/route.ts:146, 182, 210`.
- Recharts is imported only at `src/components/progress/ProgressChart.tsx:11` (7 named imports). No other route uses it.
- No existing `next/dynamic` or `React.lazy` usage in the codebase — W3 sets the first pattern.
- Suggestion cooldown already uses the optimistic-mutate pattern at `src/components/recovery/hooks/useSuggestion.ts:162-173` — W1 mirrors it.

---

## W1 — Optimistic Updates

### Scope

**In:** workout create, workout edit, workout delete, draft save (from form), draft publish (from drawer), profile save, custom exercise create.

**Out:** voice transcribe/parse (local state only), suggestion cooldown (already optimistic), body-weight server sync (server-only side-effect).

### Architecture

#### 1. Shared helper — `src/lib/optimistic.ts`

New module exporting one function:

```ts
import { mutate as globalMutate, type MutatorCallback } from "swr";

type OptimisticOptions<TCache, TResponse> = {
  key: string | ((key: string) => boolean);
  optimisticData: TCache | MutatorCallback<TCache>;
  request: () => Promise<TResponse>;
  reconcile?: (response: TResponse) => TCache;
};

export async function optimisticMutate<TCache, TResponse>(
  opts: OptimisticOptions<TCache, TResponse>,
): Promise<TResponse> {
  let responseRef: TResponse | undefined;
  await globalMutate<TCache>(
    opts.key,
    async () => {
      const response = await opts.request();
      responseRef = response;
      return opts.reconcile
        ? opts.reconcile(response)
        : (response as unknown as TCache);
    },
    {
      optimisticData: opts.optimisticData,
      rollbackOnError: true,
      populateCache: true,
      revalidate: false,
    },
  );
  return responseRef as TResponse;
}
```

Behavior: SWR writes `optimisticData` to the cache immediately, runs `request()`, on success populates cache with `reconcile(response)` (or the raw response cast to `TCache` when they share a shape), on failure rolls the cache back to its prior value and re-throws so callers can `toast.error(...)`. The server response is captured separately and returned to the caller — SWR's own return value is the cache shape, not the HTTP response shape, so we don't conflate the two.

#### 2. Dashboard `localWorkouts` mutation path

The dashboard list is a server component hydrated into `DashboardClient`'s `localWorkouts` state (not SWR). Optimistic inserts/removes need to mutate this local state.

Add optimistic-list actions to `src/store/workoutStore.ts`:

```ts
type OptimisticWorkout = WorkoutSummary & { _optimistic?: true };

// additions:
optimisticInsert: (w: OptimisticWorkout) => void;
optimisticReplace: (tempId: string, real: WorkoutSummary) => void;
optimisticRemove: (id: string) => void;
optimisticRestore: (w: WorkoutSummary) => void;
```

`DashboardClient` reads its list from `workoutStore.workouts` (seeded from server props via a `useEffect` that syncs on prop change), replacing the local `useState` it uses today.

Rationale: keeping the list in Zustand means optimistic actions and server-prop hydration share one state source. Rolling back a failed create becomes `optimisticRemove(tempId)`; rolling back a failed delete becomes `optimisticRestore(prev)`.

#### 3. Per-flow wiring

**Workout create (form submit):**
- Generate `tempId = "optimistic-" + crypto.randomUUID()`.
- Build optimistic `WorkoutSummary` from form state (exercises, date, duration, notes). Mark `_optimistic: true`.
- `workoutStore.optimisticInsert(temp)`; close drawer; `toast.success("Workout logged")`.
- Fire `POST /api/workouts`. On success, `workoutStore.optimisticReplace(tempId, { ...form, id: response.id })`. On error, `optimisticRemove(tempId)` + `toast.error("Failed to save workout")`.

**Workout edit (drawer):**
- Key: `/api/workouts/${id}`.
- `optimisticMutate({ key, optimisticData: newWorkout, request: () => PUT ..., reconcile: (_, prev) => ({ ...prev, ...newWorkout }) })`.
- Also optimistically update `workoutStore` list (edit can change date/summary fields visible on the card).
- Invalidate `/api/recovery` and `/api/progress` keys on success (`mutate(key, undefined)` with `revalidate: true`).

**Workout delete:**
- `optimisticRemove(id)` locally; close drawer; toast on click.
- Fire `DELETE /api/workouts/${id}`. On success, `globalMutate` recovery + progress keys. On error, `optimisticRestore(prev)` + error toast.

**Draft save (from form):**
- Same pattern as workout create but with `_optimistic: true` AND `isDraft: true` on the summary.
- On success, swap temp for real with `is_draft: true`. No recovery/progress invalidation (drafts excluded).

**Draft publish (from drawer):**
- Key: `/api/workouts/${id}`.
- Optimistic: `{ ...prev, is_draft: false, source: prev.source }`.
- `workoutStore` list: update the matching row's `isDraft` flag.
- On success, invalidate recovery + progress. On error, rollback + toast.

**Profile save:**
- Key: `/api/user/profile`.
- `optimisticMutate({ key, optimisticData: newProfile, request: () => PUT ... })`.
- Response is the full user object → use it as reconcile data.
- Keep `router.refresh()` — the navbar server component reads user name and needs a re-render.

**Custom exercise create:**
- Append to `/api/exercises?q=""` cache if active; SWR search results are keyed by query string so we only patch the no-filter key.
- Optimistic row uses a temp id until the server response replaces it.

### Data Flow (worked example — workout delete)

1. User clicks delete on a drawer → handler calls `workoutStore.getState().workouts` to snapshot prior value.
2. `workoutStore.optimisticRemove(id)` — dashboard list updates immediately; toast fires.
3. `fetchWithAuth("/api/workouts/${id}", { method: "DELETE" })` starts.
4. On 2xx: `globalMutate("/api/recovery")` + `globalMutate("/api/progress")`. Drawer already closed; no further UI work.
5. On 4xx/5xx: `workoutStore.optimisticRestore(prev)` — row reappears in the list. `toast.error("Failed to delete workout")`. Drawer stays closed.

### `router.refresh()` audit

Remove where redundant (cache writes are authoritative):
- `src/components/workout/hooks/useWorkoutForm.ts` — drop after CRUD (dashboard list lives in Zustand now).
- `src/components/workout/DeleteWorkoutButton.tsx` — drop.
- `src/components/workout/hooks/usePublishDraft.ts` — drop.

Keep:
- `src/components/settings/hooks/useProfileSave.ts` + `useFitnessForm.ts` — navbar server component reads profile.
- Auth and onboarding flows — not touched by this work.

### Testing

- `src/lib/__tests__/optimistic.test.ts` — happy path (cache populated with optimistic then real value), rollback on error (cache returns to prior value, error re-thrown).
- `src/store/__tests__/workoutStore.test.ts` — new actions (`optimisticInsert`, `optimisticReplace`, `optimisticRemove`, `optimisticRestore`).
- Integration: `useWorkoutForm` submit test — mock `POST /api/workouts` with a delay, assert `workoutStore.workouts` contains the new row before the mock resolves.
- E2E (manual, not Playwright): create/edit/delete a workout on Slow 3G → UI updates immediately, reconciles on network response.

### Error Handling

- All mutation errors: `toast.error("Failed to <verb> workout" | "Failed to update profile" | …)` using existing CLAUDE.md vocabulary.
- `optimisticMutate` re-throws so the caller can decide whether to toast. Callers always toast.
- No partial-success UI — the cache is either the optimistic value or the prior value, never mid-state.

### Risks

- **Temp IDs leaking into server requests.** If a user clicks the optimistic row's drawer before the server confirms, opening `/api/workouts/optimistic-xxx` would 404. Mitigation: the card hover-prefetch + click handlers read `w._optimistic` and disable navigation until reconciled.
- **Double-reconcile on fast re-submits.** If a user edits a workout twice in quick succession, the first `PUT`'s reconcile could stomp the second optimistic data. SWR's `populateCache: true` with `revalidate: false` plus `rollbackOnError: true` handles this per-mutation; re-submits re-enter the same flow and the last-write-wins.
- **Server-component prop drift.** When `router.refresh()` is removed, the server-rendered dashboard prop lags the optimistic store on hard reload. Acceptable — the store re-hydrates from fresh server props on mount.

---

## W2 — Redis Caching on `/api/progress` and Dashboard

### Scope

**In:** `/api/progress` (always cached), dashboard unfiltered list (cached only when no query params).

**Out:** `/api/workouts` list endpoint (filter space too wide), `/api/exercises?q=...` search (already covers the no-filter path), any mutation endpoint.

### Architecture

#### 1. New cache helpers — `src/lib/cache.ts`

Mirror the existing `getCachedRecovery / setCachedRecovery / invalidateRecovery` trio:

```ts
const PROGRESS_TTL = 300;
const DASHBOARD_TTL = 300;

export async function getCachedProgress(userId: string): Promise<ProgressPayload | null> { /* ... */ }
export async function setCachedProgress(userId: string, data: ProgressPayload): Promise<void> { /* ... */ }
export async function invalidateProgress(userId: string): Promise<void> { /* ... */ }

export async function getCachedDashboard(userId: string): Promise<DashboardWorkoutsPayload | null> { /* ... */ }
export async function setCachedDashboard(userId: string, data: DashboardWorkoutsPayload): Promise<void> { /* ... */ }
export async function invalidateDashboard(userId: string): Promise<void> { /* ... */ }
```

Keys: `progress:{userId}`, `dashboard:{userId}`. All try/catch-wrapped, Redis-down = cache miss.

#### 2. `/api/progress` cache-aside

In `src/app/api/progress/route.ts`:

```ts
const cached = await getCachedProgress(userId);
if (cached) return NextResponse.json(cached);

const [sessions, bodyWeight] = await Promise.all([/* existing queries */]);
const payload = /* existing transform */;
await setCachedProgress(userId, payload);
return NextResponse.json(payload);
```

No behavior change. Response shape identical.

#### 3. Dashboard cache-aside with filter bypass

Extract the existing Prisma query from `src/app/dashboard/page.tsx:52-99` into a new `src/lib/dashboard.ts`:

```ts
type DashboardFilters = {
  datePreset?: string;
  search?: string;
  muscles?: string;
};

export async function getDashboardWorkouts(
  userId: string,
  filters: DashboardFilters,
) {
  const hasFilters =
    !!filters.datePreset || !!filters.search || !!filters.muscles;

  if (!hasFilters) {
    const cached = await getCachedDashboard(userId);
    if (cached) return cached;
  }

  const workouts = await prisma.workout.findMany({ /* existing query */ });
  const payload = /* existing transform */;

  if (!hasFilters) await setCachedDashboard(userId, payload);
  return payload;
}
```

`src/app/dashboard/page.tsx` imports and calls this instead of running Prisma inline.

#### 4. Invalidation wiring

Add the new invalidation calls alongside the existing `invalidateRecovery` calls.

| Mutation (file:line) | Add `invalidateProgress` | Add `invalidateDashboard` |
|---|:-:|:-:|
| `src/app/api/workouts/route.ts:155` (POST non-draft) | ✅ | ✅ |
| `src/app/api/workouts/route.ts` POST draft branch | — | ✅ |
| `src/app/api/workouts/draft/route.ts` (suggestion path) | — | ✅ |
| `src/app/api/workouts/[id]/route.ts:146` (PUT) | ✅ | ✅ |
| `src/app/api/workouts/[id]/route.ts:182` (PATCH publish) | ✅ | ✅ |
| `src/app/api/workouts/[id]/route.ts:210` (DELETE) | ✅ | ✅ |

Pattern (PUT example):

```ts
await Promise.all([
  invalidateRecovery(user.id),
  invalidateProgress(user.id),
  invalidateDashboard(user.id),
]);
```

For the two draft-creation paths that don't affect recovery/progress, only `invalidateDashboard` is added.

### Data Flow (worked example — POST /api/workouts non-draft)

1. Request arrives, auth + validation as today.
2. Prisma write inside transaction.
3. After transaction commits: `Promise.all([invalidateRecovery, invalidateProgress, invalidateDashboard])` — three Redis `del` calls in parallel.
4. Response.
5. Next request to `/api/progress` or `/dashboard` (unfiltered) rebuilds the cache from Prisma.

### Testing

- `src/lib/__tests__/cache.test.ts` — extend with tests for the new helpers (get/set/invalidate round-trip against the Redis mock).
- `src/app/api/progress/__tests__/route.test.ts` — hit the route twice, second call reads from `redis.get` mock (returns cached payload), Prisma mock is called zero times on the second call.
- `src/app/api/workouts/__tests__/route.test.ts` and `[id]/__tests__/route.test.ts` — assert `redis.del` is called for `progress:{userId}` and `dashboard:{userId}` on each mutation.
- `src/lib/__tests__/dashboard.test.ts` — with filters set, cache is bypassed (no `redis.get`); without filters, cache is consulted.

### Error Handling

- Redis `get` failure → `catch` returns `null` → falls through to Prisma (current recovery pattern).
- Redis `set` failure → swallowed, response still returned (current recovery pattern).
- `invalidate*` failure inside mutation handlers — swallow; next read will return stale data for up to 300s. Acceptable.

### Risks

- **Cache stampede on hot users.** If cache expires and N tabs request `/api/progress` simultaneously, all N run Prisma. Mitigation: ignored. SWR's dedupingInterval on the client limits simultaneous requests per tab; cross-tab stampede is rare and 3 parallel Prisma calls are fine.
- **Stale cache if an invalidation call fails silently.** The next mutation will invalidate again. 300s TTL is the backstop.
- **Dashboard filter bypass hides cache from the most common user.** The assumption is that most navigation is from other routes back to an unfiltered `/dashboard`. If telemetry later shows filter use dominates, we revisit with the versioned-key approach.

---

## W3 — Lazy-Load Recharts

### Scope

**In:** `ProgressChart` dynamic import, loading-state refactor, type hoisting.

**Out:** any other bundle-splitting work, chart library swap, Recharts version upgrade.

### Architecture

#### 1. Skeleton extraction

Extract the JSX at `src/components/progress/ProgressClient.tsx:53-70` into a named component `ProgressChartSkeleton` in the same file (export if shared). It's a simple grid of `skeleton`-classed divs matching the chart layout.

#### 2. Dynamic import

Replace `import ProgressChart from "./ProgressChart"` at `ProgressClient.tsx:8` with:

```tsx
import dynamic from "next/dynamic";

const ProgressChart = dynamic(() => import("./ProgressChart"), {
  ssr: false,
  loading: () => <ProgressChartSkeleton />,
});
```

`ssr: false` skips server rendering — charts are purely client-side interactive anyway, and `"use client"` is already declared.

#### 3. Type hoisting

`LineConfig` type is currently exported from `ProgressChart.tsx`. Named exports from a dynamic-imported module aren't hoisted onto the component variable. Move `LineConfig` to `src/types/progress.ts` alongside `MetricMode`, and update any consumer imports. `ProgressChart.tsx` can still re-export it for convenience during transition, but consumers prefer the types module.

### Data Flow

1. User navigates to `/dashboard` — Recharts chunk is not requested.
2. User navigates to `/progress` — `ProgressClient` renders, Next fetches the `ProgressChart` chunk (contains Recharts).
3. While the chunk is in-flight: `<ProgressChartSkeleton />` renders (same skeleton shown while data loads).
4. Chunk resolves: `ProgressChart` renders with either the data or the empty-state message (existing behavior unchanged).

### Testing

- `npm run test:run -- src/components/progress` — all existing tests continue to pass. The dynamic import is opaque to RTL; tests import `ProgressChart` directly where needed.
- `next build` before/after: diff `.next/build-manifest.json`'s main chunk entries — Recharts and its deps should disappear from the shared chunk and appear in a `/progress`-specific chunk.
- Manual: DevTools Network tab on `/dashboard` cold load — filter JS, confirm no `recharts` chunk. Nav to `/progress` — chunk loads, brief skeleton, chart renders.

### Error Handling

- Chunk load failure (rare — network drop mid-navigation): Next emits a client error. `next/dynamic` does not auto-retry. User-facing: page appears with the skeleton and no chart. Mitigation: existing `FetchError` component in `ProgressClient.tsx` is separate (for data errors, not chunk errors); no additional handling needed for chunk errors in this pass.

### Risks

- **LineConfig import break.** Any consumer importing `LineConfig` from `./ProgressChart` (not the types module) must be updated. Scope is small — confirm via grep during implementation.
- **SSR-only analytics regression.** Server-side analytics tools that snapshot page HTML will no longer see chart DOM. Not in use in this project.

---

## Shared Principles

- **Copy existing patterns, don't invent.** `getRecovery` is the cache-aside template. `useSuggestion`'s cooldown mutation is the optimistic-mutate template.
- **Try/catch all Redis calls.** Cache failures must not 500 the app.
- **Preserve `withLogging` wrapping** on every route handler touched.
- **No new dependencies.** `sonner`, `swr`, `zustand`, `next/dynamic` are all already installed.

## Ship Order

Recommended: **W3 → W2 → W1.**

- W3 is a same-day change, low risk, proves the dynamic-import pattern for future use.
- W2 has a well-established template and is a clean extension of existing cache behavior.
- W1 is the largest refactor; landing it after W2 means optimistic cache writes reconcile with cached API responses (not just Prisma fallbacks), which reduces perceived latency further.

## End-to-End Verification

- `npx tsc --noEmit` — no errors.
- `npm run test:run` — all 287+ existing tests pass plus new tests for `optimistic`, `cache` helpers, `dashboard.ts`, and `workoutStore` actions.
- `npm run lint` — clean.
- `next build` diff — Recharts absent from shared JS.
- Manual Slow 3G pass: create/edit/delete a workout → UI immediate; repeat-load `/progress` and unfiltered `/dashboard` → server logs show no Prisma calls on the second hit.
