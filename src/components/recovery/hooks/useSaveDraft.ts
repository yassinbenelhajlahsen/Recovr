import { useState } from "react";
import { toLocalISODate } from "@/lib/utils";
import { fetchWithAuth } from "@/lib/fetch";
import type { WorkoutSuggestion } from "@/types/suggestion";

export function useSaveDraft() {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function saveDraft(suggestion: WorkoutSuggestion, suggestionId?: string | null): Promise<string | null> {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetchWithAuth("/api/workouts/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestion, date: toLocalISODate(), ...(suggestionId ? { suggestionId } : {}) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error ?? "Failed to save draft");
        return null;
      }
      const { id } = await res.json();
      return id as string;
    } catch {
      setSaveError("Failed to save draft");
      return null;
    } finally {
      setSaving(false);
    }
  }

  return { saveDraft, saving, saveError };
}
