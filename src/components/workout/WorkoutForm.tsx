"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

import { useExerciseList } from "@/components/workout/hooks/useExerciseList";
import { useExerciseSearch } from "@/components/workout/hooks/useExerciseSearch";
import { useWorkoutForm } from "@/components/workout/hooks/useWorkoutForm";
import { ExerciseSearchPanel } from "@/components/workout/ExerciseSearchPanel";
import { ExerciseCard } from "@/components/workout/ExerciseCard";

import type { Exercise, WorkoutFormProps as Props } from "@/types/workout";

export function WorkoutForm({ workoutId, initialData, onSave, onCancel, compact }: Props) {
  const isEdit = !!workoutId;

  const { exercises, addExercise, removeExercise, addSet, removeSet, updateSet } =
    useExerciseList(initialData);

  const {
    showSearch,
    searchQuery,
    setSearchQuery,
    searchResults,
    searchLoading,
    searchPanelRef,
    searchInputRef,
    showCustomForm,
    setShowCustomForm,
    openSearch,
    closeSearch,
    clearCache,
  } = useExerciseSearch();

  const {
    date,
    setDate,
    notes,
    setNotes,
    duration,
    setDuration,
    saving,
    error,
    customLoading,
    handleSubmit,
    createCustomExercise,
  } = useWorkoutForm({
    workoutId,
    initialData,
    exercises,
    onSave,
    addExercise,
    closeSearch,
    clearCache,
  });

  function handleAddExercise(ex: Exercise) {
    addExercise(ex);
    closeSearch();
  }

  const actionButtons = (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="bg-accent text-white text-sm font-semibold rounded-lg px-6 py-3 hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving…" : isEdit ? "Save Changes" : "Log Workout"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-medium text-secondary hover:text-primary transition-colors"
          >
            Cancel
          </button>
        ) : (
          <Link
            href={isEdit ? `/workouts/${workoutId}` : "/workouts"}
            className="text-sm font-medium text-secondary hover:text-primary transition-colors"
          >
            Cancel
          </Link>
        )}
      </div>
      {error && <p className="text-sm text-danger font-medium">{error}</p>}
    </div>
  );

  return (
    <div className={compact ? "space-y-5" : "space-y-8"}>
      {isEdit && actionButtons}

      {/* Details */}
      <div className={compact ? "space-y-4" : "rounded-xl bg-surface border border-border-subtle p-6 space-y-5"}>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider">Details</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-elevated px-3.5 py-2.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted">
              Duration (min)
            </label>
            <input
              type="number"
              min="1"
              placeholder="60"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full rounded-lg border border-border bg-elevated px-3.5 py-2.5 text-sm text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted">
            Notes <span className="normal-case tracking-normal font-normal">(optional)</span>
          </label>
          <textarea
            rows={2}
            placeholder="How did it go?"
            value={notes as string}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-border bg-elevated px-3.5 py-2.5 text-sm text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors resize-none"
          />
        </div>
      </div>

      {/* Exercises */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Exercises</p>
          {!showSearch && (
            <button
              onClick={openSearch}
              className="flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
            >
              <span className="text-base leading-none">+</span> Add Exercise
            </button>
          )}
        </div>

        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              <ExerciseSearchPanel
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                searchResults={searchResults}
                searchLoading={searchLoading}
                searchPanelRef={searchPanelRef}
                searchInputRef={searchInputRef}
                exercises={exercises}
                onAddExercise={handleAddExercise}
                onClose={closeSearch}
                showCustomForm={showCustomForm}
                onShowCustomFormChange={setShowCustomForm}
                onCreateCustomExercise={createCustomExercise}
                customLoading={customLoading}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {exercises.length === 0 && !showSearch && (
          <div className="rounded-xl bg-surface border border-border-subtle border-dashed p-12 text-center">
            <p className="font-display text-xl text-muted">No exercises added yet</p>
            <p className="text-sm text-muted mt-1">Tap &ldquo;Add Exercise&rdquo; to get started</p>
          </div>
        )}

        {exercises.map((ex) => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            onRemoveExercise={removeExercise}
            onAddSet={addSet}
            onRemoveSet={removeSet}
            onUpdateSet={updateSet}
          />
        ))}

        {exercises.length > 0 && !showSearch && (
          <button
            onClick={openSearch}
            className="w-full rounded-xl border border-border-subtle border-dashed py-3 text-sm font-semibold text-muted hover:text-accent hover:border-accent transition-colors"
          >
            + Add Exercise
          </button>
        )}
      </div>

      {!isEdit && actionButtons}
    </div>
  );
}
