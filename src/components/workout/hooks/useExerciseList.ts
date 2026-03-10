import { useState } from "react";
import { uid } from "@/lib/utils";
import type { Exercise, ExerciseEntry, WorkoutFormInitialData } from "@/types/workout";

export function useExerciseList(initialData?: WorkoutFormInitialData) {
  const [exercises, setExercises] = useState<ExerciseEntry[]>(
    initialData?.exercises.map((ex) => ({
      id: uid(),
      exercise_id: ex.exercise_id,
      exercise_name: ex.exercise_name,
      muscle_groups: ex.muscle_groups,
      equipment: ex.equipment,
      order: ex.order,
      sets: ex.sets.map((s) => ({
        id: uid(),
        set_number: s.set_number,
        reps: String(s.reps),
        weight: String(s.weight),
      })),
    })) ?? []
  );

  function addExercise(ex: Exercise) {
    if (exercises.some((e) => e.exercise_id === ex.id)) return;
    setExercises((prev) => [
      {
        id: uid(),
        exercise_id: ex.id,
        exercise_name: ex.name,
        muscle_groups: ex.muscle_groups,
        equipment: ex.equipment,
        order: 0,
        sets: [{ id: uid(), set_number: 1, reps: "", weight: "" }],
      },
      ...prev,
    ]);
  }

  function removeExercise(localId: string) {
    setExercises((prev) => prev.filter((e) => e.id !== localId));
  }

  function addSet(exId: string) {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id !== exId
          ? ex
          : {
              ...ex,
              sets: [
                ...ex.sets,
                { id: uid(), set_number: ex.sets.length + 1, reps: "", weight: "" },
              ],
            }
      )
    );
  }

  function removeSet(exId: string, setId: string) {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id !== exId
          ? ex
          : {
              ...ex,
              sets: ex.sets
                .filter((s) => s.id !== setId)
                .map((s, i) => ({ ...s, set_number: i + 1 })),
            }
      )
    );
  }

  function updateSet(exId: string, setId: string, field: "reps" | "weight", value: string) {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id !== exId
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s)),
            }
      )
    );
  }

  return { exercises, addExercise, removeExercise, addSet, removeSet, updateSet };
}
