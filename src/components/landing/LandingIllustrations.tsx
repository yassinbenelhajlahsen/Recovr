"use client";

import { useEffect } from "react";
import Model, { type IExerciseData } from "react-body-highlighter";
import { useClientStore } from "@/store/clientStore";

const DEMO_DATA: IExerciseData[] = [
  { name: "Push Session", muscles: ["chest", "biceps", "abs"], frequency: 1 },
  { name: "Accessory", muscles: ["front-deltoids", "quadriceps"], frequency: 1 },
];

export function BodySilhouetteIllustration() {
  const { mounted, isDark, hydrate } = useClientStore();
  useEffect(hydrate, [hydrate]);

  const bodyColor = isDark ? "#252521" : "#CAC5BE";
  const highlightedColors = isDark
    ? ["#E8633A66", "#E8633A"]
    : ["#d9775766", "#d97757"];

  return (
    <div className="relative flex flex-col items-center justify-center py-8 gap-3">
      <div className="accent-glow absolute inset-0 rounded-2xl" />
      {mounted ? (
        <div id="landing-body-model" className="w-36 relative" aria-hidden="true">
          <Model
            data={DEMO_DATA}
            type="anterior"
            bodyColor={bodyColor}
            highlightedColors={highlightedColors}
            style={{ width: "100%", height: "auto" }}
          />
        </div>
      ) : (
        <div className="w-36" style={{ aspectRatio: "160 / 340" }} />
      )}
      {mounted && (
        <p className="text-xs text-muted font-sans tracking-wide select-none">
          hover to explore
        </p>
      )}
    </div>
  );
}

export function ConstellationIllustration() {
  const nodes = [
    { cx: 150, cy: 110, r: 9, opacity: 0.9 }, // central
    { cx: 78, cy: 58, r: 5, opacity: 0.5 },
    { cx: 232, cy: 68, r: 5, opacity: 0.55 },
    { cx: 58, cy: 158, r: 4, opacity: 0.4 },
    { cx: 242, cy: 162, r: 5, opacity: 0.45 },
    { cx: 108, cy: 192, r: 4, opacity: 0.35 },
    { cx: 202, cy: 198, r: 4, opacity: 0.4 },
    { cx: 172, cy: 42, r: 3, opacity: 0.3 },
    { cx: 88, cy: 132, r: 4, opacity: 0.38 },
  ];
  const central = nodes[0];
  const spokes = nodes.slice(1).map((n, i) => ({ ...n, key: i }));
  const crossLines = [
    [1, 2],
    [1, 3],
    [2, 4],
    [5, 6],
    [7, 8],
  ] as [number, number][];

  return (
    <div className="relative flex items-center justify-center py-8">
      <div className="accent-glow absolute inset-0 rounded-2xl" />
      <svg
        viewBox="0 0 300 250"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full max-w-xs h-auto relative"
        aria-hidden="true"
      >
        {spokes.map((n) => (
          <line
            key={n.key}
            x1={central.cx}
            y1={central.cy}
            x2={n.cx}
            y2={n.cy}
            stroke="var(--c-accent)"
            strokeWidth="0.8"
            opacity="0.22"
          />
        ))}
        {crossLines.map(([a, b], i) => (
          <line
            key={i}
            x1={nodes[a].cx}
            y1={nodes[a].cy}
            x2={nodes[b].cx}
            y2={nodes[b].cy}
            stroke="var(--c-accent)"
            strokeWidth="0.6"
            opacity="0.12"
          />
        ))}
        {nodes.map((n, i) => (
          <g key={i}>
            <circle
              cx={n.cx}
              cy={n.cy}
              r={n.r * 2.8}
              style={{ fill: "var(--c-accent)" }}
              opacity={n.opacity * 0.1}
            />
            <circle
              cx={n.cx}
              cy={n.cy}
              r={n.r}
              style={{ fill: "var(--c-accent)" }}
              opacity={n.opacity * 0.7}
            />
          </g>
        ))}
        <circle cx={central.cx} cy={central.cy} r="22" style={{ fill: "var(--c-accent)" }} opacity="0.08" />
        <circle cx={central.cx} cy={central.cy} r="36" style={{ fill: "var(--c-accent)" }} opacity="0.04" />
      </svg>
    </div>
  );
}

export function VoiceInputIllustration() {
  const bars = [
    { h: 18, o: 0.3 }, { h: 34, o: 0.5 }, { h: 52, o: 0.7 }, { h: 72, o: 0.85 },
    { h: 90, o: 1 }, { h: 78, o: 0.9 }, { h: 56, o: 0.7 }, { h: 40, o: 0.55 },
    { h: 62, o: 0.75 }, { h: 84, o: 0.9 }, { h: 68, o: 0.8 }, { h: 44, o: 0.6 },
    { h: 28, o: 0.4 }, { h: 50, o: 0.65 }, { h: 36, o: 0.5 }, { h: 20, o: 0.35 },
  ];
  const barWidth = 8;
  const gap = 10;
  const totalWidth = bars.length * (barWidth + gap) - gap;
  const startX = (300 - totalWidth) / 2;

  return (
    <div className="relative flex items-center justify-center py-8">
      <div className="accent-glow absolute inset-0 rounded-2xl" />
      <svg
        viewBox="0 0 300 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full max-w-xs h-auto relative"
        aria-hidden="true"
      >
        <g transform="translate(134, 24)">
          <rect x="6" y="0" width="20" height="34" rx="10" stroke="var(--c-accent)" strokeWidth="2" fill="none" opacity="0.7" />
          <path d="M4 28 a12 12 0 0 0 24 0" stroke="var(--c-accent)" strokeWidth="2" fill="none" opacity="0.5" strokeLinecap="round" />
          <line x1="16" y1="40" x2="16" y2="48" stroke="var(--c-accent)" strokeWidth="2" opacity="0.5" strokeLinecap="round" />
          <line x1="10" y1="48" x2="22" y2="48" stroke="var(--c-accent)" strokeWidth="2" opacity="0.4" strokeLinecap="round" />
        </g>
        {bars.map((bar, i) => {
          const x = startX + i * (barWidth + gap);
          const y = 140 - bar.h / 2;
          return (
            <rect key={i} x={x} y={y} width={barWidth} height={bar.h} rx={barWidth / 2} style={{ fill: "var(--c-accent)" }} opacity={bar.o * 0.6} />
          );
        })}
        <rect x="60" y="182" width="180" height="26" rx="6" stroke="var(--c-border-subtle)" strokeWidth="1" fill="none" opacity="0.5" />
        <text x="150" y="199" textAnchor="middle" style={{ fill: "var(--c-muted)" }} fontSize="10" fontFamily="var(--font-sans)" opacity="0.6">
          &quot;Bench press 3 sets of 10...&quot;
        </text>
      </svg>
    </div>
  );
}

export function ProgressCurveIllustration() {
  const pts = [
    { x: 28, y: 180 }, { x: 68, y: 158 }, { x: 112, y: 138 },
    { x: 156, y: 112 }, { x: 196, y: 84 }, { x: 236, y: 58 }, { x: 272, y: 36 },
  ];
  const linePath = pts.reduce((d, p, i) => {
    if (i === 0) return `M${p.x},${p.y}`;
    const prev = pts[i - 1];
    const cpx = (prev.x + p.x) / 2;
    return `${d} C${cpx},${prev.y} ${cpx},${p.y} ${p.x},${p.y}`;
  }, "");
  const areaPath = `${linePath} L${pts[pts.length - 1].x},210 L${pts[0].x},210 Z`;

  return (
    <div className="relative flex items-center justify-center py-8">
      <div className="accent-glow absolute inset-0 rounded-2xl" />
      <svg viewBox="0 0 300 220" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-xs h-auto relative" aria-hidden="true">
        <defs>
          <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--c-accent)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--c-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[60, 110, 160].map((y) => (
          <line key={y} x1="20" y1={y} x2="285" y2={y} stroke="var(--c-border-subtle)" strokeWidth="1" opacity="0.6" />
        ))}
        <path d={areaPath} fill="url(#pg)" />
        <path d={linePath} stroke="var(--c-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="5" style={{ fill: "var(--c-bg)" }} stroke="var(--c-accent)" strokeWidth="2" />
        ))}
      </svg>
    </div>
  );
}

export function OnboardingIllustration() {
  const cards = [
    { x: 58, y: 42, label: "Goals", w: 64 },
    { x: 192, y: 42, label: "Gender", w: 60 },
    { x: 40, y: 168, label: "Height", w: 56 },
    { x: 212, y: 168, label: "Weight", w: 60 },
  ];
  const cx = 150;
  const cy = 110;

  return (
    <div className="relative flex items-center justify-center py-8">
      <div className="accent-glow absolute inset-0 rounded-2xl" />
      <svg viewBox="0 0 300 230" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-xs h-auto relative" aria-hidden="true">
        {cards.map((c, i) => (
          <line key={i} x1={cx} y1={cy} x2={c.x + c.w / 2} y2={c.y + 14} stroke="var(--c-accent)" strokeWidth="1" opacity="0.2" strokeDasharray="4 3" />
        ))}
        <circle cx={cx} cy={cy} r="52" stroke="var(--c-accent)" strokeWidth="0.8" opacity="0.08" />
        <circle cx={cx} cy={cy} r="38" stroke="var(--c-accent)" strokeWidth="0.8" opacity="0.12" />
        <circle cx={cx} cy={cy} r="24" style={{ fill: "var(--c-accent)" }} opacity="0.12" />
        <circle cx={cx} cy={cy - 6} r="7" style={{ fill: "var(--c-accent)" }} opacity="0.5" />
        <path d={`M${cx - 11},${cy + 12} a11,9 0 0,1 22,0`} style={{ fill: "var(--c-accent)" }} opacity="0.45" />
        {cards.map((c, i) => (
          <g key={i}>
            <rect x={c.x} y={c.y} width={c.w} height={28} rx="6" stroke="var(--c-accent)" strokeWidth="1.2" opacity="0.35" style={{ fill: "var(--c-bg)" }} />
            <rect x={c.x} y={c.y} width={c.w} height={28} rx="6" style={{ fill: "var(--c-accent)" }} opacity="0.06" />
            <text x={c.x + c.w / 2} y={c.y + 18} textAnchor="middle" style={{ fill: "var(--c-accent)" }} fontSize="10" fontFamily="var(--font-sans)" opacity="0.6" fontWeight="500">
              {c.label}
            </text>
          </g>
        ))}
        {cards.map((c, i) => {
          const dx = c.x + c.w / 2 - cx;
          const dy = c.y + 14 - cy;
          return (
            <circle key={i} cx={cx + dx * 0.45} cy={cy + dy * 0.45} r="2.5" style={{ fill: "var(--c-accent)" }} opacity="0.3" />
          );
        })}
      </svg>
    </div>
  );
}
