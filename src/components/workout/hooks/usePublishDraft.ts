"use client";

import { useState } from "react";
import { mutate as globalMutate } from "swr";
import { toast } from "sonner";
import { fetchWithAuth } from "@/lib/fetch";

export function usePublishDraft(workoutId: string | undefined, onSuccess: () => void) {
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  async function handlePublish() {
    if (!workoutId) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await fetchWithAuth(`/api/workouts/${workoutId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_draft: false }),
      });
      if (!res.ok) {
        toast.error("Failed to save workout");
        setPublishError("Failed to save workout");
        return;
      }
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
      toast.error("Failed to save workout");
      setPublishError("Failed to save workout");
    } finally {
      setPublishing(false);
    }
  }

  return { publishing, publishError, handlePublish };
}
