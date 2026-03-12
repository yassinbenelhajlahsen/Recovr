"use client";

import Body, { type Slug } from "@mjcdev/react-body-highlighter";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { buildStaticBodyMapCss, buildBodyMapVars } from "./recoveryColors";
import { useClientStore } from "@/store/clientStore";
import type { BodyMapProps } from "@/types/recovery";
import { normalizeGender } from "@/lib/utils";

// Map from our app's muscle names to library slugs (front-visible muscles)
const FRONT_MUSCLE_MAP: Array<{ muscle: string; slug: Slug }> = [
  { muscle: "chest", slug: "chest" },
  { muscle: "shoulders", slug: "deltoids" },
  { muscle: "biceps", slug: "biceps" },
  { muscle: "forearms", slug: "forearm" },
  { muscle: "core", slug: "abs" },
  { muscle: "quadriceps", slug: "quadriceps" },
  { muscle: "hip flexors", slug: "adductors" },
  { muscle: "tibialis", slug: "tibialis" },
];

const SLUG_TO_MUSCLE: Record<string, string> = {
  chest: "chest",
  deltoids: "shoulders",
  biceps: "biceps",
  forearm: "forearms",
  abs: "core",
  quadriceps: "quadriceps",
  adductors: "hip flexors",
  tibialis: "tibialis",
};

// All front-view slugs passed as data so the library activates them
const FRONT_DATA = FRONT_MUSCLE_MAP.map(({ slug }) => ({ slug, intensity: 1 }));

// Wrap library component in React.memo — prevents SVG re-render (and gray fill
// reapplication) when only recovery data changes. Unlike useMemo on JSX, memo is
// a semantic guarantee.
const MemoizedBody = memo(Body);

const CONTAINER_ID = "bm-front";

// Static CSS generated once — uses CSS custom properties so the <style> tag
// content never changes when recovery data updates.
const STATIC_CSS = buildStaticBodyMapCss(FRONT_MUSCLE_MAP, CONTAINER_ID);

export function BodyMapFront({ muscles, onSelectMuscle, gender }: BodyMapProps) {
  const { mounted, isDark, hydrate } = useClientStore();
  useEffect(hydrate, [hydrate]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Set CSS custom properties imperatively via the DOM
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const vars = buildBodyMapVars(FRONT_MUSCLE_MAP, muscles, isDark);
    for (const [key, value] of Object.entries(vars)) {
      el.style.setProperty(key, value);
    }
  }, [mounted, muscles, isDark]);

  const handleClick = useCallback(
    (part: { slug?: string }) => {
      const muscleName = SLUG_TO_MUSCLE[part.slug ?? ""];
      if (muscleName) onSelectMuscle?.(muscleName);
    },
    [onSelectMuscle],
  );

  // Stable props for MemoizedBody — must not create new array/object references
  const colors = useMemo(
    () => [isDark ? "#2E2E2B" : "#D8D6CF"],
    [isDark],
  );
  const border = isDark ? "#1A1A18" : "#C4C2BB";
  const resolvedGender = normalizeGender(gender) ?? "male";

  return (
    <>
      {mounted ? (
        <motion.div
          key="map"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <div ref={containerRef} id={CONTAINER_ID}>
            <style>{STATIC_CSS}</style>
            <MemoizedBody
              data={FRONT_DATA}
              side="front"
              gender={resolvedGender}
              colors={colors}
              border={border}
              onBodyPartClick={handleClick}
            />
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="placeholder"
          style={{ aspectRatio: "160 / 340" }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        />
      )}
    </>
  );
}
