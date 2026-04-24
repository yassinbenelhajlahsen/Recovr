"use client";

import { useState } from "react";
import { mutate as globalMutate } from "swr";
import { toast } from "sonner";
import { fetchWithAuth } from "@/lib/fetch";
import { useWorkoutStore } from "@/store/workoutStore";
import type { WorkoutDetail } from "@/types/workout";

export function usePublishDraft(workoutId: string | undefined, onSuccess: () => void) {
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  async function handlePublish() {
    if (!workoutId) return;
    setPublishing(true);
    setPublishError(null);

    const emit = useWorkoutStore.getState().emitLocalMutation;

    // Optimistic: flip isDraft on the dashboard card.
    emit({ type: "edit", id: workoutId, patch: { isDraft: false } });

    // Optimistic: patch the detail cache so the drawer reflects the publish.
    globalMutate(
      `/api/workouts/${workoutId}`,
      (prev: WorkoutDetail | undefined) => prev ? { ...prev, is_draft: false } : prev,
      { revalidate: false },
    );

    try {
      const res = await fetchWithAuth(`/api/workouts/${workoutId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_draft: false }),
      });
      if (!res.ok) throw new Error();

      toast.success("Workout saved");

      globalMutate(
        (k) => typeof k === "string" && k.startsWith("/api/workouts/"),
        undefined,
        { revalidate: true },
      );
      globalMutate("/api/recovery");
      globalMutate("/api/progress");
      onSuccess();
    } catch {
      // Rollback both optimistic writes.
      emit({ type: "edit", id: workoutId, patch: { isDraft: true } });
      globalMutate(
        `/api/workouts/${workoutId}`,
        (prev: WorkoutDetail | undefined) => prev ? { ...prev, is_draft: true } : prev,
        { revalidate: false },
      );
      toast.error("Failed to save workout");
      setPublishError("Failed to save workout");
    } finally {
      setPublishing(false);
    }
  }

  return { publishing, publishError, handlePublish };
}
