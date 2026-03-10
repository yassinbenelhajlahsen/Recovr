"use client";

import { Suspense } from "react";
import { motion } from "framer-motion";
import { useWorkoutStore } from "@/store/workoutStore";
import { WorkoutDetailDrawer } from "@/components/workout/WorkoutDetailDrawer";
import { SessionSummaryModal } from "@/components/workout/SessionSummaryModal";
import { WorkoutsFilter } from "@/components/workout/WorkoutsFilter";
import { RecoveryPanel } from "@/components/recovery/RecoveryPanel";
import type { DashboardClientProps as Props } from "@/types/workout";

export function DashboardClient({ displayName, workouts, hasFilters, recovery }: Props) {
  const openModal = useWorkoutStore((s) => s.openModal);

  const firstName = displayName?.split(/[\s@]/)[0];

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 sm:px-8 py-10 flex flex-col xl:flex-row gap-8 items-start">

          {/* ─── Left column: workouts ─── */}
          <div className="flex-1 min-w-0 space-y-6">
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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
                {workouts.map((w, i) => {
                  const displayNames =
                    w.exerciseNames.length > 3
                      ? w.exerciseNames.slice(0, 3).join(", ") + ` +${w.exerciseNames.length - 3}`
                      : w.exerciseNames.join(", ");

                  return (
                    <motion.button
                      key={w.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.04, ease: "easeOut" }}
                      onClick={() => openModal("exerciseDrawer", w.id, w)}
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
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ─── Right column: recovery ─── */}
          <div className="w-full xl:w-72 shrink-0 xl:sticky xl:top-24">
            <RecoveryPanel recovery={recovery} />
          </div>

      </div>

      {/* Workout detail drawer (create + view + edit) */}
      <WorkoutDetailDrawer />

      {/* Session summary modal */}
      <SessionSummaryModal />
    </>
  );
}
