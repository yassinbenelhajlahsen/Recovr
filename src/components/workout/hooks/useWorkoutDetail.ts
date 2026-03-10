import { useState, useCallback, useEffect } from "react";
import type { WorkoutDetail } from "@/types/workout";

export function useWorkoutDetail(
  isDrawerOpen: boolean,
  selectedWorkoutId: string | null
) {
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [trackedId, setTrackedId] = useState<string | null>(null);

  if (isDrawerOpen && selectedWorkoutId && selectedWorkoutId !== trackedId) {
    setTrackedId(selectedWorkoutId);
    setWorkout(null);
    setLoading(true);
  } else if (!isDrawerOpen && trackedId !== null) {
    setTrackedId(null);
    setWorkout(null);
  }

  const fetchWorkout = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/workouts/${id}`);
      setWorkout(await r.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loading && selectedWorkoutId) fetchWorkout(selectedWorkoutId);
  }, [loading, selectedWorkoutId, fetchWorkout]);

  return { workout, setWorkout, loading };
}
