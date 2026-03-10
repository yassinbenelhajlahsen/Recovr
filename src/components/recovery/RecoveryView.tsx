"use client";

import { useState } from "react";
import { MuscleRecovery } from "@/lib/recovery";
import { BodyMapFront } from "./BodyMapFront";
import { BodyMapBack } from "./BodyMapBack";
import { MuscleDetailPanel } from "./MuscleDetailPanel";
import { getRecoveryStatus, STATUS_LABELS, STATUS_COLORS } from "./recoveryColors";

type Props = {
  recovery: MuscleRecovery[];
};

export function RecoveryView({ recovery }: Props) {
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);

  const muscleMap = Object.fromEntries(
    recovery.map((r) => [r.muscle, { recoveryPct: r.recoveryPct }])
  );

  const selectedData = recovery.find((r) => r.muscle === selectedMuscle) ?? null;

  function handleSelect(muscle: string) {
    setSelectedMuscle((prev) => (prev === muscle ? null : muscle));
  }

  const fatigued = recovery.filter((r) => r.status === "fatigued").length;
  const partial = recovery.filter((r) => r.status === "partial").length;
  const recovered = recovery.filter((r) => r.status === "recovered").length;

  return (
    <div className="flex flex-col gap-6">
      {/* Summary stats bar */}
      <div className="flex gap-4 flex-wrap">
        <StatPill label="Recovered" count={recovered} colorClass="text-success bg-success/10" />
        <StatPill label="Recovering" count={partial} colorClass="text-recovery-yellow bg-recovery-yellow/10" />
        <StatPill label="Fatigued" count={fatigued} colorClass="text-danger bg-danger/10" />
      </div>

      {/* Maps + detail */}
      <div className="flex flex-col lg:flex-row lg:items-stretch gap-4">
        {/* Body maps */}
        <div className="flex flex-row gap-4 flex-1 min-w-0">
          <div className="flex-1 bg-surface border border-border-subtle rounded-xl p-4">
            <p className="text-xs uppercase tracking-widest text-muted text-center mb-3">Front</p>
            <div className="mx-auto" style={{ maxWidth: 200 }}>
              <BodyMapFront
                muscles={muscleMap}
                onSelectMuscle={handleSelect}
              />
            </div>
          </div>
          <div className="flex-1 bg-surface border border-border-subtle rounded-xl p-4">
            <p className="text-xs uppercase tracking-widest text-muted text-center mb-3">Back</p>
            <div className="mx-auto" style={{ maxWidth: 200 }}>
              <BodyMapBack
                muscles={muscleMap}
                onSelectMuscle={handleSelect}
              />
            </div>
          </div>
        </div>

        {/* Detail panel — always same height as maps */}
        <div className="lg:w-72 xl:w-80 flex flex-col">
          {selectedData ? (
            <MuscleDetailPanel
              recovery={selectedData}
              onClose={() => setSelectedMuscle(null)}
            />
          ) : (
            <div className="bg-surface border border-border-subtle rounded-xl flex-1 flex flex-col items-center justify-center text-center gap-2">
              <p className="text-sm text-secondary">Tap a muscle group</p>
              <p className="text-xs text-muted">to see recovery details</p>
            </div>
          )}
        </div>
      </div>

      {/* Muscle list (always visible on mobile, supplemental on desktop) */}
      <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
        <p className="text-xs uppercase tracking-widest text-muted px-4 pt-4 pb-2">All Muscle Groups</p>
        <div className="divide-y divide-border-subtle">
          {recovery.map((r) => {
            const status = getRecoveryStatus(r.recoveryPct);
            const pct = Math.round(r.recoveryPct * 100);
            return (
              <button
                key={r.muscle}
                onClick={() => handleSelect(r.muscle)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-elevated ${selectedMuscle === r.muscle ? "bg-elevated" : ""}`}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor:
                        status === "recovered"
                          ? "var(--c-success)"
                          : status === "partial"
                            ? "var(--c-recovery-yellow)"
                            : "var(--c-danger)",
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-primary capitalize font-medium">{r.muscle}</p>
                  {r.lastTrainedAt && (
                    <p className="text-xs text-muted truncate">
                      Last trained {formatHours(r.hoursSince)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[status]}`}>
                    {STATUS_LABELS[status]}
                  </span>
                  <span className="text-xs text-muted w-8 text-right">{pct}%</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, count, colorClass }: { label: string; count: number; colorClass: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${colorClass}`}>
      <span className="text-base font-semibold">{count}</span>
      <span className="opacity-80">{label}</span>
    </div>
  );
}

function formatHours(hours: number | null): string {
  if (hours === null) return "";
  if (hours < 1) return "less than an hour ago";
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}
