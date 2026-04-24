import { useState } from "react";
import { useRouter } from "next/navigation";
import { mutate as globalMutate } from "swr";
import { toast } from "sonner";

import { toLocalISODate } from "@/lib/utils";
import { fetchWithAuth } from "@/lib/fetch";
import type { ExerciseEntry, Exercise, WorkoutFormInitialData, WorkoutFormProps, WorkoutSaveData, Workout, WorkoutDetail } from "@/types/workout";
import { useWorkoutStore } from "@/store/workoutStore";

interface UseWorkoutFormOptions {
  workoutId?: string;
  initialData?: WorkoutFormInitialData;
  exercises: ExerciseEntry[];
  onSave: WorkoutFormProps["onSave"];
  onDraftSave: WorkoutFormProps["onDraftSave"];
  addExercise: (ex: Exercise) => void;
  closeSearch: () => void;
  clearCache: () => void;
}

export function useWorkoutForm({
  workoutId,
  initialData,
  exercises,
  onSave,
  onDraftSave,
  addExercise,
  closeSearch,
  clearCache,
}: UseWorkoutFormOptions) {
  const router = useRouter();
  const isEdit = !!workoutId;

  const [date, setDate] = useState(() => initialData?.date ?? toLocalISODate());
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [duration, setDuration] = useState(
    initialData?.duration_minutes != null ? String(initialData.duration_minutes) : ""
  );
  const [bodyWeight, setBodyWeight] = useState(
    initialData?.body_weight != null ? String(initialData.body_weight) : ""
  );

  const [customLoading, setCustomLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
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
      const res = await fetchWithAuth("/api/exercises", {
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
      clearCache(); // also invalidates SWR exercise keys via useExerciseSearch.clearCache()
    } catch {
      toast.error("Failed to create exercise");
      setError("Failed to create custom exercise");
    } finally {
      setCustomLoading(false);
    }
  }

  async function handleSubmit() {
    if (date > toLocalISODate()) {
      setError("Date cannot be in the future");
      return;
    }
    if (duration && (Number(duration) < 1 || Number(duration) > 999)) {
      setError("Duration must be between 1 and 999 minutes");
      return;
    }
    if (bodyWeight && (parseFloat(bodyWeight) < 1 || parseFloat(bodyWeight) > 999)) {
      setError("Body weight must be between 1 and 999");
      return;
    }
    if (exercises.length === 0) {
      setError("Add at least one exercise");
      return;
    }
    if (exercises.length > 50) {
      setError("Too many exercises (max 50)");
      return;
    }
    for (const ex of exercises) {
      if (ex.sets.length > 20) {
        setError(`Too many sets for ${ex.exercise_name} (max 20)`);
        return;
      }
      for (const s of ex.sets) {
        if (!s.reps || !s.weight) {
          setError(`Fill in reps and weight for all sets in ${ex.exercise_name}`);
          return;
        }
        if (Number(s.reps) < 0 || Number(s.weight) < 0) {
          setError(`Reps or weight cannot be negative in ${ex.exercise_name}`);
          return;
        }
        if (Number(s.reps) > 10000 || Number(s.weight) > 10000) {
          setError(`Reps or weight values are out of range in ${ex.exercise_name}`);
          return;
        }
      }
    }
    setError("");
    setSaving(true);

    const tempId = isEdit ? workoutId! : `optimistic-${crypto.randomUUID()}`;
    const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
    const optimisticSummary: Workout = {
      id: tempId,
      date: new Date(date).toISOString(),
      dateFormatted: new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(date)),
      durationMinutes: duration ? Number(duration) : null,
      notes: notes || null,
      exerciseNames: exercises.map((ex) => ex.exercise_name),
      totalSets,
      isDraft: false,
    };

    // Optimistic: add to dashboard list (create) or patch in place (edit).
    const emit = useWorkoutStore.getState().emitLocalMutation;
    if (isEdit) {
      emit({
        type: "edit",
        id: tempId,
        patch: {
          date: optimisticSummary.date,
          dateFormatted: optimisticSummary.dateFormatted,
          durationMinutes: optimisticSummary.durationMinutes,
          notes: optimisticSummary.notes,
          exerciseNames: optimisticSummary.exerciseNames,
          totalSets,
        },
      });

      // Optimistically patch the detail SWR cache so the drawer "view" mode reflects
      // the edit immediately. Only scalar fields — exercises/sets are reconstructed
      // from form state, but the globalMutate call further down revalidates the full
      // detail cache after the PUT succeeds.
      globalMutate(
        `/api/workouts/${workoutId}`,
        (prev: WorkoutDetail | undefined) =>
          prev ? {
            ...prev,
            date: optimisticSummary.date,
            duration_minutes: optimisticSummary.durationMinutes,
            notes: optimisticSummary.notes,
          } : prev,
        { revalidate: false },
      );
    } else {
      emit({ type: "insert", workout: optimisticSummary });
    }

    try {
      const body = {
        date,
        notes: notes || null,
        duration_minutes: duration || null,
        body_weight: bodyWeight ? parseFloat(bodyWeight) : null,
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
      const res = await fetchWithAuth(
        isEdit ? `/api/workouts/${workoutId}` : "/api/workouts",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error();
      const { id } = await res.json();

      // Reconcile: swap temp id for real id on create. Single edit patch — two sync
      // emits would collapse into one render, dropping the remove and leaving duplicates.
      if (!isEdit && id !== tempId) {
        emit({ type: "edit", id: tempId, patch: { id } });
      }

      toast.success(isEdit ? "Workout updated" : "Workout logged");

      globalMutate(
        (k) => typeof k === "string" && k.startsWith("/api/workouts/"),
        undefined,
        { revalidate: false },
      );
      globalMutate("/api/recovery");
      globalMutate("/api/progress");

      if (onSave) {
        const saveData: WorkoutSaveData = {
          id,
          date,
          duration_minutes: duration ? Number(duration) : null,
          body_weight: bodyWeight ? parseFloat(bodyWeight) : null,
          notes: notes || null,
          workout_exercises: exercises.map((ex, i) => ({
            id: `local-we-${i}`,
            exercise: { id: ex.exercise_id, name: ex.exercise_name, muscle_groups: ex.muscle_groups, equipment: ex.equipment ?? null },
            sets: ex.sets.map((s) => ({
              id: s.id,
              set_number: s.set_number,
              reps: Number(s.reps),
              weight: Number(s.weight),
            })),
          })),
        };
        onSave(saveData);
      }
      // router.push/refresh removed — the optimistic emit + globalMutate handle UI updates.
    } catch {
      // Rollback the dashboard list change.
      if (isEdit) {
        // Edit rollback: we don't have the pre-edit summary in scope. Easiest: refresh
        // to pull the canonical server state.
        router.refresh();
      } else {
        emit({ type: "remove", id: tempId });
      }
      toast.error("Failed to save workout");
      setSaving(false);
    }
  }

  async function handleSaveAsDraft() {
    if (exercises.length === 0) {
      setError("Add at least one exercise");
      return;
    }
    if (exercises.length > 50) {
      setError("Too many exercises (max 50)");
      return;
    }
    setError("");
    setSavingDraft(true);
    try {
      const body = {
        date,
        notes: notes || null,
        duration_minutes: duration || null,
        body_weight: bodyWeight ? parseFloat(bodyWeight) : null,
        is_draft: true,
        exercises: exercises.map((ex, i) => ({
          exercise_id: ex.exercise_id,
          order: i,
          sets: ex.sets
            .filter((s) => s.reps && s.weight)
            .map((s) => ({
              set_number: s.set_number,
              reps: s.reps,
              weight: s.weight,
            })),
        })),
      };
      const res = await fetchWithAuth("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast.success("Draft saved");
      router.refresh();
      if (onDraftSave) onDraftSave();
    } catch {
      toast.error("Failed to save draft");
      setError("Failed to save draft. Please try again.");
      setSavingDraft(false);
    }
  }

  return {
    date,
    setDate,
    notes,
    setNotes,
    duration,
    setDuration,
    bodyWeight,
    setBodyWeight,
    saving,
    savingDraft,
    error,
    customLoading,
    handleSubmit,
    handleSaveAsDraft,
    createCustomExercise,
  };
}
