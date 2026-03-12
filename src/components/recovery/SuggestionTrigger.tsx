"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Drawer } from "@/components/ui/Drawer";
import { SuggestionPanel } from "./SuggestionPanel";
import type { PanelView } from "./SuggestionPanel";
import { SparklesIcon, HistoryIcon } from "@/components/ui/icons";
import { useRecovery } from "@/lib/hooks";

export function SuggestionTrigger() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<PanelView>("planner");
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const { data: recovery = [] } = useRecovery();
  useSWR("/api/suggest/cooldown", { revalidateOnFocus: false, dedupingInterval: 60_000 });

  // Reset to planner view when drawer closes
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => { setView("planner"); setSelectedHistoryId(null); }, 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  const historyButton = view === "planner" ? (
    <button
      onClick={() => setView("history")}
      className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary transition-colors"
    >
      <HistoryIcon />
      History
    </button>
  ) : null;

  return (
    <>
      <button
        onClick={() => { setView("planner"); setOpen(true); }}
        className="inline-flex items-center gap-2 text-sm font-medium text-secondary border border-border rounded-lg px-4 py-2 hover:bg-surface hover:text-primary transition-colors shrink-0"
      >
        <SparklesIcon />
        Plan Workout
      </button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title="Workout Planner"
        headerRight={historyButton}
      >
        <SuggestionPanel
          recovery={recovery}
          onDismiss={() => setOpen(false)}
          view={view}
          onViewChange={setView}
          selectedHistoryId={selectedHistoryId}
          onSelectHistoryId={setSelectedHistoryId}
        />
      </Drawer>
    </>
  );
}
