export type RecoveryStatus = "recovered" | "partial" | "fatigued";

export function getRecoveryStatus(pct: number): RecoveryStatus {
  if (pct >= 0.85) return "recovered";
  if (pct >= 0.45) return "partial";
  return "fatigued";
}

/**
 * Interpolates a fill color for SVG muscle regions.
 * 0.0 (fatigued) → warm red
 * 0.5 (partial)  → golden yellow
 * 1.0 (recovered)→ muted green
 *
 * Uses HSL interpolation across two segments for a smooth gradient.
 */
export function getRecoveryFill(pct: number, isDark: boolean): string {
  // Anchors: [hue, saturation, lightness]
  // Light mode: higher lightness + lower saturation → muted earthy tones on warm off-white
  const red = isDark ? [3, 62, 55] : [5, 48, 60];
  const yellow = isDark ? [43, 70, 52] : [40, 55, 58];
  const green = isDark ? [152, 38, 44] : [150, 35, 50];

  let h: number, s: number, l: number;

  if (pct <= 0.5) {
    // Red → yellow
    const t = pct / 0.5;
    h = red[0] + (yellow[0] - red[0]) * t;
    s = red[1] + (yellow[1] - red[1]) * t;
    l = red[2] + (yellow[2] - red[2]) * t;
  } else {
    // Yellow → green
    const t = (pct - 0.5) / 0.5;
    h = yellow[0] + (green[0] - yellow[0]) * t;
    s = yellow[1] + (green[1] - yellow[1]) * t;
    l = yellow[2] + (green[2] - yellow[2]) * t;
  }

  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

/** Neutral fill for untrained / no-data muscles */
export function getNeutralFill(isDark: boolean): string {
  return isDark ? "hsl(50, 4%, 22%)" : "hsl(50, 8%, 82%)";
}

export const STATUS_LABELS: Record<RecoveryStatus, string> = {
  recovered: "Recovered",
  partial: "Recovering",
  fatigued: "Fatigued",
};

export const STATUS_COLORS: Record<RecoveryStatus, string> = {
  recovered: "text-success bg-success/10",
  partial: "text-recovery-yellow bg-recovery-yellow/10",
  fatigued: "text-danger bg-danger/10",
};
