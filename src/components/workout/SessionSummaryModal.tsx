"use client";

import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { useWorkoutStore } from "@/store/workoutStore";

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(dateStr));
}

export function SessionSummaryModal() {
  const { activeModal, activeSession, closeModal, openModal } = useWorkoutStore();
  const router = useRouter();
  const open = activeModal === "sessionSummary" && !!activeSession;

  const workout = open ? activeSession : null;

  const totalSets =
    workout?.workout_exercises.reduce((sum, we) => sum + we.sets.length, 0) ?? 0;

  function handleViewDetails() {
    if (!activeSession) return;
    openModal("exerciseDrawer", activeSession.id);
  }

  function handleDone() {
    closeModal();
    router.refresh();
  }

  return (
    <Modal open={open} onClose={handleDone}>
      <div className="px-6 py-10 space-y-8">
        {/* Success mark */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center mx-auto">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="text-white"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h2 className="font-display text-2xl text-primary">Workout logged</h2>
          {workout && (
            <p className="text-sm text-secondary">{formatDate(workout.date)}</p>
          )}
        </div>

        {workout && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {workout.duration_minutes && (
                <div className="col-span-2 rounded-xl bg-surface border border-border-subtle px-5 py-3 flex items-center justify-between">
                  <span className="text-xs text-muted uppercase tracking-wider font-semibold">Duration</span>
                  <span className="text-sm font-bold text-primary tabular-nums">{workout.duration_minutes} min</span>
                </div>
              )}
              <div className="rounded-xl bg-surface border border-border-subtle p-5 text-center">
                <p className="text-3xl font-bold text-primary tabular-nums">
                  {workout.workout_exercises.length}
                </p>
                <p className="text-xs text-muted mt-1">
                  {workout.workout_exercises.length === 1 ? "exercise" : "exercises"}
                </p>
              </div>
              <div className="rounded-xl bg-surface border border-border-subtle p-5 text-center">
                <p className="text-3xl font-bold text-primary tabular-nums">
                  {totalSets}
                </p>
                <p className="text-xs text-muted mt-1">{totalSets === 1 ? "set" : "sets"}</p>
              </div>
            </div>

            {/* Exercise list */}
            {workout.workout_exercises.length > 0 && (
              <div className="space-y-1.5">
                {workout.workout_exercises.map((we) => (
                  <div
                    key={we.id}
                    className="flex items-center justify-between px-4 py-3 rounded-lg bg-surface"
                  >
                    <p className="text-sm font-medium text-primary">{we.exercise.name}</p>
                    <p className="text-xs text-muted tabular-nums">
                      {we.sets.length} {we.sets.length === 1 ? "set" : "sets"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleDone}
            className="flex-1 bg-accent text-white text-sm font-semibold rounded-lg py-3 hover:bg-accent-hover transition-colors"
          >
            Done
          </button>
          <button
            onClick={handleViewDetails}
            className="flex-1 text-sm font-medium text-primary border border-border rounded-lg py-3 hover:bg-surface transition-colors"
          >
            View details
          </button>
        </div>
      </div>
    </Modal>
  );
}
