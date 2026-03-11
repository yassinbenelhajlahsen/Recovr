"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SparklesIcon, AsteriskIcon } from "@/components/ui/icons";
import { useSuggestion } from "./hooks/useSuggestion";
import { useSaveDraft } from "./hooks/useSaveDraft";
import { useWorkoutStore } from "@/store/workoutStore";
import type { SuggestedExercise } from "@/types/suggestion";
import type { MuscleRecovery, RecoveryStatus } from "@/types/recovery";

interface SuggestionPanelProps {
  recovery: MuscleRecovery[];
  onDismiss?: () => void;
}

const STATUS_ORDER: Record<RecoveryStatus, number> = {
  recovered: 0,
  partial: 1,
  fatigued: 2,
};

const STATUS_PILL: Record<RecoveryStatus, string> = {
  recovered: "text-success bg-success/10 border-success/20",
  partial:
    "text-recovery-yellow bg-recovery-yellow/10 border-recovery-yellow/20",
  fatigued: "text-danger bg-danger/10 border-danger/20",
};

const PRESET_GROUPS = [
  {
    label: "Focus",
    options: ["Upper body", "Lower body", "Full body", "Core"],
  },
  {
    label: "Duration",
    options: ["30 minutes", "45 minutes", "60 minutes"],
  },
  {
    label: "Equipment",
    options: [
      "No equipment",
      "Dumbbells only",
      "Barbell + rack",
      "Cable machine",
    ],
  },
  {
    label: "Style",
    options: ["Strength", "Hypertrophy", "HIIT", "Active recovery"],
  },
];

export function SuggestionPanel({ recovery, onDismiss }: SuggestionPanelProps) {
  const { suggestion, isLoading, error, generate, dismiss, cooldownLabel, draftId, setDraftId, isInitializing } = useSuggestion();
  const { saveDraft, saving, saveError } = useSaveDraft();
  const openDrawer = useWorkoutStore((s) => s.openDrawer);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function togglePreset(option: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(option)) next.delete(option);
      else next.add(option);
      return next;
    });
  }

  function handleDismiss() {
    dismiss();
    onDismiss?.();
  }

  async function handleSaveAsDraft() {
    if (!suggestion) return;
    const id = await saveDraft(suggestion);
    if (id) {
      setDraftId(id);
      onDismiss?.();
      openDrawer(id);
    }
  }

  async function handleGoToWorkout() {
    if (!draftId) return;
    const res = await fetch(`/api/workouts/${draftId}`);
    if (res.status === 404) {
      setDraftId(null);
      return;
    }
    onDismiss?.();
    openDrawer(draftId);
  }

  // Sorted: recovered first, then partial, then fatigued
  const sortedMuscles = useMemo(
    () =>
      [...recovery].sort(
        (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
      ),
    [recovery],
  );

  return (
    <div className="flex-1 flex flex-col h-full">
      <AnimatePresence mode="wait" initial={false}>
        {isInitializing ? (
          <motion.div
            key="init"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="flex-1"
          />
        ) : isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 p-6 flex flex-col gap-5"
          >
            {/* Animated status */}
            <div className="flex items-center gap-2.5 text-accent">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <AsteriskIcon />
              </motion.div>
              <p className="text-xs uppercase tracking-widest font-medium text-muted">
                Analyzing...
              </p>
            </div>

            {/* Title skeleton */}
            <div className="space-y-2">
              <div className="skeleton h-6 w-2/3 rounded" />
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-4/5 rounded" />
            </div>

            {/* Divider */}
            <div className="border-t border-border-subtle" />

            {/* Exercise skeletons */}
            <div className="flex flex-col gap-3">
              <div className="skeleton h-3 w-20 rounded" />
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="bg-surface border border-border-subtle rounded-xl p-4 space-y-2.5"
                >
                  <div className="flex justify-between">
                    <div className="skeleton h-4 w-2/5 rounded" />
                    <div className="skeleton h-4 w-1/4 rounded" />
                  </div>
                  <div className="flex gap-1.5">
                    <div className="skeleton h-5 w-14 rounded-full" />
                    <div className="skeleton h-5 w-16 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ) : suggestion ? (
          <motion.div
            key="result"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {/* Plan header */}
            <div className="px-6 pt-6 pb-5 border-b border-border-subtle">
              <div className="flex items-start justify-between gap-3 mb-3">
                <h2 className="font-display text-2xl text-primary italic leading-tight">
                  {suggestion.title}
                </h2>
                <div className="flex flex-col items-end gap-1.5 shrink-0 mt-1">
                  <span className="text-xs bg-surface border border-border-subtle text-muted px-2.5 py-1 rounded-full tabular-nums">
                    ~{suggestion.estimatedMinutes}m
                  </span>
                  {cooldownLabel && (
                    <span className="text-s text-muted/70 tabular-nums">
                      New in {cooldownLabel}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm text-secondary leading-relaxed">
                {suggestion.rationale}
              </p>
            </div>

            {/* Exercise list — scrollable */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5">
              <p className="text-xs uppercase tracking-widest text-muted font-medium mb-3">
                Exercises · {suggestion.exercises.length}
              </p>
              <div className="flex flex-col gap-2.5">
                {suggestion.exercises.map((ex, i) => (
                  <ExerciseCard key={i} exercise={ex} index={i} />
                ))}
              </div>
            </div>

            {/* Sticky footer */}
            <div className="w-full border-t border-border-subtle bg-elevated shrink-0">
              {saveError && (
                <p className="text-xs text-danger text-center px-4 pt-3">
                  {saveError}
                </p>
              )}
              <div className="flex">
                <button
                  onClick={handleDismiss}
                  className="flex-1 text-md font-medium text-muted py-4 hover:text-secondary hover:bg-surface transition-colors border-r border-border-subtle"
                >
                  Dismiss
                </button>
                {draftId ? (
                  <button
                    onClick={handleGoToWorkout}
                    className="flex-1 text-md font-medium text-accent py-4 hover:bg-surface transition-colors"
                  >
                    View workout
                  </button>
                ) : (
                  <button
                    onClick={handleSaveAsDraft}
                    disabled={saving}
                    className="flex-1 text-md font-medium text-accent py-4 hover:bg-surface transition-colors disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save as Draft"}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 flex flex-col px-6 py-8 overflow-y-auto overscroll-contain"
          >
            {/* Header — icon + title + description */}
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center text-accent [&>svg]:w-6 [&>svg]:h-6">
                <SparklesIcon />
              </div>
              <div className="space-y-2 max-w-xs">
                <h2 className="font-display text-2xl text-primary italic">
                  Plan your next session
                </h2>
                <p className="text-sm text-secondary leading-relaxed">
                  Get a workout built around your current recovery
                </p>
              </div>
            </div>

            {/* Muscle cloud — flat, status encoded by dot color only */}
            <div className="mt-6">
              <p className="text-xs uppercase tracking-widest text-muted font-medium mb-3">
                Muscle status
              </p>
              <div className="flex flex-wrap gap-1.5">
                {sortedMuscles.map((m, i) => (
                  <motion.span
                    key={m.muscle}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                      duration: 0.14,
                      delay: i * 0.022,
                      ease: "easeOut",
                    }}
                    className={`text-xs px-2.5 py-1 rounded-full border capitalize ${STATUS_PILL[m.status]}`}
                  >
                    {m.muscle}
                  </motion.span>
                ))}
              </div>
            </div>

            {/* Preset chips — tactile multi-select */}
            <div className="mt-6 flex flex-col gap-4">
              {PRESET_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="text-xs uppercase tracking-widest text-muted font-medium mb-2">
                    {group.label}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.options.map((option) => {
                      const active = selected.has(option);
                      return (
                        <motion.button
                          key={option}
                          onClick={() => togglePreset(option)}
                          whileTap={{ scale: 0.92 }}
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 18,
                          }}
                          className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors duration-150 ${
                            active
                              ? "bg-accent text-white border-accent"
                              : "bg-surface border-border-subtle text-secondary hover:bg-elevated hover:text-primary"
                          }`}
                        >
                          {option}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="flex flex-col gap-2 mt-6">
              {error && (
                <p className="text-xs text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2 text-center">
                  {error}
                </p>
              )}
              <button
                onClick={() =>
                  generate(selected.size > 0 ? Array.from(selected) : undefined)
                }
                className="w-full bg-accent text-white text-sm font-medium rounded-xl px-4 py-3 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <SparklesIcon />
                Plan my next workout
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ExerciseCard({
  exercise,
  index,
}: {
  exercise: SuggestedExercise;
  index: number;
}) {
  const setsSummary = (() => {
    if (!exercise.sets.length) return "";
    const first = exercise.sets[0];
    const allSameReps = exercise.sets.every((s) => s.reps === first.reps);
    const allSameWeight = exercise.sets.every((s) => s.weight === first.weight);
    const count = exercise.sets.length;

    if (allSameReps && allSameWeight) {
      const weightLabel =
        first.weight == null ? "bodyweight" : `${first.weight} lbs`;
      return `${count} × ${first.reps} @ ${weightLabel}`;
    }
    return exercise.sets
      .map((s) => `${s.reps} @ ${s.weight == null ? "BW" : `${s.weight} lbs`}`)
      .join(", ");
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: index * 0.04, ease: "easeOut" }}
      className="bg-surface border border-border-subtle rounded-xl px-4 py-3.5"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-primary leading-snug">
          {exercise.name}
        </p>
        {setsSummary && (
          <span className="text-xs text-muted shrink-0 tabular-nums mt-0.5">
            {setsSummary}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {exercise.muscleGroups.map((mg) => (
          <span
            key={mg}
            className="text-xs bg-elevated text-secondary px-2 py-0.5 rounded-full border border-border-subtle capitalize"
          >
            {mg}
          </span>
        ))}
      </div>
      {exercise.notes && (
        <p className="text-xs text-muted italic mt-2 leading-relaxed">
          {exercise.notes}
        </p>
      )}
    </motion.div>
  );
}
