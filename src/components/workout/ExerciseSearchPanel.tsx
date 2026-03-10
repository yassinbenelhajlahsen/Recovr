"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Exercise, ExerciseEntry } from "@/types/workout";

type Props = {
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  searchResults: Exercise[];
  searchLoading: boolean;
  searchPanelRef: React.RefObject<HTMLDivElement>;
  searchInputRef: React.RefObject<HTMLInputElement>;
  exercises: ExerciseEntry[];
  onAddExercise: (ex: Exercise) => void;
  onClose: () => void;
  showCustomForm: boolean;
  onShowCustomFormChange: (show: boolean) => void;
  onCreateCustomExercise: (name: string, muscles: string, equipment: string) => Promise<void>;
  customLoading: boolean;
};

export function ExerciseSearchPanel({
  searchQuery,
  onSearchQueryChange,
  searchResults,
  searchLoading,
  searchPanelRef,
  searchInputRef,
  exercises,
  onAddExercise,
  onClose,
  showCustomForm,
  onShowCustomFormChange,
  onCreateCustomExercise,
  customLoading,
}: Props) {
  const [customName, setCustomName] = useState("");
  const [customMuscles, setCustomMuscles] = useState("");
  const [customEquipment, setCustomEquipment] = useState("");

  async function handleCreate() {
    await onCreateCustomExercise(customName, customMuscles, customEquipment);
    setCustomName("");
    setCustomMuscles("");
    setCustomEquipment("");
  }

  return (
    <div
      ref={searchPanelRef}
      className="rounded-xl border border-border bg-elevated overflow-hidden"
    >
      {/* Search input */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <svg
          className="text-muted shrink-0"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search by name or muscle…"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          className="flex-1 bg-transparent text-sm text-primary placeholder-muted focus:outline-none"
        />
        <button
          onClick={onClose}
          className="text-muted hover:text-primary transition-colors p-0.5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Results */}
      <div className="max-h-52 overflow-y-auto">
        <AnimatePresence mode="wait" initial={false}>
          {searchLoading ? (
            <motion.p
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="text-sm text-muted text-center py-6"
            >
              Searching…
            </motion.p>
          ) : searchResults.length === 0 ? (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="text-sm text-muted text-center py-6"
            >
              No exercises found
            </motion.p>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              {searchResults.map((ex, i) => {
                const already = exercises.some((e) => e.exercise_id === ex.id);
                return (
                  <motion.button
                    key={ex.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.12, delay: i * 0.03, ease: "easeOut" }}
                    onClick={() => onAddExercise(ex)}
                    disabled={already}
                    className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-surface transition-colors border-b border-border-subtle last:border-0 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div>
                      <p className="text-sm font-medium text-primary">
                        {ex.name}
                        {ex.user_id && (
                          <span className="ml-2 text-[11px] font-normal text-muted bg-surface rounded px-1.5 py-0.5">
                            custom
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted mt-0.5">{ex.muscle_groups.join(", ")}</p>
                    </div>
                    {already ? (
                      <span className="text-xs text-muted shrink-0">Added</span>
                    ) : (
                      <svg
                        className="text-accent shrink-0"
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    )}
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Custom exercise */}
      <div className="border-t border-border p-4">
        {!showCustomForm ? (
          <button
            onClick={() => onShowCustomFormChange(true)}
            className="text-sm font-semibold text-accent hover:underline"
          >
            + Create custom exercise
          </button>
        ) : (
          <div className="space-y-2.5">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">
              New exercise
            </p>
            <input
              type="text"
              placeholder="Name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
            />
            <input
              type="text"
              placeholder="Muscle groups (e.g. chest, triceps)"
              value={customMuscles}
              onChange={(e) => setCustomMuscles(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
            />
            <input
              type="text"
              placeholder="Equipment (optional)"
              value={customEquipment}
              onChange={(e) => setCustomEquipment(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleCreate}
                disabled={customLoading || !customName.trim() || !customMuscles.trim()}
                className="flex-1 bg-accent text-white text-sm font-semibold rounded-lg py-2.5 hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {customLoading ? "Creating…" : "Create & Add"}
              </button>
              <button
                onClick={() => onShowCustomFormChange(false)}
                className="px-4 text-sm text-secondary hover:text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
