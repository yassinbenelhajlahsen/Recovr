"use client";

import Body, { type Slug } from "@mjcdev/react-body-highlighter";
import { buildBodyMapCss } from "./recoveryColors";
import { useEffect } from "react";
import { useClientStore } from "@/store/clientStore";
import type { BodyMapProps } from "@/types/recovery";

// Map from our app's muscle names to library slugs (back-visible muscles)
const BACK_MUSCLE_MAP: Array<{ muscle: string; slug: Slug }> = [
  { muscle: "traps", slug: "trapezius" },
  { muscle: "rear shoulders", slug: "deltoids" },
  { muscle: "back", slug: "upper-back" },
  { muscle: "triceps", slug: "triceps" },
  { muscle: "forearms", slug: "forearm" },
  { muscle: "lower back", slug: "lower-back" },
  { muscle: "glutes", slug: "gluteal" },
  { muscle: "hamstrings", slug: "hamstring" },
  { muscle: "calves", slug: "calves" },
];

const SLUG_TO_MUSCLE: Record<string, string> = {
  trapezius: "traps",
  deltoids: "rear shoulders",
  "upper-back": "back",
  triceps: "triceps",
  forearm: "forearms",
  "lower-back": "lower back",
  gluteal: "glutes",
  hamstring: "hamstrings",
  calves: "calves",
};

const BACK_DATA = BACK_MUSCLE_MAP.map(({ slug }) => ({ slug, intensity: 1 }));

export function BodyMapBack({ muscles, onSelectMuscle }: BodyMapProps) {
  const { mounted, isDark, hydrate } = useClientStore();
  useEffect(hydrate, [hydrate]);

  const containerId = "bm-back";
  const css = buildBodyMapCss(BACK_MUSCLE_MAP, muscles, isDark, containerId);

  if (!mounted) return <div style={{ aspectRatio: "160 / 340" }} />;

  return (
    <div id={containerId}>
      <style>{css}</style>
      <Body
        data={BACK_DATA}
        side="back"
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
