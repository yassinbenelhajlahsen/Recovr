"use client";

import { useState, useEffect } from "react";
import { MuscleRecovery } from "@/lib/recovery";
import { STATUS_LABELS, STATUS_COLORS } from "./recoveryColors";

type Props = {
  recovery: MuscleRecovery;
  onClose: () => void;
};

function formatRelativeTime(isoDate: string, now: number): string {
  const diff = now - new Date(isoDate).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Less than an hour ago";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${weekdays[d.getUTCDay()]}, ${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function formatVolume(lbs: number): string {
  if (lbs >= 1000) return `${(lbs / 1000).toFixed(1)}k lbs`;
  return `${Math.round(lbs).toLocaleString()} lbs`;
}

export function MuscleDetailPanel({ recovery, onClose }: Props) {
  const {
    muscle,
    recoveryPct,
    status,
    lastTrainedAt,
    lastSessionVolume,
    lastSessionSets,
    lastSessionReps,
    lastSessionExercises,
  } = recovery;

  const [clientNow, setClientNow] = useState<number | null>(null);
  /* eslint-disable react-hooks/set-state-in-effect -- client-only mount detection for relative time display */
  useEffect(() => { setClientNow(Date.now()); }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const pctDisplay = Math.round(recoveryPct * 100);

  // Progress bar gradient color
  const barColor =
    status === "recovered"
      ? "bg-success"
      : status === "partial"
        ? "bg-recovery-yellow"
        : "bg-danger";
  
  return (
    <div className="bg-surface border border-border-subtle rounded-xl p-5 flex flex-col gap-4 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted font-medium mb-1">Muscle Group</p>
          <h3 className="font-display text-xl text-primary capitalize">{muscle}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[status]}`}>
            {STATUS_LABELS[status]}
          </span>
          <button
            onClick={onClose}
            className="text-muted hover:text-primary transition-colors p-1 rounded"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Recovery progress bar */}
      <div>
        <div className="flex justify-between text-xs text-muted mb-1.5">
          <span>Recovery</span>
          <span className="font-medium text-primary">{pctDisplay}%</span>
        </div>
        <div className="h-2 bg-elevated rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${pctDisplay}%` }}
          />
        </div>
      </div>

      {/* Last trained info */}
      {lastTrainedAt ? (
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-xs text-muted uppercase tracking-widest mb-1">Last trained</p>
            <p className="text-sm text-primary font-medium">{clientNow ? formatRelativeTime(lastTrainedAt, clientNow) : formatDate(lastTrainedAt)}</p>
            
            <p className="text-xs text-secondary">{formatDate(lastTrainedAt)}</p>
          </div>

          {/* Volume stats */}
          {lastSessionVolume !== null && (
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-elevated rounded-lg p-2.5 text-center">
                <p className="text-base font-semibold text-primary">{lastSessionSets}</p>
                <p className="text-xs text-muted">sets</p>
              </div>
              <div className="bg-elevated rounded-lg p-2.5 text-center">
                <p className="text-base font-semibold text-primary">{lastSessionReps}</p>
                <p className="text-xs text-muted">reps</p>
              </div>
              <div className="bg-elevated rounded-lg p-2.5 text-center">
                <p className="text-sm font-semibold text-primary">{formatVolume(lastSessionVolume)}</p>
                <p className="text-xs text-muted">volume</p>
              </div>
            </div>
          )}

          {/* Exercises */}
          {lastSessionExercises.length > 0 && (
            <div>
              <p className="text-xs text-muted uppercase tracking-widest mb-2">Exercises</p>
              <div className="flex flex-wrap gap-1.5">
                {lastSessionExercises.map((ex) => (
                  <span
                    key={ex}
                    className="text-xs bg-elevated text-secondary px-2.5 py-1 rounded-full border border-border-subtle"
                  >
                    {ex}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="py-2">
          <p className="text-sm text-secondary">No training data in the last 4 days.</p>
          <p className="text-xs text-muted mt-1">This muscle group is fully recovered.</p>
        </div>
      )}
    </div>
  );
}
