"use client";

import type { ExerciseEntry } from "@/types/workout";

type Props = {
  exercise: ExerciseEntry;
  onRemoveExercise: (id: string) => void;
  onAddSet: (exId: string) => void;
  onRemoveSet: (exId: string, setId: string) => void;
  onUpdateSet: (exId: string, setId: string, field: "reps" | "weight", value: string) => void;
};

export function ExerciseCard({ exercise: ex, onRemoveExercise, onAddSet, onRemoveSet, onUpdateSet }: Props) {
  return (
    <div className="rounded-xl bg-surface border border-border-subtle overflow-hidden">
      <div className="flex items-start justify-between px-5 py-4 border-b border-border">
        <div>
          <p className="font-semibold text-primary">{ex.exercise_name}</p>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {ex.muscle_groups.map((m) => (
              <span key={m} className="text-xs text-muted bg-bg rounded-md px-2 py-0.5">
                {m}
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={() => onRemoveExercise(ex.id)}
          className="text-muted hover:text-danger transition-colors p-1 -mr-1 -mt-0.5 shrink-0"
          aria-label="Remove exercise"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="px-5 py-4">
        <div className="grid grid-cols-[40px_1fr_1fr_28px] gap-2 mb-3 text-[11px] font-semibold text-muted uppercase tracking-wider">
          <span>Set</span>
          <span>Reps</span>
          <span>LBS</span>
          <span />
        </div>
        {ex.sets.map((s) => (
          <div key={s.id} className="grid grid-cols-[40px_1fr_1fr_28px] gap-2 mb-2 items-center">
            <span className="text-sm font-medium text-muted tabular-nums">{s.set_number}</span>
            <input
              type="number"
              min="1"
              placeholder="10"
              value={s.reps}
              onChange={(e) => onUpdateSet(ex.id, s.id, "reps", e.target.value)}
              className="min-w-0 w-full rounded-lg border border-border bg-elevated px-2.5 py-2 text-sm text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
            />
            <input
              type="number"
              min="0"
              step="0.5"
              placeholder="60"
              value={s.weight}
              onChange={(e) => onUpdateSet(ex.id, s.id, "weight", e.target.value)}
              className="min-w-0 w-full rounded-lg border border-border bg-elevated px-2.5 py-2 text-sm text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
            />
            <button
              onClick={() => onRemoveSet(ex.id, s.id)}
              disabled={ex.sets.length === 1}
              className="flex items-center justify-center text-muted hover:text-danger disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
              aria-label="Remove set"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
        <button
          onClick={() => onAddSet(ex.id)}
          className="mt-2 text-xs font-semibold text-accent hover:underline"
        >
          + Add set
        </button>
      </div>
    </div>
  );
}
