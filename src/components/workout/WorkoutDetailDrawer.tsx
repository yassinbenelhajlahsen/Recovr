"use client";

import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/ui/Drawer";
import { DeleteWorkoutButton } from "@/components/workout/DeleteWorkoutButton";
import { WorkoutForm } from "@/components/workout/WorkoutForm";
import { useWorkoutStore } from "@/store/workoutStore";
import type { SessionSummaryData, WorkoutDetail } from "@/types/workout";

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(dateStr));
}

export function WorkoutDetailDrawer() {
  const { activeModal, selectedWorkoutId, previewData, closeModal } = useWorkoutStore();
  const router = useRouter();
  const open = activeModal === "exerciseDrawer";
  const isCreate = open && !selectedWorkoutId;

  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Reset state when drawer opens/closes via derived state
  const [trackedId, setTrackedId] = useState<string | null>(null);
  if (open && selectedWorkoutId && selectedWorkoutId !== trackedId) {
    setTrackedId(selectedWorkoutId);
    setWorkout(null);
    setIsEditing(false);
    setLoading(true);
  } else if (!open && trackedId !== null) {
    setTrackedId(null);
    setWorkout(null);
    setIsEditing(false);
  }

  const fetchWorkout = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/workouts/${id}`);
      const data = await r.json();
      setWorkout(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loading && selectedWorkoutId) {
      fetchWorkout(selectedWorkoutId);
    }
  }, [loading, selectedWorkoutId, fetchWorkout]);

  function handleCreateSave(data: SessionSummaryData) {
    useWorkoutStore.setState({ activeModal: "sessionSummary", activeSession: data });
  }

  function handleEditSave(data: SessionSummaryData) {
    setIsEditing(false);
    setWorkout({
      id: data.id,
      date: data.date,
      duration_minutes: data.duration_minutes,
      notes: data.notes,
      workout_exercises: data.workout_exercises.map((we, i) => ({
        ...we,
        exercise: we.exercise,
        order: i,
      })),
    });
    router.refresh();
  }

  const totalSets =
    workout?.workout_exercises.reduce((sum, we) => sum + we.sets.length, 0) ?? 0;

  const drawerTitle = isCreate
    ? "Log Workout"
    : isEditing
    ? "Edit Workout"
    : workout
    ? formatDate(workout.date)
    : previewData
    ? previewData.dateFormatted
    : loading
    ? " "
    : undefined;

  const initialData = workout
    ? {
        date: workout.date.split("T")[0],
        notes: workout.notes,
        duration_minutes: workout.duration_minutes,
        exercises: workout.workout_exercises.map((we) => ({
          exercise_id: we.exercise.id,
          exercise_name: we.exercise.name,
          muscle_groups: we.exercise.muscle_groups,
          order: we.order,
          sets: we.sets.map((s) => ({
            set_number: s.set_number,
            reps: s.reps,
            weight: s.weight,
          })),
        })),
      }
    : undefined;

  return (
    <Drawer open={open} onClose={closeModal} title={drawerTitle}>
      <div className="px-5 py-5 space-y-5">
        {/* Create mode */}
        {isCreate && (
          <WorkoutForm
            compact
            onSave={handleCreateSave}
            onCancel={closeModal}
          />
        )}

        {/* Preview mode — instant render from list data */}
        {!isCreate && loading && previewData && (
          <>
            <div className="flex items-center gap-3 text-sm text-secondary">
              {previewData.durationMinutes && (
                <span className="tabular-nums">{previewData.durationMinutes} min</span>
              )}
              <span className="tabular-nums">{previewData.totalSets} {previewData.totalSets === 1 ? "set" : "sets"}</span>
            </div>
            {previewData.notes && (
              <p className="text-sm text-secondary italic border-l-2 border-accent/30 pl-3">
                {previewData.notes}
              </p>
            )}
            <div className="space-y-3">
              {previewData.exerciseNames.map((name) => (
                <div
                  key={name}
                  className="rounded-xl bg-surface border border-border-subtle overflow-hidden"
                >
                  <div className="px-5 py-3.5 border-b border-border">
                    <p className="font-semibold text-sm text-primary">{name}</p>
                  </div>
                  <div className="px-5 py-3.5 animate-pulse">
                    <div className="h-3 bg-bg rounded w-24" />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Loading skeleton fallback */}
        {!isCreate && loading && !previewData && (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 bg-surface rounded-lg w-1/3" />
            <div className="h-24 bg-surface rounded-xl" />
            <div className="h-24 bg-surface rounded-xl" />
          </div>
        )}

        {/* Edit mode */}
        {!isCreate && !loading && workout && isEditing && (
          <WorkoutForm
            compact
            workoutId={workout.id}
            initialData={initialData}
            onSave={handleEditSave}
            onCancel={() => setIsEditing(false)}
          />
        )}

        {/* View mode */}
        {!isCreate && !loading && workout && !isEditing && (
          <>
            {/* Meta + actions */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-sm text-secondary">
                {workout.duration_minutes && (
                  <span className="tabular-nums">{workout.duration_minutes} min</span>
                )}
                <span className="tabular-nums">{totalSets} {totalSets === 1 ? "set" : "sets"}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-sm font-medium text-primary border border-border rounded-lg px-3 py-1.5 hover:bg-surface transition-colors"
                >
                  Edit
                </button>
                <DeleteWorkoutButton
                  workoutId={workout.id}
                  onDelete={() => {
                    closeModal();
                    router.refresh();
                  }}
                />
              </div>
            </div>

            {workout.notes && (
              <p className="text-sm text-secondary italic border-l-2 border-accent/30 pl-3">
                {workout.notes}
              </p>
            )}

            {/* Exercises */}
            <div className="space-y-3">
              {workout.workout_exercises.map((we) => (
                <div
                  key={we.id}
                  className="rounded-xl bg-surface border border-border-subtle overflow-hidden"
                >
                  <div className="px-5 py-3.5 border-b border-border">
                    <p className="font-semibold text-sm text-primary">
                      {we.exercise.name}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {we.exercise.muscle_groups.map((m) => (
                        <span
                          key={m}
                          className="text-xs text-muted bg-bg rounded-md px-2 py-0.5"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
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
                        <span className="text-sm font-medium text-muted tabular-nums">
                          {s.set_number}
                        </span>
                        <span className="text-sm font-medium text-primary tabular-nums">
                          {s.reps}
                        </span>
                        <span className="text-sm font-medium text-primary tabular-nums">
                          {s.weight} lbs
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
