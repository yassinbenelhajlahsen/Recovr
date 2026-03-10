"use client";

import Link from "next/link";
import { MuscleRecovery } from "@/lib/recovery";
import { BodyMapFront } from "./BodyMapFront";

type Props = {
  recovery: MuscleRecovery[];
};

export function RecoverySummary({ recovery }: Props) {
  const fatigued = recovery.filter((r) => r.status === "fatigued");
  const partial = recovery.filter((r) => r.status === "partial");

  const muscleMap = Object.fromEntries(
    recovery.map((r) => [r.muscle, { recoveryPct: r.recoveryPct }])
  );

  let summaryText: string;
  let summaryColor: string;
  if (fatigued.length === 0 && partial.length === 0) {
    summaryText = "All muscles recovered";
    summaryColor = "text-success";
  } else if (fatigued.length > 0) {
    const names = fatigued
      .slice(0, 2)
      .map((r) => r.muscle)
      .join(", ");
    summaryText = `${fatigued.length} group${fatigued.length > 1 ? "s" : ""} fatigued — ${names}${fatigued.length > 2 ? "..." : ""}`;
    summaryColor = "text-danger";
  } else {
    summaryText = `${partial.length} group${partial.length > 1 ? "s" : ""} still recovering`;
    summaryColor = "text-recovery-yellow";
  }

  return (
    <div className="bg-surface border border-border-subtle rounded-xl p-4 flex items-center gap-5">
      {/* Mini body map - front only */}
      <div className="flex-shrink-0" style={{ width: 100 }}>
        <BodyMapFront
          muscles={muscleMap}
          onSelectMuscle={() => {}}
        />
      </div>

      {/* Text content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs uppercase tracking-widest text-muted mb-1">Recovery Status</p>
        <p className={`text-sm font-medium ${summaryColor} mb-3`}>{summaryText}</p>

        {/* Quick stats */}
        <div className="flex gap-3 text-xs text-secondary flex-wrap mb-4">
          <span>
            <span className="font-semibold text-success">
              {recovery.filter((r) => r.status === "recovered").length}
            </span>{" "}
            recovered
          </span>
          <span>
            <span className="font-semibold text-recovery-yellow">
              {partial.length}
            </span>{" "}
            recovering
          </span>
          <span>
            <span className="font-semibold text-danger">{fatigued.length}</span>{" "}
            fatigued
          </span>
        </div>

        <Link
          href="/recovery"
          className="inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover font-medium transition-colors"
        >
          View full recovery map
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6H9.5M6.5 3L9.5 6L6.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
