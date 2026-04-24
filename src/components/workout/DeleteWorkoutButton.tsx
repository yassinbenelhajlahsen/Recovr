"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { mutate as globalMutate } from "swr";
import { toast } from "sonner";
import { fetchWithAuth } from "@/lib/fetch";
import { useWorkoutStore } from "@/store/workoutStore";

export function DeleteWorkoutButton({
  workoutId,
  onDelete,
}: {
  workoutId: string;
  onDelete?: () => void;
}) {
  const router = useRouter();
  const setDeletingWorkoutId = useWorkoutStore((s) => s.setDeletingWorkoutId);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (confirming) {
      resetTimer.current = setTimeout(() => setConfirming(false), 3000);
    }
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, [confirming]);

  async function handleClick() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setLoading(true);

    const emit = useWorkoutStore.getState().emitLocalMutation;

    // Optimistic: mark the card as exiting (triggers the 300ms animation in
    // DashboardClient), then drop the row from the local list after the window.
    setDeletingWorkoutId(workoutId);
    const removeTimer = setTimeout(() => emit({ type: "remove", id: workoutId }), 300);

    // Close the drawer immediately so the user feels the action landed.
    if (onDelete) onDelete();

    try {
      const res = await fetchWithAuth(`/api/workouts/${workoutId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();

      globalMutate(
        (k) => typeof k === "string" && k.startsWith("/api/workouts/"),
        undefined,
        { revalidate: false },
      );
      globalMutate("/api/recovery");
      globalMutate("/api/progress");
      toast.success("Workout deleted");

      // Kick the server-rendered dashboard so a full reload shows the real list.
      router.refresh();
    } catch {
      // Cancel the queued remove so the row isn't ripped out after a failed delete.
      clearTimeout(removeTimer);
      toast.error("Failed to delete workout");
      setLoading(false);
      setConfirming(false);
      setDeletingWorkoutId(null);
      // Re-hydrate in case the row was already removed (fast server fail beats the timer).
      router.refresh();
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`text-sm font-medium rounded-lg px-3.5 py-2 border transition-colors disabled:opacity-50 ${
        confirming
          ? "text-danger border-danger/40 bg-danger/5 hover:bg-danger/10"
          : "text-primary border-border hover:text-danger hover:border-danger/40"
      }`}
    >
      {loading ? "Deleting…" : confirming ? "Confirm?" : "Delete"}
    </button>
  );
}
