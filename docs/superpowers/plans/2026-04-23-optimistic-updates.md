# Optimistic Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every workout CRUD, draft operation, and profile save feel instant by writing optimistic data into the SWR cache and dashboard list before the server round-trip completes, with automatic rollback on error.

**Architecture:** A shared `optimisticMutate` helper wraps SWR's `mutate(optimisticData, { rollbackOnError: true })` for SWR-backed surfaces (detail drawer, profile). For the dashboard list — which is server-component-rendered into local state — extend `workoutStore` with an event-bus slice (`localMutation` + monotonic `localMutationSeq`) that `DashboardClient` subscribes to via `useEffect`. Mutations emit an event and fire the request in parallel; on error, they emit the inverse event and toast. API contracts stay as-is — optimistic data is built client-side from form state.

**Tech Stack:** Next.js 16 (App Router), React 19, SWR 2+, Zustand, sonner, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-04-23-perf-pass-design.md` (W1 section)

---

## Pre-Flight Verification

Confirmed from exploration:
- `DashboardClient` at `src/components/dashboard/DashboardClient.tsx` holds `localWorkouts` in `useState`, with a `useEffect` that diffs against incoming `workouts` props and delays removal by 300ms for exit animation (`:25-46`).
- Workout CRUD endpoints return `{ id }` (POST/PUT) or `{ ok: true }` (DELETE/PATCH), **not** the full updated row. Optimistic data must be constructed client-side.
- `useWorkoutStore` already owns `deletingWorkoutId` (`src/store/workoutStore.ts:11`) — the existing mechanism for triggering exit animations. Optimistic remove will reuse it.
- `router.refresh()` is called after: workout CRUD when no drawer callback (`useWorkoutForm.ts:178`), `handleSaveAsDraft` (`:223`), `DeleteWorkoutButton` when no drawer callback (`:53`), `useProfileSave` (`:51`).
- Profile endpoint PUT returns the full user object — simple path.
- Existing optimistic pattern reference: `useSuggestion.ts:162-171` uses `globalMutate(key, updater, { revalidate: false })` for the cooldown SWR key. We copy this pattern for profile and detail-drawer.

---

## Task 1: Create `optimisticMutate` helper with tests

**Files:**
- Create: `src/lib/optimistic.ts`
- Create: `src/lib/__tests__/optimistic.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/optimistic.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mutate as globalMutate } from "swr";
import { optimisticMutate } from "@/lib/optimistic";

vi.mock("swr", async () => {
  const actual = await vi.importActual<typeof import("swr")>("swr");
  return {
    ...actual,
    mutate: vi.fn(),
  };
});

describe("optimisticMutate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls SWR mutate with optimisticData and the correct options", async () => {
    (globalMutate as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

    await optimisticMutate<{ id: string; name: string }, { id: string }>({
      key: "/api/user/profile",
      optimisticData: { id: "u1", name: "New Name" },
      request: async () => ({ id: "u1" }),
    });

    expect(globalMutate).toHaveBeenCalledTimes(1);
    const [key, _updater, opts] = (globalMutate as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(key).toBe("/api/user/profile");
    expect(opts).toMatchObject({
      optimisticData: { id: "u1", name: "New Name" },
      rollbackOnError: true,
      populateCache: true,
      revalidate: false,
    });
  });

  it("runs the request and returns its response", async () => {
    (globalMutate as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (_key, updater: () => Promise<unknown>) => {
        await updater();
        return undefined;
      },
    );

    const request = vi.fn().mockResolvedValue({ id: "w1" });
    const result = await optimisticMutate<{ id: string }, { id: string }>({
      key: "/api/workouts/w1",
      optimisticData: { id: "w1" },
      request,
    });

    expect(request).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ id: "w1" });
  });

  it("uses reconcile() to transform the response into cache shape", async () => {
    let capturedCacheValue: unknown = null;
    (globalMutate as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (_key, updater: () => Promise<unknown>) => {
        capturedCacheValue = await updater();
        return undefined;
      },
    );

    await optimisticMutate<{ id: string; name: string }, { id: string }>({
      key: "/api/workouts/w1",
      optimisticData: { id: "w1", name: "Pending" },
      request: async () => ({ id: "w1" }),
      reconcile: (res) => ({ id: res.id, name: "Reconciled" }),
    });

    expect(capturedCacheValue).toEqual({ id: "w1", name: "Reconciled" });
  });

  it("re-throws errors from the request so callers can toast", async () => {
    (globalMutate as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (_key, updater: () => Promise<unknown>) => {
        await updater();
      },
    );

    const err = new Error("boom");
    await expect(
      optimisticMutate({
        key: "/api/x",
        optimisticData: {},
        request: async () => { throw err; },
      }),
    ).rejects.toThrow("boom");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/lib/__tests__/optimistic.test.ts`
Expected: FAIL — `optimisticMutate is not exported from "@/lib/optimistic"`.

- [ ] **Step 3: Create `src/lib/optimistic.ts`**

```ts
import { mutate as globalMutate, type MutatorCallback } from "swr";

type Key = string | ((key: string) => boolean);

type OptimisticOptions<TCache, TResponse> = {
  key: Key;
  optimisticData: TCache | MutatorCallback<TCache>;
  request: () => Promise<TResponse>;
  /** Transform the server response into the cache shape. Omit when TResponse === TCache. */
  reconcile?: (response: TResponse) => TCache;
};

/**
 * SWR optimistic-mutation helper. Writes `optimisticData` to the cache immediately,
 * runs `request()`, then populates the cache with `reconcile(response)` (or the raw
 * response when `reconcile` is omitted). On error, the cache rolls back to its prior
 * value and the error is re-thrown so callers can `toast.error(...)`.
 *
 * SWR's own mutate returns the cache shape — this helper also returns the HTTP response
 * shape separately, because they're often different (e.g. cache is a full workout, response
 * is `{ id }`).
 */
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/lib/__tests__/optimistic.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Run type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/optimistic.ts src/lib/__tests__/optimistic.test.ts
git commit -m "feat(lib): add optimisticMutate helper for SWR optimistic updates"
```

---

## Task 2: Extend `workoutStore` with a local-mutation event bus

**Files:**
- Modify: `src/store/workoutStore.ts`
- Create: `src/store/__tests__/workoutStore.test.ts` (or modify if it exists)

- [ ] **Step 1: Write failing tests**

If `src/store/__tests__/workoutStore.test.ts` does not exist, create it. If it exists, append the new `describe` block.

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useWorkoutStore } from "@/store/workoutStore";

describe("workoutStore — local mutation event bus", () => {
  beforeEach(() => {
    // Reset store between tests
    useWorkoutStore.setState({
      localMutation: null,
      localMutationSeq: 0,
    });
  });

  it("emitLocalMutation sets the mutation and increments the sequence", () => {
    useWorkoutStore.getState().emitLocalMutation({ type: "remove", id: "w1" });
    const state = useWorkoutStore.getState();
    expect(state.localMutation).toEqual({ type: "remove", id: "w1" });
    expect(state.localMutationSeq).toBe(1);
  });

  it("emitting multiple mutations monotonically increments the sequence", () => {
    const store = useWorkoutStore.getState();
    store.emitLocalMutation({ type: "remove", id: "w1" });
    store.emitLocalMutation({
      type: "insert",
      workout: {
        id: "w2",
        date: "2026-04-23T00:00:00.000Z",
        dateFormatted: "Thu, Apr 23, 2026",
        durationMinutes: 0,
        notes: null,
        exerciseNames: [],
        totalSets: 0,
      },
    });
    const state = useWorkoutStore.getState();
    expect(state.localMutationSeq).toBe(2);
    expect(state.localMutation?.type).toBe("insert");
  });

  it("emits edit mutations with partial patches", () => {
    useWorkoutStore.getState().emitLocalMutation({
      type: "edit",
      id: "w1",
      patch: { isDraft: false },
    });
    const state = useWorkoutStore.getState();
    expect(state.localMutation).toEqual({
      type: "edit",
      id: "w1",
      patch: { isDraft: false },
    });
  });

  it("emits restore mutations with the full workout and after-id anchor", () => {
    const w = {
      id: "w1",
      date: "2026-04-23T00:00:00.000Z",
      dateFormatted: "Thu, Apr 23, 2026",
      durationMinutes: 0,
      notes: null,
      exerciseNames: [],
      totalSets: 0,
    };
    useWorkoutStore.getState().emitLocalMutation({
      type: "restore",
      workout: w,
      afterId: "w0",
    });
    expect(useWorkoutStore.getState().localMutation).toEqual({
      type: "restore",
      workout: w,
      afterId: "w0",
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/store/__tests__/workoutStore.test.ts`
Expected: FAIL — `emitLocalMutation is not a function` or similar.

- [ ] **Step 3: Extend `workoutStore`**

Update `src/store/workoutStore.ts` to:

```ts
import { create } from "zustand";
import type { WorkoutPreview, Workout } from "@/types/workout";

export type DrawerView = "create" | "view" | "edit";

export type LocalMutation =
  | { type: "insert"; workout: Workout; at?: "start" | "end" }
  | { type: "remove"; id: string }
  | { type: "edit"; id: string; patch: Partial<Workout> }
  | { type: "restore"; workout: Workout; afterId: string | null };

interface WorkoutStore {
  isDrawerOpen: boolean;
  drawerView: DrawerView | null;
  selectedWorkoutId: string | null;
  previewData: WorkoutPreview | null;
  deletingWorkoutId: string | null;

  // Local mutation event bus — DashboardClient subscribes via useEffect on localMutationSeq
  // and applies the mutation to its local workout list. Monotonic seq forces the effect to
  // fire even when the same mutation is emitted twice (e.g. retry).
  localMutation: LocalMutation | null;
  localMutationSeq: number;

  openDrawer: (workoutId?: string, preview?: WorkoutPreview) => void;
  closeDrawer: () => void;
  setDrawerView: (view: DrawerView) => void;
  setDeletingWorkoutId: (id: string | null) => void;
  emitLocalMutation: (mutation: LocalMutation) => void;
}

export const useWorkoutStore = create<WorkoutStore>((set) => ({
  isDrawerOpen: false,
  drawerView: null,
  selectedWorkoutId: null,
  previewData: null,
  deletingWorkoutId: null,
  localMutation: null,
  localMutationSeq: 0,
  openDrawer: (workoutId, preview) =>
    set({
      isDrawerOpen: true,
      drawerView: workoutId ? "view" : "create",
      selectedWorkoutId: workoutId ?? null,
      previewData: preview ?? null,
    }),
  closeDrawer: () =>
    set({
      isDrawerOpen: false,
      drawerView: null,
      selectedWorkoutId: null,
      previewData: null,
    }),
  setDrawerView: (view) => set({ drawerView: view }),
  setDeletingWorkoutId: (id) => set({ deletingWorkoutId: id }),
  emitLocalMutation: (mutation) =>
    set((s) => ({
      localMutation: mutation,
      localMutationSeq: s.localMutationSeq + 1,
    })),
}));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/store/__tests__/workoutStore.test.ts`
Expected: PASS (4 new tests). Any pre-existing tests in the file must also still pass.

- [ ] **Step 5: Run full store + type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/store/workoutStore.ts src/store/__tests__/workoutStore.test.ts
git commit -m "feat(store): add local-mutation event bus to workoutStore"
```

---

## Task 3: Wire `DashboardClient` to consume local-mutation events

**Files:**
- Modify: `src/components/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Add the event-consumer `useEffect`**

In `src/components/dashboard/DashboardClient.tsx`:

1. Update the imports at the top to pull the new pieces from the store:

```tsx
import { useWorkoutStore, type LocalMutation } from "@/store/workoutStore";
```

2. Add a pure helper just below the `export function DashboardClient(...)` line (inside the component is fine, but a module-level pure function is cleaner):

At the top of the file, below imports and before the component, add:

```tsx
function applyLocalMutation(prev: Workout[], m: LocalMutation): Workout[] {
  switch (m.type) {
    case "insert":
      return m.at === "end" ? [...prev, m.workout] : [m.workout, ...prev];
    case "remove":
      return prev.filter((w) => w.id !== m.id);
    case "edit":
      return prev.map((w) => (w.id === m.id ? { ...w, ...m.patch } : w));
    case "restore": {
      if (m.afterId === null) return [m.workout, ...prev];
      const idx = prev.findIndex((w) => w.id === m.afterId);
      if (idx === -1) return [m.workout, ...prev];
      return [...prev.slice(0, idx + 1), m.workout, ...prev.slice(idx + 1)];
    }
  }
}
```

3. Inside `DashboardClient`, subscribe to the event bus. Add these lines alongside the existing `useWorkoutStore` selectors (near `src/components/dashboard/DashboardClient.tsx:14-16`):

```tsx
  const localMutation = useWorkoutStore((s) => s.localMutation);
  const localMutationSeq = useWorkoutStore((s) => s.localMutationSeq);
  const lastSeqRef = useRef(localMutationSeq);
```

4. Add this `useEffect` after the existing sync effect (which ends around `:46`):

```tsx
  useEffect(() => {
    if (localMutationSeq === lastSeqRef.current) return;
    lastSeqRef.current = localMutationSeq;
    if (!localMutation) return;
    setLocalWorkouts((prev) => applyLocalMutation(prev, localMutation));
  }, [localMutationSeq, localMutation]);
```

The seq-ref guard ensures the effect only fires on actual emissions, not on re-renders where `localMutation` reference is stable. The effect intentionally does not include `localMutation` dependency change alone — only `localMutationSeq` gates application.

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: no errors. `Workout` is already imported at `src/components/dashboard/DashboardClient.tsx:10`.

- [ ] **Step 3: Run existing dashboard tests**

Run: `npm run test:run -- src/components/dashboard`
Expected: pass. No behavior change yet — no emitter is wired.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/DashboardClient.tsx
git commit -m "feat(dashboard): subscribe to local-mutation event bus"
```

---

## Task 4: Wire optimistic delete (simplest — removes from list)

**Files:**
- Modify: `src/components/workout/DeleteWorkoutButton.tsx`

- [ ] **Step 1: Refactor `handleClick` to emit the event before the request**

Replace the `handleClick` function at `src/components/workout/DeleteWorkoutButton.tsx:32-60` with:

```tsx
  async function handleClick() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setLoading(true);

    // Capture the removed row so we can restore on failure.
    const emit = useWorkoutStore.getState().emitLocalMutation;

    // Optimistic: mark the card as exiting (triggers animation in DashboardClient)
    // and remove from the local list once the animation completes.
    setDeletingWorkoutId(workoutId);
    setTimeout(() => emit({ type: "remove", id: workoutId }), 300);

    // Close the drawer immediately so the user feels the action landed.
    if (onDelete) onDelete();

    try {
      const res = await fetchWithAuth(`/api/workouts/${workoutId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();

      globalMutate(
        (k) => typeof k === "string" && k.startsWith("/api/workouts/"),
        undefined,
        { revalidate: false },
      );
      globalMutate("/api/recovery");
      globalMutate("/api/progress");
      toast.success("Workout deleted");

      // Kick the server-rendered dashboard so a full reload shows the real list.
      router.refresh();
    } catch {
      toast.error("Failed to delete workout");
      setLoading(false);
      setConfirming(false);
      // Rollback UI: we don't have the full Workout row here (button only has id).
      // Best-effort: clear the deletingWorkoutId; the next router.refresh (from any other
      // flow) will re-hydrate the list with the row still present.
      setDeletingWorkoutId(null);
    }
  }
```

Note: the existing non-drawer path (`router.push("/workouts")`) is dropped because the button only lives inside the drawer today (the dashboard cards don't have a delete button). If it's ever reused outside the drawer, the caller passes `onDelete` or handles navigation externally.

Also add the import at the top of the file if missing:

```tsx
import { useWorkoutStore } from "@/store/workoutStore";
```

(The file already imports `setDeletingWorkoutId` from `useWorkoutStore` at `:18`, but we also need `emitLocalMutation` inside `handleClick`.)

- [ ] **Step 2: Manual smoke test**

Run: `npm run dev`

Steps:
1. Open http://localhost:3000/dashboard, log in if needed.
2. Click any workout card → drawer opens.
3. Click Delete → Confirm.
4. The card should fade/collapse out immediately, the drawer closes, and a success toast appears — all before the server responds.
5. Open DevTools → Network, throttle to "Slow 3G", repeat. Confirm the card disappears before the DELETE request completes.

Stop the dev server.

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/workout/DeleteWorkoutButton.tsx
git commit -m "feat(workout): optimistic delete removes card before server round-trip"
```

---

## Task 5: Wire optimistic workout create

**Files:**
- Modify: `src/components/workout/hooks/useWorkoutForm.ts`

- [ ] **Step 1: Build the optimistic `Workout` summary from form state**

In `src/components/workout/hooks/useWorkoutForm.ts`, replace the `handleSubmit` function body (starting at `:80`) keeping the same validation logic but replacing the post-success block. Full new function:

```ts
  async function handleSubmit() {
    if (date > toLocalISODate()) {
      setError("Date cannot be in the future");
      return;
    }
    if (duration && (Number(duration) < 1 || Number(duration) > 999)) {
      setError("Duration must be between 1 and 999 minutes");
      return;
    }
    if (bodyWeight && (parseFloat(bodyWeight) < 1 || parseFloat(bodyWeight) > 999)) {
      setError("Body weight must be between 1 and 999");
      return;
    }
    if (exercises.length === 0) {
      setError("Add at least one exercise");
      return;
    }
    if (exercises.length > 50) {
      setError("Too many exercises (max 50)");
      return;
    }
    for (const ex of exercises) {
      if (ex.sets.length > 20) {
        setError(`Too many sets for ${ex.exercise_name} (max 20)`);
        return;
      }
      for (const s of ex.sets) {
        if (!s.reps || !s.weight) {
          setError(`Fill in reps and weight for all sets in ${ex.exercise_name}`);
          return;
        }
        if (Number(s.reps) < 0 || Number(s.weight) < 0) {
          setError(`Reps or weight cannot be negative in ${ex.exercise_name}`);
          return;
        }
        if (Number(s.reps) > 10000 || Number(s.weight) > 10000) {
          setError(`Reps or weight values are out of range in ${ex.exercise_name}`);
          return;
        }
      }
    }
    setError("");
    setSaving(true);

    const tempId = isEdit ? workoutId! : `optimistic-${crypto.randomUUID()}`;
    const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
    const optimisticSummary: Workout = {
      id: tempId,
      date: new Date(date).toISOString(),
      dateFormatted: new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(date)),
      durationMinutes: duration ? Number(duration) : null,
      notes: notes || null,
      exerciseNames: exercises.map((ex) => ex.exercise_name),
      totalSets,
      isDraft: false,
    };

    // Optimistic: add to dashboard list (create) or patch in place (edit)
    const emit = useWorkoutStore.getState().emitLocalMutation;
    if (isEdit) {
      emit({
        type: "edit",
        id: tempId,
        patch: {
          date: optimisticSummary.date,
          dateFormatted: optimisticSummary.dateFormatted,
          durationMinutes: optimisticSummary.durationMinutes,
          notes: optimisticSummary.notes,
          exerciseNames: optimisticSummary.exerciseNames,
          totalSets,
        },
      });
    } else {
      emit({ type: "insert", workout: optimisticSummary });
    }

    try {
      const body = {
        date,
        notes: notes || null,
        duration_minutes: duration || null,
        body_weight: bodyWeight ? parseFloat(bodyWeight) : null,
        exercises: exercises.map((ex, i) => ({
          exercise_id: ex.exercise_id,
          order: i,
          sets: ex.sets.map((s) => ({
            set_number: s.set_number,
            reps: s.reps,
            weight: s.weight,
          })),
        })),
      };
      const res = await fetchWithAuth(
        isEdit ? `/api/workouts/${workoutId}` : "/api/workouts",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error();
      const { id } = await res.json();

      // Reconcile: if this was a create, swap the temp id for the real one.
      if (!isEdit && id !== tempId) {
        emit({ type: "remove", id: tempId });
        emit({ type: "insert", workout: { ...optimisticSummary, id } });
      }

      toast.success(isEdit ? "Workout updated" : "Workout logged");

      globalMutate(
        (k) => typeof k === "string" && k.startsWith("/api/workouts/"),
        undefined,
        { revalidate: false },
      );
      globalMutate("/api/recovery");
      globalMutate("/api/progress");

      if (onSave) {
        const saveData: WorkoutSaveData = {
          id,
          date,
          duration_minutes: duration ? Number(duration) : null,
          body_weight: bodyWeight ? parseFloat(bodyWeight) : null,
          notes: notes || null,
          workout_exercises: exercises.map((ex, i) => ({
            id: `local-we-${i}`,
            exercise: { id: ex.exercise_id, name: ex.exercise_name, muscle_groups: ex.muscle_groups, equipment: ex.equipment ?? null },
            sets: ex.sets.map((s) => ({
              id: s.id,
              set_number: s.set_number,
              reps: Number(s.reps),
              weight: Number(s.weight),
            })),
          })),
        };
        onSave(saveData);
      }
      // router.push/refresh removed — the optimistic emit + globalMutate handle UI updates.
    } catch {
      // Rollback the dashboard list change.
      if (isEdit) {
        // Edit rollback: we don't have the pre-edit summary in scope. Easiest: refresh
        // to pull the canonical server state.
        router.refresh();
      } else {
        emit({ type: "remove", id: tempId });
      }
      toast.error("Failed to save workout");
      setSaving(false);
    }
  }
```

Also update the imports at the top of the file:

1. Add `Workout` to the existing workout-types import at line 8:

```ts
import type { ExerciseEntry, Exercise, WorkoutFormInitialData, WorkoutFormProps, WorkoutSaveData, Workout } from "@/types/workout";
```

2. Add a new line for the store:

```ts
import { useWorkoutStore } from "@/store/workoutStore";
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run existing form tests**

Run: `npm run test:run -- src/components/workout`
Expected: pass. Existing tests may need minor updates if they asserted specific `router.push` calls or inline toast messages — adjust them to the new flow.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`. Steps:
1. On the dashboard, click "Log Workout" → fill form → Save.
2. The new card should appear at the top of the list **before** the server response. Toast "Workout logged" appears.
3. Throttle to Slow 3G, repeat. Card appears immediately; after ~1-2s, the server responds and the temp id is swapped for the real id (no visual flicker — the summary is identical).
4. Edit an existing workout (change notes, save). Card on dashboard updates the notes text immediately.
5. Force an error: stop the dev server mid-save by killing it, or temporarily tweak `handleSubmit` to throw. Confirm the optimistic card rolls back (disappears) and "Failed to save workout" toast shows.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/components/workout/hooks/useWorkoutForm.ts
git commit -m "feat(workout): optimistic create and edit via local-mutation event bus"
```

---

## Task 6: Wire optimistic workout edit in the detail drawer's SWR cache

**Files:**
- Modify: `src/components/workout/hooks/useWorkoutForm.ts`

Task 5 already handles the dashboard list for edits. This task adds optimistic SWR for the `/api/workouts/{id}` detail cache so the drawer's "view" mode also reflects edits instantly.

- [ ] **Step 1: Update the edit path to patch the detail SWR cache**

In the same `handleSubmit` function from Task 5, immediately before the `fetchWithAuth(...)` call and only in the edit branch, patch the SWR detail cache optimistically.

Find the block:

```ts
    if (isEdit) {
      emit({
        type: "edit",
        id: tempId,
        patch: { ... },
      });
    } else {
      emit({ type: "insert", workout: optimisticSummary });
    }
```

Update it to ALSO write to the SWR detail cache (edit branch only):

```ts
    if (isEdit) {
      emit({
        type: "edit",
        id: tempId,
        patch: {
          date: optimisticSummary.date,
          dateFormatted: optimisticSummary.dateFormatted,
          durationMinutes: optimisticSummary.durationMinutes,
          notes: optimisticSummary.notes,
          exerciseNames: optimisticSummary.exerciseNames,
          totalSets,
        },
      });

      // Optimistically patch the detail SWR cache (drawer "view" mode reads from it).
      globalMutate(
        `/api/workouts/${workoutId}`,
        (prev: WorkoutDetail | undefined) => prev ? {
          ...prev,
          date: optimisticSummary.date,
          duration_minutes: optimisticSummary.durationMinutes,
          notes: optimisticSummary.notes,
        } : prev,
        { revalidate: false },
      );
    } else {
      emit({ type: "insert", workout: optimisticSummary });
    }
```

Add the import for `WorkoutDetail` if not already present:

```ts
import type { ExerciseEntry, Exercise, WorkoutFormInitialData, WorkoutFormProps, WorkoutSaveData, Workout, WorkoutDetail } from "@/types/workout";
```

Note: we only patch scalar fields (date, duration, notes). Exercises/sets require reconstructing the full nested shape from form state; we let the revalidation (triggered by the `globalMutate((k) => k.startsWith("/api/workouts/"), undefined)` call already in the success block) refetch them.

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`. Steps:
1. Open a workout drawer → click Edit → change notes → Save.
2. Drawer returns to "view" mode with the new notes immediately visible (no skeleton flash).
3. Throttle to Slow 3G and repeat. View mode should show the edit immediately; behind the scenes the refetch corrects any nested differences.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/components/workout/hooks/useWorkoutForm.ts
git commit -m "feat(workout): optimistic SWR patch for detail drawer on edit"
```

---

## Task 7: Wire optimistic draft save

**Files:**
- Modify: `src/components/workout/hooks/useWorkoutForm.ts`

- [ ] **Step 1: Refactor `handleSaveAsDraft` to emit an optimistic insert**

Replace the function body (currently at `src/components/workout/hooks/useWorkoutForm.ts:186-230`) with:

```ts
  async function handleSaveAsDraft() {
    if (exercises.length === 0) {
      setError("Add at least one exercise");
      return;
    }
    if (exercises.length > 50) {
      setError("Too many exercises (max 50)");
      return;
    }
    setError("");
    setSavingDraft(true);

    const tempId = `optimistic-${crypto.randomUUID()}`;
    const totalSets = exercises
      .flatMap((ex) => ex.sets.filter((s) => s.reps && s.weight))
      .length;
    const optimisticDraft: Workout = {
      id: tempId,
      date: new Date(date).toISOString(),
      dateFormatted: new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(date)),
      durationMinutes: duration ? Number(duration) : null,
      notes: notes || null,
      exerciseNames: exercises.map((ex) => ex.exercise_name),
      totalSets,
      isDraft: true,
    };

    const emit = useWorkoutStore.getState().emitLocalMutation;
    emit({ type: "insert", workout: optimisticDraft });

    try {
      const body = {
        date,
        notes: notes || null,
        duration_minutes: duration || null,
        body_weight: bodyWeight ? parseFloat(bodyWeight) : null,
        is_draft: true,
        exercises: exercises.map((ex, i) => ({
          exercise_id: ex.exercise_id,
          order: i,
          sets: ex.sets
            .filter((s) => s.reps && s.weight)
            .map((s) => ({
              set_number: s.set_number,
              reps: s.reps,
              weight: s.weight,
            })),
        })),
      };
      const res = await fetchWithAuth("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const { id } = await res.json();

      if (id !== tempId) {
        emit({ type: "remove", id: tempId });
        emit({ type: "insert", workout: { ...optimisticDraft, id } });
      }

      toast.success("Draft saved");
      if (onDraftSave) onDraftSave();
      // router.refresh() removed — the event bus keeps the list in sync.
    } catch {
      emit({ type: "remove", id: tempId });
      toast.error("Failed to save draft");
      setError("Failed to save draft. Please try again.");
      setSavingDraft(false);
    }
  }
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`. Steps:
1. Click "Log Workout" → add exercise → click "Save as Draft".
2. Drawer closes, draft card appears at top of list with "Draft" badge — immediately.
3. On Slow 3G, confirm the draft badge appears before the server response lands.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/components/workout/hooks/useWorkoutForm.ts
git commit -m "feat(workout): optimistic draft save"
```

---

## Task 8: Wire optimistic draft publish

**Files:**
- Modify: `src/components/workout/hooks/usePublishDraft.ts`

- [ ] **Step 1: Refactor `handlePublish` to emit an optimistic edit**

Replace the hook body at `src/components/workout/hooks/usePublishDraft.ts:8-44` with:

```tsx
"use client";

import { useState } from "react";
import { mutate as globalMutate } from "swr";
import { toast } from "sonner";
import { fetchWithAuth } from "@/lib/fetch";
import { useWorkoutStore } from "@/store/workoutStore";
import type { WorkoutDetail } from "@/types/workout";

export function usePublishDraft(workoutId: string | undefined, onSuccess: () => void) {
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  async function handlePublish() {
    if (!workoutId) return;
    setPublishing(true);
    setPublishError(null);

    const emit = useWorkoutStore.getState().emitLocalMutation;

    // Optimistic: flip isDraft on the dashboard card.
    emit({ type: "edit", id: workoutId, patch: { isDraft: false } });

    // Optimistic: patch the detail cache so the drawer reflects the publish.
    globalMutate(
      `/api/workouts/${workoutId}`,
      (prev: WorkoutDetail | undefined) => prev ? { ...prev, is_draft: false } : prev,
      { revalidate: false },
    );

    try {
      const res = await fetchWithAuth(`/api/workouts/${workoutId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_draft: false }),
      });
      if (!res.ok) throw new Error();

      toast.success("Workout saved");

      globalMutate(
        (k) => typeof k === "string" && k.startsWith("/api/workouts/"),
        undefined,
        { revalidate: true },
      );
      globalMutate("/api/recovery");
      globalMutate("/api/progress");
      onSuccess();
    } catch {
      // Rollback
      emit({ type: "edit", id: workoutId, patch: { isDraft: true } });
      globalMutate(
        `/api/workouts/${workoutId}`,
        (prev: WorkoutDetail | undefined) => prev ? { ...prev, is_draft: true } : prev,
        { revalidate: false },
      );
      toast.error("Failed to save workout");
      setPublishError("Failed to save workout");
    } finally {
      setPublishing(false);
    }
  }

  return { publishing, publishError, handlePublish };
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`. Steps:
1. Save a workout as draft (from Task 7).
2. Open the draft → click "Save Workout" (publish).
3. The "Draft" badge on the dashboard card should disappear immediately; drawer view updates instantly.
4. On Slow 3G, confirm the badge flip happens before the server response.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/components/workout/hooks/usePublishDraft.ts
git commit -m "feat(workout): optimistic draft publish"
```

---

## Task 9: Wire optimistic profile save

**Files:**
- Modify: `src/components/settings/hooks/useProfileSave.ts`

- [ ] **Step 1: Replace `handleSaveProfile` to use `optimisticMutate`**

Replace the hook body at `src/components/settings/hooks/useProfileSave.ts:9-55` with:

```ts
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { fetchWithAuth } from "@/lib/fetch";
import { optimisticMutate } from "@/lib/optimistic";
import type { UserProfile } from "@/types/user";

export function useProfileSave(
  user: UserProfile,
  onClose: () => void,
) {
  const router = useRouter();
  const [name, setName] = useState(user.name ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync name from user prop
    setName(user.name ?? "");
  }, [user]);

  const isAccountDirty = name !== (user.name ?? "");

  async function handleSaveProfile() {
    setSaving(true);
    const trimmedName = name.trim() || null;
    const supabase = createClient();

    const optimisticProfile: UserProfile = { ...user, name: trimmedName };

    try {
      await Promise.all([
        optimisticMutate<UserProfile, UserProfile>({
          key: "/api/user/profile",
          optimisticData: optimisticProfile,
          request: async () => {
            const res = await fetchWithAuth("/api/user/profile", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: trimmedName,
                height_inches: user.height_inches,
                weight_lbs: user.weight_lbs,
                fitness_goals: user.fitness_goals ?? [],
              }),
            });
            if (!res.ok) throw new Error();
            return res.json();
          },
        }),
        supabase.auth.updateUser({ data: { full_name: trimmedName } }),
      ]);

      toast.success("Profile updated");
      onClose();
      // router.refresh() kept — navbar server component reads user.name
      router.refresh();
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  return { name, setName, saving, isAccountDirty, handleSaveProfile };
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run existing tests**

Run: `npm run test:run -- src/components/settings`
Expected: pass. Existing tests may assert specific globalMutate calls — update to reflect the new flow using `optimisticMutate`.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`. Settings → edit name → Save. Name reflected in the drawer and navbar immediately. On Slow 3G, no lag between click and visual update.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/hooks/useProfileSave.ts
git commit -m "feat(settings): optimistic profile save via optimisticMutate"
```

---

## Task 10: Optimistic custom exercise creation

**Files:**
- Modify: `src/components/workout/hooks/useWorkoutForm.ts`

The `createCustomExercise` function at `src/components/workout/hooks/useWorkoutForm.ts:53-78` POSTs to `/api/exercises` and then calls `clearCache()` to invalidate the exercise-search SWR keys. Users experience a small hitch while the search dropdown refetches. Wrapping this in `optimisticMutate` lets us append the new exercise to the cached search list immediately.

- [ ] **Step 1: Grep for the exercise search SWR key shape**

Run: `rg -n "useSWR.*\"/api/exercises" src/`
Expected: matches in `src/components/workout/hooks/useExerciseSearch.ts` (or similar). Identify the key shape — if it's `` `/api/exercises?q=${query}` ``, then the "no-filter" cache key is `/api/exercises?q=`.

- [ ] **Step 2: Refactor `createCustomExercise`**

Replace the function body at `:53-78` with:

```ts
  async function createCustomExercise(name: string, muscles: string, equipment: string) {
    setCustomLoading(true);
    try {
      const muscle_groups = muscles
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);

      const created = await optimisticMutate<Exercise[], Exercise>({
        // Match every cached exercise-search key so the optimistic row appears in all
        // active dropdowns immediately. clearCache() below triggers a refetch afterward,
        // which will replace this optimistic value with the canonical server list.
        key: (k) => typeof k === "string" && k.startsWith("/api/exercises"),
        optimisticData: (prev: Exercise[] | undefined) => {
          const optimistic: Exercise = {
            id: `optimistic-${crypto.randomUUID()}`,
            name: name.trim(),
            muscle_groups,
            equipment: equipment.trim() || null,
            is_custom: true,
          };
          return prev ? [optimistic, ...prev] : [optimistic];
        },
        request: async () => {
          const res = await fetchWithAuth("/api/exercises", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: name.trim(),
              muscle_groups,
              equipment: equipment.trim() || null,
            }),
          });
          if (!res.ok) throw new Error();
          return res.json();
        },
      });
      handleAddExercise(created);
      clearCache(); // refetches exercise search keys; replaces optimistic row with real server list
    } catch {
      toast.error("Failed to create exercise");
      setError("Failed to create custom exercise");
    } finally {
      setCustomLoading(false);
    }
  }
```

We deliberately omit `reconcile` — after the request resolves, SWR briefly writes the raw response into every matched cache key (because `populateCache: true` with no reconcile casts the single `Exercise` to the array shape, which is wrong). To avoid that type mismatch, we rely on `clearCache()` to immediately trigger a refetch, which overwrites whatever SWR put in place. In practice the reader sees `[optimistic, ...prev]` → (brief flash of wrong shape, invisible because clearCache fires synchronously) → fresh server list with the real row.

If the flash becomes user-visible on slower connections, the cleaner fix is extending `optimisticMutate` with a two-arg `reconcile(response, prev)` signature — defer until measured.

- [ ] **Step 3: Add imports**

At the top of `src/components/workout/hooks/useWorkoutForm.ts`:

```ts
import { optimisticMutate } from "@/lib/optimistic";
```

`Exercise` is already imported at line 8.

- [ ] **Step 4: Run tests and type check**

Run: `npm run test:run -- src/lib/__tests__/optimistic.test.ts`
Expected: pass (unchanged — Task 10 does not modify the helper).

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`. Steps:
1. On the workout form, search for an exercise that doesn't exist (e.g. "Sled Pushes").
2. Click "Create custom exercise". Fill in muscle groups / equipment. Submit.
3. The exercise should appear in the search dropdown immediately.
4. On Slow 3G, confirm the row appears before the server response.

Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add src/components/workout/hooks/useWorkoutForm.ts
git commit -m "feat(exercises): optimistic custom exercise creation"
```

---

## Task 11: Remove the now-redundant `router.refresh()` in `useWorkoutForm`

**Files:**
- Modify: `src/components/workout/hooks/useWorkoutForm.ts`

Tasks 5, 6, and 7 already removed the explicit `router.refresh()` from their modified functions. This task is a final audit.

- [ ] **Step 1: Grep for remaining refreshes**

Run: `rg -n "router\.refresh" src/components/workout/`
Expected: one match remaining in `useWorkoutForm.ts` — inside the `catch` branch of `handleSubmit` for edit rollback. That one is intentional (we don't have the pre-edit summary to restore locally) and stays.

If there are more matches than expected, review each and remove if the optimistic emit + globalMutate already covers the UI update. Be conservative: when in doubt, keep the refresh.

- [ ] **Step 2: Commit (only if changes were needed)**

If no changes were made, skip this commit.

```bash
git add src/components/workout/hooks/useWorkoutForm.ts
git commit -m "refactor(workout): remove redundant router.refresh after optimistic updates"
```

---

## Task 12: Full verification

**Files:** none

- [ ] **Step 1: Run full test suite**

Run: `npm run test:run`
Expected: 287+ existing tests plus the new tests from Tasks 1 (4) and 2 (4) pass. Any workout/settings tests that needed updates should now be green.

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: clean. If any `react-hooks/exhaustive-deps` warnings appeared on the seq-guard effect in Task 3, they need a justification comment.

- [ ] **Step 4: Run E2E suite**

Run: `npm run test:e2e`
Expected: all Playwright tests pass. These verify create/edit/delete end-to-end; they don't assert on timing, so optimistic behavior is compatible.

- [ ] **Step 5: Manual Slow-3G smoke**

Run: `npm run dev`, throttle to Slow 3G in DevTools, exercise each flow:

| Flow | Expected behavior |
|---|---|
| Create workout | Card appears at top of list before server confirms |
| Edit workout | Card summary + drawer view update immediately |
| Delete workout | Card fades out immediately, drawer closes |
| Save as draft | Draft card appears with badge, drawer closes |
| Publish draft | Badge disappears, drawer view updates |
| Edit profile | Navbar + settings reflect change immediately |
| Any mutation with server error (kill the server mid-request) | Change rolls back, error toast shows |

Stop the dev server.

- [ ] **Step 6: Commit nothing — this task only verifies**

No commit needed.
