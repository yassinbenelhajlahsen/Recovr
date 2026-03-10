import { useState } from "react";
import { useRouter } from "next/navigation";

import type { ExerciseEntry, Exercise, WorkoutFormInitialData, WorkoutFormProps, SessionSummaryData } from "@/types/workout";

interface UseWorkoutFormOptions {
  workoutId?: string;
  initialData?: WorkoutFormInitialData;
  exercises: ExerciseEntry[];
  onSave: WorkoutFormProps["onSave"];
  addExercise: (ex: Exercise) => void;
  closeSearch: () => void;
  clearCache: () => void;
}

export function useWorkoutForm({
  workoutId,
  initialData,
  exercises,
  onSave,
  addExercise,
  closeSearch,
  clearCache,
}: UseWorkoutFormOptions) {
  const router = useRouter();
  const isEdit = !!workoutId;

  const [date, setDate] = useState(() => {
    if (initialData?.date) return initialData.date;
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [duration, setDuration] = useState(
    initialData?.duration_minutes != null ? String(initialData.duration_minutes) : ""
  );

  const [customLoading, setCustomLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleAddExercise(ex: Exercise) {
    addExercise(ex);
    closeSearch();
  }

  async function createCustomExercise(name: string, muscles: string, equipment: string) {
    setCustomLoading(true);
    try {
      const muscle_groups = muscles
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);
      const res = await fetch("/api/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          muscle_groups,
          equipment: equipment.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();
      handleAddExercise(await res.json());
      clearCache();
    } catch {
      setError("Failed to create custom exercise");
    } finally {
      setCustomLoading(false);
    }
  }

  async function handleSubmit() {
    if (exercises.length === 0) {
      setError("Add at least one exercise");
      return;
    }
    for (const ex of exercises) {
      for (const s of ex.sets) {
        if (!s.reps || !s.weight) {
          setError(`Fill in reps and weight for all sets in ${ex.exercise_name}`);
          return;
        }
      }
    }
    setError("");
    setSaving(true);
    try {
      const body = {
        date,
        notes: notes || null,
        duration_minutes: duration || null,
        exercises: exercises.map((ex, i) => ({
          exercise_id: ex.exercise_id,
          order: i,
          sets: ex.sets.map((s) => ({
            set_number: s.set_number,
            reps: s.reps,
            weight: s.weight,
          })),
        })),
      };
      const res = await fetch(
        isEdit ? `/api/workouts/${workoutId}` : "/api/workouts",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) throw new Error();
      const { id } = await res.json();
      if (onSave) {
        const saveData: SessionSummaryData = {
          id,
          date,
          duration_minutes: duration ? Number(duration) : null,
          notes: notes || null,
          workout_exercises: exercises.map((ex, i) => ({
            id: `local-we-${i}`,
            exercise: { id: ex.exercise_id, name: ex.exercise_name, muscle_groups: ex.muscle_groups },
            sets: ex.sets.map((s) => ({
              id: s.id,
              set_number: s.set_number,
              reps: Number(s.reps),
              weight: Number(s.weight),
            })),
          })),
        };
        onSave(saveData);
      } else {
        router.push(`/workouts/${id}`);
        router.refresh();
      }
    } catch {
      setError("Failed to save workout. Please try again.");
      setSaving(false);
    }
  }

  return {
    date,
    setDate,
    notes,
    setNotes,
    duration,
    setDuration,
    saving,
    error,
    customLoading,
    handleSubmit,
    createCustomExercise,
  };
}
