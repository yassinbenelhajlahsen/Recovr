import { useState, useEffect } from "react";
import useSWR, { preload } from "swr";
import type { MuscleRecovery } from "@/types/recovery";
import type { ProgressClientProps } from "@/types/progress";
import { swrFetcher } from "./fetch";

/**
 * Shared SWR hook for recovery data. Key "/api/recovery" is shared across all
 * pages — navigating between dashboard and /recovery never refetches if the
 * cache is still fresh. Pass `fallbackData` from the server component so the
 * first render is instant (no loading state).
 */
export function useRecovery(fallbackData?: MuscleRecovery[]) {
  return useSWR<MuscleRecovery[]>("/api/recovery", { fallbackData, dedupingInterval: 30_000 });
}

/**
 * Shared SWR hook for progress data. Key "/api/progress" is shared across all
 * pages — navigating away and back uses the SWR cache.
 */
export function useProgress() {
  return useSWR<ProgressClientProps>("/api/progress", { dedupingInterval: 30_000 });
}

/**
 * Returns a debounced copy of `value` that only updates after `delay` ms of
 * inactivity. Used to throttle SWR keys for search inputs.
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/**
 * Returns props to spread onto an element so that hovering it preloads the
 * given SWR key into the cache. When the destination component mounts and
 * calls useSWR(key), it finds the data already cached and skips the skeleton.
 *
 * Pass `null` to disable (e.g. when the key depends on state that isn't
 * ready). This is a plain function, not a hook, so it is safe to call
 * inside `.map()` callbacks.
 *
 * NOTE: `swrFetcher` here must match the global fetcher in Providers.tsx —
 * if they diverge, preload and useSWR will populate/read different cache
 * entries under the same key and silently disagree on shape.
 */
export function prefetchOnHover(key: string | null) {
  return {
    onMouseEnter: key ? () => preload(key, swrFetcher) : undefined,
  };
}
