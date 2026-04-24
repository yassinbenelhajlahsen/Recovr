# Redis Caching for `/api/progress` and Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the Prisma round-trip on repeat loads of `/api/progress` (always cached) and the dashboard workout list (cached only when no filters are applied) by extending the existing `getRecovery` cache-aside pattern.

**Architecture:** Mirror `src/lib/cache.ts`'s recovery helpers for two new keys — `progress:{userId}` and `dashboard:{userId}` — both 300s TTL. Extract the dashboard's inline Prisma query into a new `src/lib/dashboard.ts` with cache-aside + filter bypass. Add `invalidateProgress` and `invalidateDashboard` calls to every workout mutation route.

**Tech Stack:** Next.js 16 (App Router), Prisma 7, Upstash Redis (REST), TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-04-23-perf-pass-design.md` (W2 section)

---

## Pre-Flight Verification

Confirmed:
- Existing cache pattern lives in `src/lib/cache.ts:12-42` (`getCachedRecovery` / `setCachedRecovery` / `invalidateRecovery`). All ops try/catch-wrapped, null-safe, TTL constant near top of file.
- `getRecovery(userId)` in `src/lib/recovery.ts:26-32` is the cache-aside wrapper template.
- `/api/progress` at `src/app/api/progress/route.ts` runs 2 parallel Prisma queries, response varies only by `userId`.
- Dashboard inline query at `src/app/dashboard/page.tsx:52-99` takes `datePreset`, `search`, `muscles`; drafts included; no pagination.
- Current invalidation sites for `recovery:`: `src/app/api/workouts/route.ts:155`, `src/app/api/workouts/[id]/route.ts:146, 182, 210`.
- `src/app/api/workouts/draft/route.ts` already imports from `@/lib/cache` (`invalidateExercises`, `setSuggestionDraftId`).

---

## Task 1: Add response-shape types for cache payloads

**Files:**
- Modify: `src/types/progress.ts`
- Create: `src/types/dashboard.ts`

- [ ] **Step 1: Add `ProgressPayload` type alias**

The `/api/progress` route returns `{ exercises, sessionsByExercise, bodyWeightHistory }` — this already matches `ProgressClientProps` in `src/types/progress.ts:35-39`. Add an explicit alias so the cache API has a clear type name that doesn't hint at "client props" when used server-side.

Append to `src/types/progress.ts`:

```ts
/** Server-side alias for the /api/progress response body. Structurally identical to ProgressClientProps. */
export type ProgressPayload = ProgressClientProps;
```

- [ ] **Step 2: Create `src/types/dashboard.ts` for the dashboard list payload**

The dashboard's serialized workouts shape is declared inline at `src/app/dashboard/page.tsx:109-118`. It matches the existing `Workout` type in `src/types/workout.ts:92-101`. Create a shared payload type:

```ts
// src/types/dashboard.ts
import type { Workout } from "@/types/workout";

export type DashboardWorkoutsPayload = Workout[];

export type DashboardFilters = {
  datePreset?: string;
  search?: string;
  muscles?: string;
};
```

`DashboardFilters` mirrors the `searchParams` shape at `src/app/dashboard/page.tsx:33` (minus `draft`, which is a deep-link, not a query filter).

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/progress.ts src/types/dashboard.ts
git commit -m "types: add ProgressPayload and DashboardWorkoutsPayload aliases for cache layer"
```

---

## Task 2: Add progress + dashboard cache helpers to `src/lib/cache.ts`

**Files:**
- Modify: `src/lib/cache.ts`

- [ ] **Step 1: Add TTL constants**

In `src/lib/cache.ts`, below the existing TTL constants at lines 5-8:

```ts
const PROGRESS_TTL = 300; // 5 minutes
const DASHBOARD_TTL = 300; // 5 minutes
```

- [ ] **Step 2: Add progress cache helpers**

Append this block after the existing `invalidateRecovery` function at `src/lib/cache.ts:35-42`, still within the "Recovery" section or in a new `// ---- Progress ----` section:

```ts
// ---- Progress ----

import type { ProgressPayload } from "@/types/progress";

export async function getCachedProgress(
  userId: string,
): Promise<ProgressPayload | null> {
  if (!redis) return null;
  try {
    return await redis.get<ProgressPayload>(`progress:${userId}`);
  } catch {
    return null;
  }
}

export async function setCachedProgress(
  userId: string,
  data: ProgressPayload,
): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(`progress:${userId}`, data, { ex: PROGRESS_TTL });
  } catch {
    // ignore
  }
}

export async function invalidateProgress(userId: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(`progress:${userId}`);
  } catch {
    // ignore
  }
}
```

Move the `import type { ProgressPayload }` to the top of the file alongside the existing type imports (line 3) rather than leaving it inline.

- [ ] **Step 3: Add dashboard cache helpers**

Add a new section below the progress helpers:

```ts
// ---- Dashboard ----

import type { DashboardWorkoutsPayload } from "@/types/dashboard";

export async function getCachedDashboard(
  userId: string,
): Promise<DashboardWorkoutsPayload | null> {
  if (!redis) return null;
  try {
    return await redis.get<DashboardWorkoutsPayload>(`dashboard:${userId}`);
  } catch {
    return null;
  }
}

export async function setCachedDashboard(
  userId: string,
  data: DashboardWorkoutsPayload,
): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(`dashboard:${userId}`, data, { ex: DASHBOARD_TTL });
  } catch {
    // ignore
  }
}

export async function invalidateDashboard(userId: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(`dashboard:${userId}`);
  } catch {
    // ignore
  }
}
```

Again move the `import type { DashboardWorkoutsPayload }` to the top of the file.

The final top-of-file import block should look like:

```ts
import { redis } from "@/lib/redis";
import type { MuscleRecovery } from "@/types/recovery";
import type { WorkoutSuggestion } from "@/types/suggestion";
import type { ProgressPayload } from "@/types/progress";
import type { DashboardWorkoutsPayload } from "@/types/dashboard";
```

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cache.ts
git commit -m "feat(cache): add progress and dashboard cache helpers"
```

---

## Task 3: Unit-test the new cache helpers

**Files:**
- Create or Modify: `src/lib/__tests__/cache.test.ts`

Check first if the test file already exists:
```bash
ls src/lib/__tests__/cache.test.ts 2>/dev/null && echo "exists" || echo "new"
```

- [ ] **Step 1: Write failing tests**

If `src/lib/__tests__/cache.test.ts` does not exist, create it with this content. If it exists, append the `describe` blocks below to it.

```ts
// If this is a new file, start with:
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getCachedProgress,
  setCachedProgress,
  invalidateProgress,
  getCachedDashboard,
  setCachedDashboard,
  invalidateDashboard,
} from "@/lib/cache";
import { redis } from "@/lib/redis";

const mockRedis = redis as unknown as {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
};

const USER_ID = "user-123";

beforeEach(() => {
  vi.clearAllMocks();
  mockRedis.get.mockResolvedValue(null);
  mockRedis.set.mockResolvedValue("OK");
  mockRedis.del.mockResolvedValue(1);
});

describe("progress cache helpers", () => {
  it("getCachedProgress returns Redis value for the correct key", async () => {
    const payload = { exercises: [], sessionsByExercise: {}, bodyWeightHistory: [] };
    mockRedis.get.mockResolvedValueOnce(payload);

    const result = await getCachedProgress(USER_ID);

    expect(mockRedis.get).toHaveBeenCalledWith(`progress:${USER_ID}`);
    expect(result).toEqual(payload);
  });

  it("getCachedProgress returns null when Redis throws", async () => {
    mockRedis.get.mockRejectedValueOnce(new Error("boom"));

    const result = await getCachedProgress(USER_ID);

    expect(result).toBeNull();
  });

  it("setCachedProgress writes with 300s TTL", async () => {
    const payload = { exercises: [], sessionsByExercise: {}, bodyWeightHistory: [] };

    await setCachedProgress(USER_ID, payload);

    expect(mockRedis.set).toHaveBeenCalledWith(
      `progress:${USER_ID}`,
      payload,
      { ex: 300 },
    );
  });

  it("setCachedProgress swallows Redis errors", async () => {
    mockRedis.set.mockRejectedValueOnce(new Error("boom"));
    await expect(
      setCachedProgress(USER_ID, { exercises: [], sessionsByExercise: {}, bodyWeightHistory: [] }),
    ).resolves.toBeUndefined();
  });

  it("invalidateProgress deletes the correct key", async () => {
    await invalidateProgress(USER_ID);
    expect(mockRedis.del).toHaveBeenCalledWith(`progress:${USER_ID}`);
  });

  it("invalidateProgress swallows Redis errors", async () => {
    mockRedis.del.mockRejectedValueOnce(new Error("boom"));
    await expect(invalidateProgress(USER_ID)).resolves.toBeUndefined();
  });
});

describe("dashboard cache helpers", () => {
  it("getCachedDashboard returns Redis value for the correct key", async () => {
    const payload = [
      {
        id: "w1",
        date: "2026-04-23T00:00:00.000Z",
        dateFormatted: "Thu, Apr 23, 2026",
        durationMinutes: 45,
        notes: null,
        exerciseNames: ["Bench Press"],
        totalSets: 3,
        isDraft: false,
      },
    ];
    mockRedis.get.mockResolvedValueOnce(payload);

    const result = await getCachedDashboard(USER_ID);

    expect(mockRedis.get).toHaveBeenCalledWith(`dashboard:${USER_ID}`);
    expect(result).toEqual(payload);
  });

  it("setCachedDashboard writes with 300s TTL", async () => {
    await setCachedDashboard(USER_ID, []);
    expect(mockRedis.set).toHaveBeenCalledWith(
      `dashboard:${USER_ID}`,
      [],
      { ex: 300 },
    );
  });

  it("invalidateDashboard deletes the correct key", async () => {
    await invalidateDashboard(USER_ID);
    expect(mockRedis.del).toHaveBeenCalledWith(`dashboard:${USER_ID}`);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm run test:run -- src/lib/__tests__/cache.test.ts`
Expected: all progress + dashboard tests PASS. Any pre-existing tests in the file must also still pass.

If you created a new file: `vitest` will confirm it found N test files. If the file already existed and you appended tests, ensure the existing ones still pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/cache.test.ts
git commit -m "test(cache): cover progress and dashboard cache helpers"
```

---

## Task 4: Wrap `/api/progress` with cache-aside

**Files:**
- Modify: `src/app/api/progress/route.ts`

- [ ] **Step 1: Add imports**

At the top of `src/app/api/progress/route.ts`, alongside the existing imports, add:

```ts
import { getCachedProgress, setCachedProgress } from "@/lib/cache";
```

- [ ] **Step 2: Wrap the Prisma block with cache-aside**

Replace the `try` body from `src/app/api/progress/route.ts:17-70` (from the opening `const [rawSessions, rawBodyWeight]` to the closing `return NextResponse.json({ exercises, sessionsByExercise, bodyWeightHistory });`) with:

```ts
  try {
    const cached = await getCachedProgress(userId);
    if (cached) {
      return NextResponse.json(cached);
    }

    const [rawSessions, rawBodyWeight] = await Promise.all([
      prisma.workoutExercise.findMany({
        where: { workout: { user_id: userId, is_draft: false } },
        select: {
          exercise_id: true,
          exercise: { select: { id: true, name: true } },
          workout: { select: { date: true } },
          sets: { select: { reps: true, weight: true } },
        },
        orderBy: { workout: { date: "asc" } },
      }),
      prisma.workout.findMany({
        where: { user_id: userId, is_draft: false, body_weight: { not: null } },
        select: { date: true, body_weight: true },
        orderBy: { date: "asc" },
      }),
    ]);

    // Derive distinct exercises and session counts in a single pass
    const exerciseMap = new Map<string, { id: string; name: string; count: number }>();
    for (const we of rawSessions) {
      const entry = exerciseMap.get(we.exercise_id);
      if (entry) {
        entry.count++;
      } else {
        exerciseMap.set(we.exercise_id, { id: we.exercise.id, name: we.exercise.name, count: 1 });
      }
    }

    const exercises: PerformedExercise[] = Array.from(exerciseMap.values())
      .map(({ id, name, count }) => ({ id, name, sessionCount: count }))
      .sort((a, b) => b.sessionCount - a.sessionCount);

    const sessionsByExercise: Record<string, ExerciseSession[]> = {};
    for (const we of rawSessions) {
      const id = we.exercise_id;
      if (!sessionsByExercise[id]) sessionsByExercise[id] = [];
      sessionsByExercise[id].push({
        date: we.workout.date.toISOString(),
        sets: we.sets.map((s) => ({ reps: s.reps, weight: s.weight })),
      });
    }

    const bodyWeightHistory: BodyWeightEntry[] = rawBodyWeight.map((w) => ({
      date: w.date.toISOString(),
      weight: w.body_weight!,
    }));

    const payload = { exercises, sessionsByExercise, bodyWeightHistory };
    await setCachedProgress(userId, payload);

    return NextResponse.json(payload);
  } catch (err) {
    logger.error({ err }, "GET /api/progress failed");
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
```

The only functional changes are:
1. `getCachedProgress` lookup before Prisma.
2. Response captured in a `payload` variable.
3. `setCachedProgress` write after Prisma succeeds.

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run existing progress-route tests**

Run: `npm run test:run -- src/app/api/progress`
Expected: any existing route tests still pass. The shape of the response is unchanged.

If no test file exists for the progress route yet, that's fine — coverage ships in Step 5.

- [ ] **Step 5: Add a cache-hit test for `/api/progress`**

Create or modify `src/app/api/progress/__tests__/route.test.ts`. Add a test that seeds the Redis mock with cached data and asserts Prisma is not called:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { mockAuthorized, TEST_USER_ID } from "@/test/mocks/supabase-server";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";

const mockRedis = redis as unknown as {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthorized();
  mockRedis.get.mockResolvedValue(null);
  mockRedis.set.mockResolvedValue("OK");
});

describe("GET /api/progress cache-aside", () => {
  it("returns cached payload without hitting Prisma when cache is warm", async () => {
    const cached = { exercises: [], sessionsByExercise: {}, bodyWeightHistory: [] };
    mockRedis.get.mockResolvedValueOnce(cached);

    const res = await GET();
    const body = await res.json();

    expect(mockRedis.get).toHaveBeenCalledWith(`progress:${TEST_USER_ID}`);
    expect(prisma.workoutExercise.findMany).not.toHaveBeenCalled();
    expect(prisma.workout.findMany).not.toHaveBeenCalled();
    expect(body).toEqual(cached);
  });

  it("hits Prisma and writes cache on miss", async () => {
    mockRedis.get.mockResolvedValueOnce(null);
    (prisma.workoutExercise.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    (prisma.workout.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    const res = await GET();

    expect(prisma.workoutExercise.findMany).toHaveBeenCalled();
    expect(prisma.workout.findMany).toHaveBeenCalled();
    expect(mockRedis.set).toHaveBeenCalledWith(
      `progress:${TEST_USER_ID}`,
      { exercises: [], sessionsByExercise: {}, bodyWeightHistory: [] },
      { ex: 300 },
    );
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 6: Run the new test**

Run: `npm run test:run -- src/app/api/progress`
Expected: both tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/progress/route.ts src/app/api/progress/__tests__/route.test.ts
git commit -m "perf(progress): add Redis cache-aside to /api/progress"
```

---

## Task 5: Extract dashboard query into `src/lib/dashboard.ts` with cache-aside

**Files:**
- Create: `src/lib/dashboard.ts`
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Create `src/lib/dashboard.ts`**

Write:

```ts
import { prisma } from "@/lib/prisma";
import { getCachedDashboard, setCachedDashboard } from "@/lib/cache";
import type { DashboardWorkoutsPayload, DashboardFilters } from "@/types/dashboard";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function resolveDatePreset(preset: string | undefined): { from?: Date; to?: Date } {
  if (!preset) return {};
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59));
  const daysAgo = (n: number) => new Date(startOfToday.getTime() - n * 86400000);
  if (preset === "30d") return { from: daysAgo(29), to: endOfToday };
  if (preset === "90d") return { from: daysAgo(89), to: endOfToday };
  if (preset === "6m") return { from: daysAgo(181), to: endOfToday };
  if (preset === "1y") return { from: daysAgo(364), to: endOfToday };
  return {};
}

export async function getDashboardWorkouts(
  userId: string,
  filters: DashboardFilters,
): Promise<DashboardWorkoutsPayload> {
  const search = filters.search ?? "";
  const muscles = filters.muscles ? filters.muscles.split(",").filter(Boolean) : [];
  const hasFilters = !!(search || filters.datePreset || muscles.length);

  if (!hasFilters) {
    const cached = await getCachedDashboard(userId);
    if (cached) return cached;
  }

  const { from, to } = resolveDatePreset(filters.datePreset);

  const workouts = await prisma.workout.findMany({
    where: {
      user_id: userId,
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
      ...(search || muscles.length
        ? {
            workout_exercises: {
              some: {
                exercise: {
                  AND: [
                    ...(search
                      ? [
                          {
                            OR: [
                              { name: { contains: search, mode: "insensitive" as const } },
                              { muscle_groups: { hasSome: [search.toLowerCase()] } },
                            ],
                          },
                        ]
                      : []),
                    ...(muscles.length
                      ? [{ muscle_groups: { hasSome: muscles } }]
                      : []),
                  ],
                },
              },
            },
          }
        : {}),
    },
    include: {
      workout_exercises: {
        orderBy: { order: "asc" },
        include: {
          exercise: { select: { name: true } },
          sets: { select: { id: true } },
        },
      },
    },
    orderBy: { date: "desc" },
  });

  const payload: DashboardWorkoutsPayload = workouts.map((w) => ({
    id: w.id,
    date: w.date.toISOString(),
    dateFormatted: formatDate(w.date),
    durationMinutes: w.duration_minutes,
    notes: w.notes,
    exerciseNames: w.workout_exercises.map((we) => we.exercise.name),
    totalSets: w.workout_exercises.reduce((sum, we) => sum + we.sets.length, 0),
    isDraft: w.is_draft,
  }));

  if (!hasFilters) {
    await setCachedDashboard(userId, payload);
  }

  return payload;
}
```

This is a direct extraction of the query + transform at `src/app/dashboard/page.tsx:52-118`, with two additions:
1. Cache read at the top when `hasFilters === false`.
2. Cache write at the bottom when `hasFilters === false`.

`formatDate` and `resolveDatePreset` are copied from the page (not deduplicated across the two files — the page will drop its copies in Step 2).

- [ ] **Step 2: Update `src/app/dashboard/page.tsx` to use the new function**

Replace `src/app/dashboard/page.tsx` contents entirely with:

```tsx
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { getRecovery } from "@/lib/recovery";
import { getDashboardWorkouts } from "@/lib/dashboard";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; datePreset?: string; muscles?: string; draft?: string }>;
}) {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();

  if (error || !claims) redirect("/auth/signin");

  const userId = claims.claims.sub as string;
  const userEmail = claims.claims.email as string;

  const { search, datePreset, muscles, draft } = await searchParams;

  const [dbUser, workouts, recovery] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, onboarding_completed: true },
    }),
    getDashboardWorkouts(userId, { search, datePreset, muscles }),
    getRecovery(userId),
  ]);

  if (dbUser && !dbUser.onboarding_completed) {
    redirect("/onboarding");
  }

  const displayName = dbUser?.name || userEmail;
  const hasFilters = !!(search || datePreset || (muscles && muscles.length));

  return (
    <DashboardClient
      displayName={displayName}
      workouts={workouts}
      hasFilters={hasFilters}
      recovery={recovery}
      openDraftId={draft}
    />
  );
}
```

The page shrinks from ~130 lines to ~40. Query, transform, and filter-parse logic all live in `src/lib/dashboard.ts` now.

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run full test suite**

Run: `npm run test:run`
Expected: all tests pass. No dashboard-page tests should break — the page's behavior is unchanged when the cache is cold.

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`

Steps:
1. Open http://localhost:3000/dashboard. Observe server logs — first load hits Prisma (expected).
2. Refresh within 5 minutes. Server logs should show no Prisma call on the `workout.findMany` — the cache served it.
3. Open http://localhost:3000/dashboard?search=bench — first load hits Prisma.
4. Refresh the same URL. Server logs should show **another** Prisma call — filtered requests bypass the cache.

Stop the dev server before committing.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dashboard.ts src/app/dashboard/page.tsx
git commit -m "perf(dashboard): extract query into src/lib/dashboard.ts with Redis cache-aside (unfiltered only)"
```

---

## Task 6: Add cache invalidation to workout mutation routes

**Files:**
- Modify: `src/app/api/workouts/route.ts`
- Modify: `src/app/api/workouts/[id]/route.ts`
- Modify: `src/app/api/workouts/draft/route.ts`

- [ ] **Step 1: Invalidate on `POST /api/workouts`**

In `src/app/api/workouts/route.ts`:

Update the import at line 4:

```ts
import { invalidateRecovery, invalidateProgress, invalidateDashboard } from "@/lib/cache";
```

Replace lines 153-156:

```ts
    // Invalidate recovery cache for non-draft workouts (drafts are excluded from recovery)
    if (is_draft !== true) {
      await invalidateRecovery(user.id);
    }
```

with:

```ts
    // Invalidate caches. Drafts don't affect recovery/progress but do show on the dashboard.
    if (is_draft !== true) {
      await Promise.all([
        invalidateRecovery(user.id),
        invalidateProgress(user.id),
        invalidateDashboard(user.id),
      ]);
    } else {
      await invalidateDashboard(user.id);
    }
```

- [ ] **Step 2: Invalidate on `PUT /api/workouts/[id]`**

In `src/app/api/workouts/[id]/route.ts`:

Update the import at line 4:

```ts
import {
  invalidateRecovery,
  invalidateProgress,
  invalidateDashboard,
  invalidateSuggestionDraftId,
} from "@/lib/cache";
```

Replace lines 145-148:

```ts
    await Promise.all([
      invalidateRecovery(user.id),
      parsedBodyWeight ? syncProfileWeight(user.id, id, parsedBodyWeight) : Promise.resolve(),
    ]);
```

with:

```ts
    await Promise.all([
      invalidateRecovery(user.id),
      invalidateProgress(user.id),
      invalidateDashboard(user.id),
      parsedBodyWeight ? syncProfileWeight(user.id, id, parsedBodyWeight) : Promise.resolve(),
    ]);
```

- [ ] **Step 3: Invalidate on `PATCH /api/workouts/[id]` (publish)**

In the same file, replace lines 179-183:

```ts
    await prisma.workout.update({ where: { id }, data: { is_draft: body.is_draft } });
    // Publishing a draft (is_draft → false) brings it into the recovery window
    if (body.is_draft === false) {
      await invalidateRecovery(user.id);
    }
```

with:

```ts
    await prisma.workout.update({ where: { id }, data: { is_draft: body.is_draft } });
    // Publishing (false) moves the workout into recovery/progress; un-publishing (true) moves it out.
    // Either way the dashboard list order/content may change.
    if (body.is_draft === false) {
      await Promise.all([
        invalidateRecovery(user.id),
        invalidateProgress(user.id),
        invalidateDashboard(user.id),
      ]);
    } else {
      await invalidateDashboard(user.id);
    }
```

- [ ] **Step 4: Invalidate on `DELETE /api/workouts/[id]`**

In the same file, replace lines 208-212:

```ts
    await prisma.workout.delete({ where: { id } });
    await Promise.all([
      invalidateRecovery(user.id),
      invalidateSuggestionDraftId(user.id),
    ]);
```

with:

```ts
    await prisma.workout.delete({ where: { id } });
    await Promise.all([
      invalidateRecovery(user.id),
      invalidateProgress(user.id),
      invalidateDashboard(user.id),
      invalidateSuggestionDraftId(user.id),
    ]);
```

Note: we invalidate progress/recovery even if the deleted workout was a draft. The cost of a single extra invalidation call is negligible compared to the complexity of pre-fetching the row to decide.

- [ ] **Step 5: Invalidate on `POST /api/workouts/draft`**

In `src/app/api/workouts/draft/route.ts`:

Update the import at line 4:

```ts
import { invalidateExercises, invalidateDashboard, setSuggestionDraftId } from "@/lib/cache";
```

After the `void setSuggestionDraftId(user.id, workout.id);` line (around line 92), add:

```ts
    await invalidateDashboard(user.id);
```

Drafts don't affect recovery or progress (both exclude `is_draft: true`), but they do appear in the dashboard list.

- [ ] **Step 6: Run type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Run existing workout route tests**

Run: `npm run test:run -- src/app/api/workouts`
Expected: existing tests continue to pass. They may need minor updates if they assert the exact set of cache calls on each mutation — update those assertions to include the new invalidations.

Specifically, look for tests that have:
- `expect(invalidateRecovery).toHaveBeenCalledWith(...)` — add parallel `invalidateProgress` / `invalidateDashboard` assertions if the test is meant to verify cache invalidation coverage.
- Or mock-call counts against `redis.del` — update counts.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/workouts/route.ts src/app/api/workouts/[id]/route.ts src/app/api/workouts/draft/route.ts
git commit -m "feat(cache): invalidate progress and dashboard on all workout mutations"
```

---

## Task 7: Full verification

**Files:** none

- [ ] **Step 1: Run full test suite**

Run: `npm run test:run`
Expected: 287+ existing tests plus the new cache tests (Task 3 adds ~9) and the progress-route tests (Task 4 adds 2) all pass.

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 4: Manual end-to-end**

Run: `npm run dev`

Steps:
1. Open `/progress` — confirm Prisma log on first load.
2. Refresh within 5 min — no Prisma log on the progress queries (cache hit).
3. Log a new workout — observe server logs: after POST, cache should be invalidated (`redis.del` calls).
4. Refresh `/progress` — Prisma log returns (cache was invalidated).
5. Open `/dashboard` — confirm Prisma log on first load (workout list).
6. Refresh within 5 min — no `workout.findMany` log.
7. Open `/dashboard?search=bench` — Prisma log (filter bypasses cache).
8. Refresh — Prisma log returns (still bypassing cache).
9. Delete a workout from the dashboard — after delete, `redis.del` for `recovery:`, `progress:`, `dashboard:`. Refresh `/dashboard` — Prisma log returns.

Stop the dev server.

- [ ] **Step 5: Optional E2E smoke**

Run: `npm run test:e2e`
Expected: all Playwright tests pass. Nothing user-visible changed; this verifies no regression from the dashboard-page refactor.
