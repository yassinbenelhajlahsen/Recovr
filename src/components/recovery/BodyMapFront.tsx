"use client";

import Body, { type Slug } from "@mjcdev/react-body-highlighter";
import { getRecoveryFill, getNeutralFill } from "./recoveryColors";
import { useEffect } from "react";
import { useClientStore } from "@/store/clientStore";
import type { BodyMapProps } from "@/types/recovery";

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

// CSS specificity: SVG presentation attributes have specificity 0,
// so a plain CSS rule overrides them without !important.
function buildCss(
  entries: Array<{ muscle: string; slug: Slug }>,
  muscles: Record<string, { recoveryPct: number } | undefined>,
  isDark: boolean,
  containerId: string
): string {
  const muscleCss = entries
    .map(({ muscle, slug }) => {
      const data = muscles[muscle];
      const color =
        data != null
          ? getRecoveryFill(data.recoveryPct, isDark)
          : getNeutralFill(isDark);
      return `#${containerId} #${slug} { fill: ${color}; }`;
    })
    .join("\n");
  // Make the SVG fill its container (library hardcodes px dimensions)
  const sizeCss = `#${containerId} svg { width: 100% !important; height: auto !important; }`;
  return `${sizeCss}\n${muscleCss}`;
}

// All front-view slugs passed as data so the library activates them
const FRONT_DATA = FRONT_MUSCLE_MAP.map(({ slug }) => ({ slug, intensity: 1 }));

export function BodyMapFront({ muscles, onSelectMuscle }: BodyMapProps) {
  const { mounted, isDark, hydrate } = useClientStore();
  useEffect(hydrate, [hydrate]);

  const containerId = "bm-front";
  const css = buildCss(FRONT_MUSCLE_MAP, muscles, isDark, containerId);

  if (!mounted) return <div style={{ aspectRatio: "160 / 340" }} />;

  return (
    <div id={containerId}>
      <style>{css}</style>
      <Body
        data={FRONT_DATA}
        side="front"
        gender="male"
        colors={[isDark ? "#2E2E2B" : "#D8D6CF"]}
        border={isDark ? "#1A1A18" : "#C4C2BB"}
        onBodyPartClick={(part) => {
          const muscleName = SLUG_TO_MUSCLE[part.slug ?? ""];
          if (muscleName) onSelectMuscle(muscleName);
        }}
      />
    </div>
  );
}
