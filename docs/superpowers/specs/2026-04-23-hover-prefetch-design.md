# Hover Prefetch Design

## Summary

Add SWR data prefetching on hover for elements that navigate to pages or open drawers backed by SWR. The goal is to fire the backend API call the moment the user's cursor enters a prefetchable element, so that by the time they click, the data is already in SWR's in-memory cache and the destination renders with data instead of a skeleton.

This is data prefetching, not bundle prefetching. Next.js's built-in `<Link>` prefetching already handles JS bundles; that behavior is untouched.

## Motivation

Today, when a user clicks a workout card on the dashboard or navigates to `/recovery` or `/progress`:
1. The component mounts
2. `useSWR` fires the GET request for that key
3. A skeleton is shown until the response arrives

Hover prefetching shifts step 2 earlier — from "after click" to "on mouse enter" — so the data is often ready by the time the user clicks. Skeletons and loading states are untouched; they still render correctly when the prefetch has not resolved in time (slow connections, keyboard navigation, etc.).

## Pre-Implementation Verification

Before wiring the navbar callsites, confirm the following SWR keys are actually consulted when landing on each page. If a page relies primarily on server-rendered data with no matching `useSWR(key)` hook on the client, prefetching into the SWR cache provides no benefit for first render — the callsite should be dropped or re-pointed.

- `/recovery` — confirm `useRecovery()` (key `/api/recovery`) is called on the client and drives the render
- `/progress` — confirm `useProgress()` (key `/api/progress`) is called on the client and drives the render

If either page renders purely from server props without a matching client-side SWR hook on mount, the navbar prefetch for that page is skipped in this change.

## Scope

In scope:
- Workout cards on the dashboard (prefetch `/api/workouts/{id}`)
- Recovery nav link in the navbar (prefetch `/api/recovery`)
- Progress nav link in the navbar (prefetch `/api/progress`)

Out of scope:
- Dashboard nav link — dashboard workouts come from a server component, not SWR
- Auth buttons (Log in, Sign out, delete flow) — destination pages are forms with no data-heavy SWR hooks
- Any non-GET prefetching

## Architecture

### 1. Export the shared SWR fetcher

`swrFetcher` currently lives inline inside `src/components/layout/Providers.tsx` and is not exported. SWR's `preload(key, fetcher)` function needs the same fetcher reference that the global `SWRConfig` uses, so that preloaded data lands in the cache that `useSWR` reads from.

Move `swrFetcher` to `src/lib/fetch.ts` (which already owns `fetchWithAuth`) and export it. Update `Providers.tsx` to import it.

```ts
// src/lib/fetch.ts (addition)
export async function swrFetcher<T>(url: string): Promise<T> {
  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error(`Fetch error: ${res.status}`);
  return res.json();
}
```

The implementation must match the existing inline fetcher in `Providers.tsx` (error handling included) so behavior does not change for existing SWR hooks.

### 2. `prefetchOnHover` helper

Add to `src/lib/hooks.ts` as a plain function (not a hook — it has no React state or effects). Takes a nullable SWR key and returns props to spread onto an element. If the key is `null`, `onMouseEnter` is `undefined`, matching SWR's own conditional-key convention. Because it is not a hook, it can be called inside `.map()` callbacks without violating the Rules of Hooks lint rule.

```ts
// src/lib/hooks.ts (addition)
import { preload } from "swr";
import { swrFetcher } from "./fetch";

export function prefetchOnHover(key: string | null) {
  return {
    onMouseEnter: key ? () => preload(key, swrFetcher) : undefined,
  };
}
```

The helper is used where the key is dynamic (per-workout). Where the key is a static string, `preload(key, swrFetcher)` can equivalently be called inline.

### 3. Callsites

**Workout cards — `src/components/dashboard/DashboardClient.tsx`**

Inside `localWorkouts.map((w) => ...)`, the card `<button>` element spreads the helper's return value:

```tsx
<button
  {...prefetchOnHover(`/api/workouts/${w.id}`)}
  onClick={() => openDrawer(w.id, w)}
  className="..."
>
```

Calling `prefetchOnHover` inside `.map()` is safe because it is a plain function, not a hook.

**Recovery nav link — `src/components/layout/Navbar.tsx`**

```tsx
<Link
  href="/recovery"
  onMouseEnter={() => preload("/api/recovery", swrFetcher)}
  className="..."
>
  Recovery
</Link>
```

**Progress nav link — `src/components/layout/Navbar.tsx`**

```tsx
<Link
  href="/progress"
  onMouseEnter={() => preload("/api/progress", swrFetcher)}
  className="..."
>
  Progress
</Link>
```

Imports added to `Navbar.tsx`:
```ts
import { preload } from "swr";
import { swrFetcher } from "@/lib/fetch";
```

## Data Flow

1. User's cursor enters a prefetchable element
2. `onMouseEnter` fires → `preload(key, swrFetcher)` runs
3. `preload` calls `swrFetcher(key)` → HTTP GET via `fetchWithAuth` → response JSON
4. SWR stores the response in its cache under `key`
5. User clicks — page navigates or drawer opens
6. Destination component mounts, calls `useSWR(key)` or conditional `useSWR(key)`
7. SWR finds fresh data in cache (within `dedupingInterval`), returns immediately with `isLoading: false`

If the preload is still in flight when the user clicks:
- `useSWR` finds an in-flight request for the same key (SWR v2+ behavior — verify during implementation with a manual network-throttled test)
- It dedupes and awaits the same request (no second network call)
- `isLoading` is `true` until the existing request resolves → skeleton renders as normal

If the user never hovers (keyboard nav, direct URL):
- `preload` never fires
- `useSWR` fetches on mount as today — no change in behavior

## Error Handling

`preload` errors are swallowed by SWR and do not propagate. If the prefetch request fails:
- No toast or UI surface — the prefetch is best-effort
- When the user clicks, `useSWR` retries the request on mount (standard SWR error handling applies to the mounted component)

No additional error handling is required in the hook or callsites.

## Testing

New tests:
- `src/lib/__tests__/hooks.test.ts` — unit test for `prefetchOnHover`:
  - Given a non-null key, `onMouseEnter` is defined and calls `preload` with the key and `swrFetcher`
  - Given a null key, `onMouseEnter` is `undefined`
  - Mock `swr`'s `preload` via `vi.mock("swr", ...)`

Existing tests must continue to pass:
- SWR fetcher behavior is unchanged — any existing tests using real SWR hooks should be unaffected by the fetcher move
- No changes to loading states, skeletons, or visible UI behavior — existing component tests should pass without modification

E2E: no new E2E tests needed. Hover prefetching is a silent optimization; observable behavior (clicking a card opens the drawer with data) is already covered.

## Non-Goals

- Debouncing or delaying the prefetch — SWR's `preload` is idempotent and deduped; extra calls during fast cursor passes are cheap no-ops
- Prefetching on focus — keyboard users are handled by the normal on-mount fetch; adding focus prefetching would expand scope without clear benefit
- Prefetching POST/mutation endpoints — only GETs are prefetchable with SWR's cache model
- Touch/mobile hover equivalents — the app is desktop-only (mobile users redirect to `/mobile` per `src/proxy.ts`)

## Risks

- **SWR cache growth**: preloading populates the cache. With low-traffic hover patterns the cost is negligible. With heavy hover activity (e.g., cursor sweeps across all workouts in a large list) every hovered workout detail gets cached. SWR's default cache has no hard limit but is in-memory and scoped to the session, so growth is bounded by session length.
- **Redundant requests during fast cursor sweeps**: mitigated by SWR's `dedupingInterval`. The workout detail hook uses 10s, recovery uses 30s, progress uses 30s — all sufficient.
- **Fetcher behavior drift**: moving `swrFetcher` from `Providers.tsx` to `src/lib/fetch.ts` must preserve identical behavior, including the current error handling.
