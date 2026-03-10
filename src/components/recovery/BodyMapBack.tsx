"use client";

import Body, { type Slug } from "@mjcdev/react-body-highlighter";
import { getRecoveryFill, getNeutralFill } from "./recoveryColors";
import { useEffect, useState } from "react";

type BodyMapProps = {
  muscles: Record<string, { recoveryPct: number } | undefined>;
  selectedMuscle: string | null;
  onSelectMuscle: (muscle: string) => void;
};

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
  const sizeCss = `#${containerId} svg { width: 100% !important; height: auto !important; }`;
  return `${sizeCss}\n${muscleCss}`;
}

function useDarkMode() {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

const BACK_DATA = BACK_MUSCLE_MAP.map(({ slug }) => ({ slug, intensity: 1 }));

export function BodyMapBack({ muscles, onSelectMuscle }: BodyMapProps) {
  const isDark = useDarkMode();
  const containerId = "bm-back";
  const css = buildCss(BACK_MUSCLE_MAP, muscles, isDark, containerId);

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
