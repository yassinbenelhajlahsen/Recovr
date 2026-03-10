"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteWorkoutButton({
  workoutId,
  onDelete,
}: {
  workoutId: string;
  onDelete?: () => void;
}) {
  const router = useRouter();
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
    try {
      await fetch(`/api/workouts/${workoutId}`, { method: "DELETE" });
      if (onDelete) {
        onDelete();
      } else {
        router.push("/workouts");
        router.refresh();
      }
    } catch {
      setLoading(false);
      setConfirming(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`text-sm font-medium rounded-lg px-3.5 py-2 border transition-colors disabled:opacity-50 ${
        confirming
          ? "text-danger border-danger/40 bg-danger/5 hover:bg-danger/10"
          : "text-muted border-border hover:text-danger hover:border-danger/30"
      }`}
    >
      {loading ? "Deleting…" : confirming ? "Confirm?" : "Delete"}
    </button>
  );
}
