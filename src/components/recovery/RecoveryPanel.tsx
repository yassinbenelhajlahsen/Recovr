"use client";

import Link from "next/link";
import type { MuscleRecovery } from "@/types/recovery";
import { BodyMapFront } from "./BodyMapFront";
import { BodyMapBack } from "./BodyMapBack";
import { useRecoverySelection } from "./hooks/useRecoverySelection";

type Props = {
  recovery: MuscleRecovery[];
};

export function RecoveryPanel({ recovery }: Props) {
  const { muscleMap, fatigued, partial, recovered } = useRecoverySelection(recovery);

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
      <Link href="/recovery" className="block">
        <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden hover:border-border transition-colors">
          <div className="flex">
            <div className="flex-1 min-w-0 px-2 pt-3 pb-1">
              <p className="text-xs text-muted text-center mb-1 uppercase tracking-widest">Front</p>
              <BodyMapFront muscles={muscleMap} />
            </div>
            <div className="w-px bg-border-subtle self-stretch" />
            <div className="flex-1 min-w-0 px-2 pt-3 pb-1">
              <p className="text-xs text-muted text-center mb-1 uppercase tracking-widest">Back</p>
              <BodyMapBack muscles={muscleMap} />
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
      </Link>
    </div>
  );
}
