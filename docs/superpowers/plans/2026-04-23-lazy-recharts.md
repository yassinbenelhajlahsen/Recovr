# Lazy-Load Recharts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Defer Recharts (~200KB+ gzipped) out of the shared client JS bundle so it only loads on `/progress` (the one route that uses it).

**Architecture:** Hoist `LineConfig` into `src/types/progress.ts` (named exports don't hoist through `next/dynamic`). Extract the existing chart-skeleton JSX in `ProgressClient.tsx` into a reusable `ProgressChartSkeleton` component. Replace the static `ProgressChart` import with `next/dynamic({ ssr: false, loading: () => <ProgressChartSkeleton /> })`.

**Tech Stack:** Next.js 16 (App Router), React 19, Recharts 3.8, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-04-23-perf-pass-design.md` (W3 section)

---

## Pre-Flight Verification

Confirmed:
- Only `src/components/progress/ProgressChart.tsx:11` imports from `recharts`.
- `ProgressChart` is consumed only by `src/components/progress/ProgressClient.tsx:8` (rendered twice: `:111` and `:122`).
- `LineConfig` is exported from `ProgressChart.tsx:13-17`.
- `ProgressClient` already has a skeleton block at `ProgressClient.tsx:53-70` used during SWR load; we'll reuse that shape.
- No existing `next/dynamic` or `React.lazy` usage in `src/` — this change sets the first pattern.

No other consumers of `LineConfig` exist outside `ProgressChart.tsx` / `ProgressClient.tsx` (`getChartLines` return type in `ProgressClient.tsx:14-25` uses the type implicitly). Verify with grep in Task 1 before moving.

---

## Task 1: Hoist `LineConfig` into shared types

**Files:**
- Modify: `src/types/progress.ts`
- Modify: `src/components/progress/ProgressChart.tsx`

- [ ] **Step 1: Grep for `LineConfig` consumers**

Run: `rg -n "LineConfig" src/`
Expected: matches only in `src/components/progress/ProgressChart.tsx` (the type definition) and potentially in `ProgressClient.tsx` (the `getChartLines` helper return type). No other files.

If other consumers are found, add them to the "files to update" list in Step 3.

- [ ] **Step 2: Add `LineConfig` to `src/types/progress.ts`**

Append this block to the end of `src/types/progress.ts` (after the existing `ProgressClientProps` type):

```ts
export type LineConfig = {
  dataKey: string;
  color: string;
  label: string;
};
```

- [ ] **Step 3: Update `ProgressChart.tsx` to re-export from the types module**

Replace the existing type export at `src/components/progress/ProgressChart.tsx:13-17`:

```ts
export type LineConfig = {
  dataKey: string;
  color: string;
  label: string;
};
```

with:

```ts
import type { LineConfig } from "@/types/progress";
export type { LineConfig };
```

The re-export keeps existing consumers importing `from "./ProgressChart"` working until the dynamic import lands in Task 3, at which point named exports stop flowing through.

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/types/progress.ts src/components/progress/ProgressChart.tsx
git commit -m "refactor: hoist LineConfig to src/types/progress.ts"
```

---

## Task 2: Extract `ProgressChartSkeleton` component

**Files:**
- Modify: `src/components/progress/ProgressClient.tsx`

- [ ] **Step 1: Add `ProgressChartSkeleton` to `ProgressClient.tsx`**

Insert this function definition immediately below the existing `getChartLabel` helper at `src/components/progress/ProgressClient.tsx:27-31`:

```tsx
function ProgressChartSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="space-y-3">
        <div className="skeleton h-10 w-full rounded-lg" />
        <div className="skeleton h-72 w-full rounded-xl" />
      </div>
      <div className="skeleton h-[340px] w-full rounded-xl" />
    </div>
  );
}
```

This mirrors the existing grid at lines 61-67 of the full-page loading state.

- [ ] **Step 2: Replace the inline grid inside the `isLoading` branch**

In `ProgressClient.tsx:53-70`, the loading block currently inlines the grid. Replace the inner JSX so the loading branch delegates to the new skeleton:

Current (`:53-70`):
```tsx
  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton flex-1 h-10 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="skeleton h-10 w-full rounded-lg" />
            <div className="skeleton h-72 w-full rounded-xl" />
          </div>
          <div className="skeleton h-[340px] w-full rounded-xl" />
        </div>
      </div>
    );
  }
```

New:
```tsx
  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton flex-1 h-10 rounded-full" />
          ))}
        </div>
        <ProgressChartSkeleton />
      </div>
    );
  }
```

- [ ] **Step 3: Run existing progress tests**

Run: `npm run test:run -- src/components/progress`
Expected: existing tests still pass. The render output for the loading state is unchanged (same skeleton DOM, wrapped differently).

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/progress/ProgressClient.tsx
git commit -m "refactor: extract ProgressChartSkeleton component for reuse"
```

---

## Task 3: Switch `ProgressChart` to dynamic import

**Files:**
- Modify: `src/components/progress/ProgressClient.tsx`

- [ ] **Step 1: Replace the static import with `next/dynamic`**

At the top of `src/components/progress/ProgressClient.tsx`, replace the static import on line 8:

```tsx
import { ProgressChart } from "./ProgressChart";
```

with:

```tsx
import dynamic from "next/dynamic";

const ProgressChart = dynamic(
  () => import("./ProgressChart").then((m) => m.ProgressChart),
  {
    ssr: false,
    loading: () => <ProgressChartSkeleton />,
  },
);
```

Notes:
- `next/dynamic` imports must return a component; `.then((m) => m.ProgressChart)` picks the named export.
- `ssr: false` skips server rendering — `ProgressClient` is already a client component, and Recharts relies on the DOM.
- `loading` is the fallback shown while the chunk is being fetched. `ProgressChartSkeleton` (from Task 2) matches the chart footprint.
- `ProgressChartSkeleton` is defined lower in the same file. Function declarations are hoisted, so forward reference works — do not move the skeleton above the dynamic call.

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run existing progress tests**

Run: `npm run test:run -- src/components/progress`
Expected: pass. Any test that imports `ProgressChart` directly (`from "./ProgressChart"`) is unaffected — only `ProgressClient` goes through `next/dynamic`.

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: no new warnings.

- [ ] **Step 5: Commit**

```bash
git add src/components/progress/ProgressClient.tsx
git commit -m "perf: lazy-load ProgressChart with next/dynamic"
```

---

## Task 4: Verify bundle impact

**Files:** none (verification only)

- [ ] **Step 1: Snapshot the current shared bundle**

Run: `npx next build 2>&1 | tee /tmp/next-build-before.txt`

Then:
```bash
ls -la .next/static/chunks/ | head -40 > /tmp/chunks-before.txt
```

Record the size of the largest shared chunk (it's the one containing `recharts` today). Typical Next output shows shared chunk sizes under "First Load JS shared by all".

- [ ] **Step 2: Confirm the dynamic-import change is present**

Run: `git log --oneline -3`
Expected: the most recent commit is `perf: lazy-load ProgressChart with next/dynamic`.

- [ ] **Step 3: Diff bundle output**

The build output from Step 1 is the **after** state (the lazy-load change is already committed). Inspect:

```bash
grep -A2 "First Load JS" /tmp/next-build-before.txt
```

Expected: the "shared by all" chunk size decreased compared to a pre-change build. If you want a true before/after, check out the parent commit, rebuild, and compare — but the qualitative signal (a new small chunk for `/progress` that wasn't there before) is usually enough.

Also:
```bash
grep -r "recharts" .next/build-manifest.json | head
```

Expected: `recharts` and its dependents appear under `/progress`-scoped entries, not in the `pages` or `rootMainFiles` entries.

- [ ] **Step 4: Manual DevTools check**

Run: `npm run dev`

Steps:
1. Open http://localhost:3000/dashboard in a browser with DevTools Network tab open.
2. Filter Network to "JS".
3. Hard-reload. Confirm no chunk with `recharts` in its name or content is loaded.
4. Navigate to `/progress`. Confirm a new JS chunk loads; briefly the `ProgressChartSkeleton` should show; then the charts render.
5. Navigate back to `/dashboard`. The progress chunk should remain cached and not reload.

Stop the dev server before committing anything else.

- [ ] **Step 5: No code changes expected — nothing to commit**

If Step 4 passed, Task 4 is complete. If the chart fails to render or the skeleton flashes for several seconds, check:
- `ssr: false` is set (required — Recharts touches `document`).
- The dynamic-import `.then((m) => m.ProgressChart)` matches the named export.
- `ProgressChartSkeleton` is imported/defined in scope of the dynamic call.

---

## Task 5: Full verification

**Files:** none

- [ ] **Step 1: Run full test suite**

Run: `npm run test:run`
Expected: 287+ existing tests pass. No new tests were added in this plan.

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 4: Run E2E smoke**

Run: `npm run test:e2e`
Expected: all Playwright tests pass. Especially check any test that navigates to `/progress` — the dynamic chunk should not cause a regression.

If an E2E test times out waiting for the chart, bump its wait-for selector to tolerate the skeleton appearing first (rare — skeleton → chart typically completes in under 200ms on local). If no regression, this step is complete.
