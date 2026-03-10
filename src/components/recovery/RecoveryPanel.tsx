"use client";

import { useState } from "react";
import Link from "next/link";
import { MuscleRecovery } from "@/lib/recovery";
import { BodyMapFront } from "./BodyMapFront";
import { BodyMapBack } from "./BodyMapBack";
import { MuscleDetailPanel } from "./MuscleDetailPanel";
import { STATUS_LABELS, STATUS_COLORS } from "./recoveryColors";

type Props = {
  recovery: MuscleRecovery[];
};

export function RecoveryPanel({ recovery }: Props) {
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);

  const muscleMap = Object.fromEntries(
    recovery.map((r) => [r.muscle, { recoveryPct: r.recoveryPct }])
  );
  const selectedData = recovery.find((r) => r.muscle === selectedMuscle) ?? null;

  const fatigued = recovery.filter((r) => r.status === "fatigued").length;
  const partial = recovery.filter((r) => r.status === "partial").length;
  const recovered = recovery.filter((r) => r.status === "recovered").length;

  function handleSelect(muscle: string) {
    setSelectedMuscle((prev) => (prev === muscle ? null : muscle));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl text-primary tracking-tight">Recovery</h2>
        <Link
          href="/recovery"
          className="text-xs text-accent hover:text-accent-hover font-medium transition-colors flex items-center gap-1"
        >
          Full view
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6H9.5M6.5 3L9.5 6L6.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      {/* Body maps: front + back side by side */}
      <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
        <div className="flex">
          <div className="flex-1 min-w-0 px-2 pt-3 pb-1">
            <p className="text-xs text-muted text-center mb-1 uppercase tracking-widest">Front</p>
            <BodyMapFront
              muscles={muscleMap}

              onSelectMuscle={handleSelect}
            />
          </div>
          <div className="w-px bg-border-subtle self-stretch" />
          <div className="flex-1 min-w-0 px-2 pt-3 pb-1">
            <p className="text-xs text-muted text-center mb-1 uppercase tracking-widest">Back</p>
            <BodyMapBack
              muscles={muscleMap}

              onSelectMuscle={handleSelect}
            />
          </div>
        </div>

        {/* Stat pills */}
        <div className="flex justify-center gap-3 px-4 py-3 border-t border-border-subtle">
          <span className="text-xs font-medium text-success">
            <span className="text-sm font-semibold">{recovered}</span> recovered
          </span>
          <span className="text-xs font-medium text-recovery-yellow">
            <span className="text-sm font-semibold">{partial}</span> recovering
          </span>
          <span className="text-xs font-medium text-danger">
            <span className="text-sm font-semibold">{fatigued}</span> fatigued
          </span>
        </div>
      </div>

      {/* Muscle detail panel (shown on tap) */}
      {selectedData && (
        <MuscleDetailPanel
          recovery={selectedData}
          onClose={() => setSelectedMuscle(null)}
        />
      )}

      {/* Collapsed: quick muscle status list */}
      {!selectedData && (
        <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
          {recovery
            .filter((r) => r.status !== "recovered")
            .slice(0, 5)
            .map((r) => (
              <button
                key={r.muscle}
                onClick={() => handleSelect(r.muscle)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-elevated transition-colors border-b border-border-subtle last:border-0"
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor:
                      r.status === "partial"
                        ? "var(--c-recovery-yellow)"
                        : "var(--c-danger)",
                  }}
                />
                <span className="text-sm text-primary capitalize flex-1">{r.muscle}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status]}`}>
                  {STATUS_LABELS[r.status]}
                </span>
              </button>
            ))}
          {recovery.filter((r) => r.status !== "recovered").length === 0 && (
            <p className="text-sm text-success px-3 py-3 text-center">All muscles recovered ✓</p>
          )}
        </div>
      )}
    </div>
  );
}
