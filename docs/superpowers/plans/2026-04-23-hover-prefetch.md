# Hover Prefetch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SWR data prefetching on hover for workout cards and nav links so destination pages/drawers render with data instead of skeletons.

**Architecture:** Extract the global SWR fetcher to a shared module, expose a small `prefetchOnHover(key)` helper that returns an `onMouseEnter` handler calling SWR's `preload`, and wire it to workout cards and the Recovery/Progress nav links. Existing loading states remain untouched — the change only shifts when the API call starts.

**Tech Stack:** Next.js 16, React 19, SWR v2+, TypeScript, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-04-23-hover-prefetch-design.md`

---

## Pre-Flight Verification

Both `useRecovery()` and `useProgress()` are confirmed to be called client-side on their respective pages:
- `src/components/recovery/RecoveryView.tsx:16` calls `useRecovery()`
- `src/components/progress/ProgressClient.tsx:34` calls `useProgress()`

Preloading `/api/recovery` and `/api/progress` will therefore warm caches that are actually read on cold navigation. Proceed with all three nav link callsites.

---

## Task 1: Extract `swrFetcher` to `src/lib/fetch.ts`

**Files:**
- Modify: `src/lib/fetch.ts`
- Modify: `src/components/layout/Providers.tsx`

- [ ] **Step 1: Add `swrFetcher` export to `src/lib/fetch.ts`**

Append to `src/lib/fetch.ts` (below the existing `fetchWithAuth` function):

```ts
/**
 * Shared SWR fetcher. Used by the global SWRConfig and by `preload()` callers
 * (e.g. hover prefetching) so that preloaded data lands in the same cache
 * that useSWR reads from.
 */
export async function swrFetcher<T>(url: string): Promise<T> {
  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error(`Fetch error: ${res.status}`);
  return res.json();
}
```

The implementation must match the inline fetcher currently at `src/components/layout/Providers.tsx:8-12` exactly — same error message, same return shape.

- [ ] **Step 2: Update `Providers.tsx` to import the shared fetcher**

Replace the inline fetcher at `src/components/layout/Providers.tsx:8-12` with an import.

Full file after changes:

```tsx
"use client";

import { SWRConfig } from "swr";
import { Toaster } from "sonner";
import { ThemeProvider, useTheme } from "./ThemeProvider";
import { swrFetcher } from "@/lib/fetch";

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} position="bottom-center" richColors duration={1500}/>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: swrFetcher,
        revalidateOnFocus: false,
        dedupingInterval: 5000,
        errorRetryCount: 2,
      }}
    >
      <ThemeProvider>
        {children}
        <ThemedToaster />
      </ThemeProvider>
    </SWRConfig>
  );
}
```

Note: the previous `fetchWithAuth` import is dropped because the fetcher now lives in `fetch.ts`.

- [ ] **Step 3: Run type check and tests to confirm nothing regressed**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run test:run -- src/lib src/components/layout`
Expected: all existing tests pass. If there are no tests matching the patterns, vitest exits with a "No test files found" warning — that is acceptable for this step; the critical check is that no existing tests break.

- [ ] **Step 4: Commit**

```bash
git add src/lib/fetch.ts src/components/layout/Providers.tsx
git commit -m "refactor: extract swrFetcher into src/lib/fetch.ts for reuse"
```

---

## Task 2: Add `prefetchOnHover` helper with tests

**Files:**
- Create: `src/lib/__tests__/hooks.test.ts`
- Modify: `src/lib/hooks.ts`

- [ ] **Step 1: Write failing tests for `prefetchOnHover`**

Create `src/lib/__tests__/hooks.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { preload } from "swr";
import { prefetchOnHover } from "@/lib/hooks";
import { swrFetcher } from "@/lib/fetch";

vi.mock("swr", async () => {
  const actual = await vi.importActual<typeof import("swr")>("swr");
  return {
    ...actual,
    preload: vi.fn(),
  };
});

describe("prefetchOnHover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns onMouseEnter that calls preload with the key and swrFetcher", () => {
    const props = prefetchOnHover("/api/recovery");
    expect(props.onMouseEnter).toBeTypeOf("function");

    props.onMouseEnter!();

    expect(preload).toHaveBeenCalledTimes(1);
    expect(preload).toHaveBeenCalledWith("/api/recovery", swrFetcher);
  });

  it("returns undefined onMouseEnter when key is null", () => {
    const props = prefetchOnHover(null);
    expect(props.onMouseEnter).toBeUndefined();
    expect(preload).not.toHaveBeenCalled();
  });

  it("does not call preload until onMouseEnter fires", () => {
    prefetchOnHover("/api/workouts/abc");
    expect(preload).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/lib/__tests__/hooks.test.ts`
Expected: FAIL — `prefetchOnHover is not exported from "@/lib/hooks"` (or similar import error).

- [ ] **Step 3: Add `prefetchOnHover` to `src/lib/hooks.ts`**

Append to `src/lib/hooks.ts` (below `useDebouncedValue`):

```ts
import { preload } from "swr";
import { swrFetcher } from "./fetch";

/**
 * Returns props to spread onto an element so that hovering it preloads the
 * given SWR key into the cache. When the destination component mounts and
 * calls useSWR(key), it finds the data already cached and skips the skeleton.
 *
 * Pass `null` to disable (e.g. when the key depends on state that isn't
 * ready). This is a plain function, not a hook, so it is safe to call
 * inside `.map()` callbacks.
 */
export function prefetchOnHover(key: string | null) {
  return {
    onMouseEnter: key ? () => preload(key, swrFetcher) : undefined,
  };
}
```

Make sure the existing `useSWR` import at the top of the file is preserved — only add the new imports.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/lib/__tests__/hooks.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/hooks.ts src/lib/__tests__/hooks.test.ts
git commit -m "feat: add prefetchOnHover helper for SWR data prefetching"
```

---

## Task 3: Wire hover prefetch to workout cards

**Files:**
- Modify: `src/components/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Add import for `prefetchOnHover`**

At `src/components/dashboard/DashboardClient.tsx:10` (after the existing `type` import), add:

```tsx
import { prefetchOnHover } from "@/lib/hooks";
```

- [ ] **Step 2: Spread `prefetchOnHover` onto the workout card button**

Find the workout card `<button>` at `src/components/dashboard/DashboardClient.tsx:132`. Current code:

```tsx
<button
  onClick={() => openDrawer(w.id, w)}
  className="group w-full text-left block rounded-xl bg-surface border border-border-subtle px-6 py-5 hover:bg-elevated hover:shadow-md transition-all"
>
```

Change to:

```tsx
<button
  {...prefetchOnHover(`/api/workouts/${w.id}`)}
  onClick={() => openDrawer(w.id, w)}
  className="group w-full text-left block rounded-xl bg-surface border border-border-subtle px-6 py-5 hover:bg-elevated hover:shadow-md transition-all"
>
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run existing dashboard tests**

Run: `npm run test:run -- src/components/dashboard`
Expected: all existing tests pass. No new tests required — the card behavior (click → open drawer) is unchanged.

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`

Steps:
1. Open http://localhost:3000/dashboard in a browser with the Network tab open
2. Filter Network to "Fetch/XHR"
3. Hover over a workout card
4. Confirm a `GET /api/workouts/<id>` request appears immediately on hover
5. Click the card — the drawer should open with data (no skeleton flash if the request resolved in time)

Expected: the GET fires on hover, not on click. Stop the dev server before committing.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/DashboardClient.tsx
git commit -m "feat: prefetch workout detail on card hover"
```

---

## Task 4: Wire hover prefetch to Recovery and Progress nav links

**Files:**
- Modify: `src/components/layout/Navbar.tsx`

- [ ] **Step 1: Add imports**

At the top of `src/components/layout/Navbar.tsx` (alongside existing imports), add:

```tsx
import { preload } from "swr";
import { swrFetcher } from "@/lib/fetch";
```

Keep all other imports intact.

- [ ] **Step 2: Add `onMouseEnter` to the Progress nav link**

Find the Progress `<Link>` at `src/components/layout/Navbar.tsx:75-84`. Current code:

```tsx
<Link
  href="/progress"
  className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
    pathname === "/progress"
      ? "text-accent"
      : "text-muted hover:text-primary hover:bg-surface"
  }`}
>
  Progress
</Link>
```

Change to:

```tsx
<Link
  href="/progress"
  onMouseEnter={() => preload("/api/progress", swrFetcher)}
  className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
    pathname === "/progress"
      ? "text-accent"
      : "text-muted hover:text-primary hover:bg-surface"
  }`}
>
  Progress
</Link>
```

- [ ] **Step 3: Add `onMouseEnter` to the Recovery nav link**

Find the Recovery `<Link>` at `src/components/layout/Navbar.tsx:85-94`. Current code:

```tsx
<Link
  href="/recovery"
  className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
    pathname === "/recovery"
      ? "text-accent"
      : "text-muted hover:text-primary hover:bg-surface"
  }`}
>
  Recovery
</Link>
```

Change to:

```tsx
<Link
  href="/recovery"
  onMouseEnter={() => preload("/api/recovery", swrFetcher)}
  className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
    pathname === "/recovery"
      ? "text-accent"
      : "text-muted hover:text-primary hover:bg-surface"
  }`}
>
  Recovery
</Link>
```

The Dashboard nav link is intentionally not changed — dashboard data comes from a server component, not SWR.

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`

Steps:
1. Sign in and open http://localhost:3000/dashboard
2. Open DevTools Network tab, filter Fetch/XHR
3. Hover over "Recovery" in the navbar — confirm `GET /api/recovery` fires
4. Move mouse away, then hover "Progress" — confirm `GET /api/progress` fires
5. Click Recovery — page should render with data (no or very short skeleton)
6. Reload, hover Recovery again within 30 seconds — confirm no new network request (SWR dedupingInterval of 30s on `useRecovery`)

Expected: hover fires the GET; navigation reuses the cache; dedupe prevents duplicate requests within the interval. Stop the dev server before committing.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/Navbar.tsx
git commit -m "feat: prefetch recovery and progress data on nav link hover"
```

---

## Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npm run test:run`
Expected: all 287+ tests pass (existing count + 3 new tests from Task 2).

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: no new warnings or errors in the files changed.

- [ ] **Step 4: Manual network-throttled test (slow connection)**

Run: `npm run dev`

Steps:
1. Open DevTools → Network tab → set throttling to "Slow 3G"
2. Hard-reload the dashboard
3. Hover a workout card and immediately click (before the prefetch could reasonably resolve)
4. Confirm the drawer opens and shows the skeleton/loading state, then renders data when the request resolves
5. Confirm only one `/api/workouts/<id>` request was made (no duplicate from the click path — SWR should dedupe with the in-flight preload)

Expected: skeleton is shown correctly on slow connections; no duplicate requests. Stop the dev server.

This confirms the behavior described in the spec's "Data Flow" section (preload-in-flight dedupes with useSWR on mount).
