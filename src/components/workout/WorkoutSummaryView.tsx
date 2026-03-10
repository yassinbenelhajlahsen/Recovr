"use client";

import { formatDateShort } from "@/lib/utils";
import type { SessionSummaryData } from "@/types/workout";

type Props = {
  session: SessionSummaryData;
  onDone: () => void;
  onViewDetails: () => void;
};

export function WorkoutSummaryView({ session, onDone, onViewDetails }: Props) {
  const totalSets = session.workout_exercises.reduce((sum, we) => sum + we.sets.length, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider">
          {formatDateShort(session.date)}
        </p>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-success">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          Logged
        </span>
      </div>

      <div className="flex items-center gap-4 text-sm text-secondary">
        {session.duration_minutes && (
          <span className="tabular-nums">{session.duration_minutes} min</span>
        )}
        <span className="tabular-nums">
          {session.workout_exercises.length}{" "}
          {session.workout_exercises.length === 1 ? "exercise" : "exercises"}
        </span>
        <span className="tabular-nums">
          {totalSets} {totalSets === 1 ? "set" : "sets"}
        </span>
      </div>

      {session.notes && (
        <p className="text-sm text-secondary italic border-l-2 border-accent/30 pl-3">
          {session.notes}
        </p>
      )}

      {session.workout_exercises.length > 0 && (
        <div className="space-y-3">
          {session.workout_exercises.map((we) => (
            <div key={we.id} className="rounded-xl bg-surface border border-border-subtle overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border">
                <p className="font-semibold text-sm text-primary">{we.exercise.name}</p>
              </div>
              <div className="px-5 py-3.5">
                <div className="grid grid-cols-[40px_1fr_1fr] gap-4 mb-2 text-[11px] font-semibold text-muted uppercase tracking-wider">
                  <span>Set</span>
                  <span>Reps</span>
                  <span>Weight</span>
                </div>
                {we.sets.map((s) => (
                  <div
                    key={s.id}
                    className="grid grid-cols-[40px_1fr_1fr] gap-4 py-1.5 border-b border-border-subtle last:border-0"
                  >
                    <span className="text-sm font-medium text-muted tabular-nums">{s.set_number}</span>
                    <span className="text-sm font-medium text-primary tabular-nums">{s.reps}</span>
                    <span className="text-sm font-medium text-primary tabular-nums">{s.weight} lbs</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4">
        <button
          onClick={onDone}
          className="bg-accent text-white text-sm font-semibold rounded-lg px-6 py-3 hover:bg-accent-hover transition-colors"
        >
          Done
        </button>
        <button
          onClick={onViewDetails}
          className="text-sm font-medium text-secondary hover:text-primary transition-colors"
        >
          View details
        </button>
      </div>
    </div>
  );
}
