"use client";

import { Suspense } from "react";
import { useWorkoutStore } from "@/store/workoutStore";
import { WorkoutDetailDrawer } from "@/components/WorkoutDetailDrawer";
import { SessionSummaryModal } from "@/components/SessionSummaryModal";
import { WorkoutsFilter } from "@/components/WorkoutsFilter";

type Workout = {
  id: string;
  date: string;
  dateFormatted: string;
  durationMinutes: number | null;
  notes: string | null;
  exerciseNames: string[];
  totalSets: number;
};

type Props = {
  displayName: string | null | undefined;
  workouts: Workout[];
  hasFilters: boolean;
};

export function DashboardClient({ displayName, workouts, hasFilters }: Props) {
  const openModal = useWorkoutStore((s) => s.openModal);

  const firstName = displayName?.split(/[\s@]/)[0];

  return (
    <>
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 space-y-8">
        {/* Header */}
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-display text-4xl sm:text-5xl text-primary tracking-tight">
              {firstName ? `Hey, ${firstName}` : "Your workouts"}
            </h1>
            <p className="text-secondary">
              {workouts.length === 0 && !hasFilters
                ? "Log your first workout to get started."
                : `${workouts.length} workout${workouts.length === 1 ? "" : "s"}${hasFilters ? " found" : " logged"}`}
            </p>
          </div>
          <button
            onClick={() => openModal("exerciseDrawer")}
            className="flex items-center gap-1.5 bg-accent text-white text-sm font-semibold rounded-lg px-4 py-2.5 hover:bg-accent-hover transition-colors shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="hidden sm:inline">Log Workout</span>
          </button>
        </div>

        {/* Filters */}
        <Suspense>
          <WorkoutsFilter />
        </Suspense>

        {/* Workout list */}
        {workouts.length === 0 ? (
          <div className="rounded-xl bg-surface border border-border-subtle border-dashed p-16 text-center space-y-3">
            <p className="font-display text-2xl text-muted">
              {hasFilters ? "No matches" : "No workouts yet"}
            </p>
            <p className="text-sm text-muted">
              {hasFilters
                ? "Try adjusting your filters"
                : "Start by logging your first session"}
            </p>
            {!hasFilters && (
              <button
                onClick={() => openModal("exerciseDrawer")}
                className="inline-block mt-2 text-sm font-semibold text-accent hover:underline"
              >
                Log your first workout
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {workouts.map((w) => {
              const displayNames =
                w.exerciseNames.length > 3
                  ? w.exerciseNames.slice(0, 3).join(", ") + ` +${w.exerciseNames.length - 3}`
                  : w.exerciseNames.join(", ");

              return (
                <button
                  key={w.id}
                  onClick={() => openModal("exerciseDrawer", w.id)}
                  className="group w-full text-left block rounded-xl bg-surface border border-border-subtle px-6 py-5 hover:bg-elevated hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 mb-1.5">
                        <p className="font-semibold text-primary group-hover:text-accent transition-colors">
                          {w.dateFormatted}
                        </p>
                        {w.durationMinutes && (
                          <span className="text-xs text-muted bg-bg rounded-md px-2 py-0.5 tabular-nums">
                            {w.durationMinutes} min
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-secondary truncate">
                        {displayNames || "No exercises"}
                      </p>
                      {w.notes && (
                        <p className="text-xs text-muted mt-1.5 truncate italic">
                          {w.notes}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-2xl font-bold text-primary tabular-nums leading-none">
                        {w.totalSets}
                      </p>
                      <p className="text-xs text-muted mt-1">
                        {w.totalSets === 1 ? "set" : "sets"}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Workout detail drawer (create + view + edit) */}
      <WorkoutDetailDrawer />

      {/* Session summary modal */}
      <SessionSummaryModal />
    </>
  );
}
