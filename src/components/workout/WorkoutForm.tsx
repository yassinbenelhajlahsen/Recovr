"use client";

import { useMemo, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

import { useExerciseList } from "@/components/workout/hooks/useExerciseList";
import { useExerciseSearch } from "@/components/workout/hooks/useExerciseSearch";
import { useWorkoutForm } from "@/components/workout/hooks/useWorkoutForm";
import { useVoiceRecorder } from "@/components/workout/hooks/useVoiceRecorder";
import { ExerciseSearchPanel } from "@/components/workout/ExerciseSearchPanel";
import { ExerciseCard } from "@/components/workout/ExerciseCard";
import { VoiceInput } from "@/components/workout/VoiceInput";
import { VoiceResultPanel } from "@/components/workout/VoiceResultPanel";

import { toLocalISODate } from "@/lib/utils";
import type { Exercise, WorkoutFormProps as Props } from "@/types/workout";
import type { VoiceTranscribeResponse } from "@/types/voice";

export function WorkoutForm({ workoutId, initialData, onSave, onDraftSave, onCancel, compact }: Props) {
  const isEdit = !!workoutId;

  const today = useMemo(() => toLocalISODate(), []);

  const { exercises, addExercise, removeExercise, addSet, removeSet, updateSet, bulkAddExercises } =
    useExerciseList(initialData);

  const isFormComplete = useMemo(
    () =>
      exercises.length > 0 &&
      exercises.every((ex) => ex.sets.length > 0 && ex.sets.every((s) => s.reps && s.weight)),
    [exercises]
  );

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
    bodyWeight,
    setBodyWeight,
    saving,
    savingDraft,
    error,
    customLoading,
    handleSubmit,
    handleSaveAsDraft,
    createCustomExercise,
  } = useWorkoutForm({
    workoutId,
    initialData,
    exercises,
    onSave,
    onDraftSave,
    addExercise,
    closeSearch,
    clearCache,
  });

  const {
    voiceState,
    error: voiceError,
    elapsed,
    transcript,
    result: voiceResult,
    startRecording,
    stopRecording,
    processAudio,
    reparse,
    reset: resetVoice,
  } = useVoiceRecorder();

  function handleAddExercise(ex: Exercise) {
    addExercise(ex);
    closeSearch();
  }

  function handleVoiceExercises(result: VoiceTranscribeResponse) {
    bulkAddExercises(result.exercises);
    if (result.unmatched.length > 0) clearCache();
    resetVoice();
  }

  const handleVoiceToggle = useCallback(async () => {
    if (voiceState === "idle" || voiceState === "error" || voiceState === "done") {
      await startRecording();
    } else if (voiceState === "recording") {
      const blob = await stopRecording();
      if (blob.size > 0) {
        await processAudio(blob);
      } else {
        resetVoice();
      }
    }
  }, [voiceState, startRecording, stopRecording, processAudio, resetVoice]);

  const handleReparse = useCallback(async (text: string) => {
    await reparse(text);
  }, [reparse]);

  const actionButtons = (
    <div className="sticky bottom-0 -mx-5 px-5 pt-4 pb-5 bg-elevated border-t border-border">
      <div className="flex items-center justify-center gap-4 overflow-hidden h-11">
        <AnimatePresence initial={false}>
          {(isEdit || isFormComplete) && (
            <motion.div
              key="primary-actions"
              className="flex items-center gap-4"
              initial={{ opacity: 0, x: -16, width: 0 }}
              animate={{ opacity: 1, x: 0, width: "auto" }}
              exit={{ opacity: 0, x: -16, width: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <button
                onClick={handleSubmit}
                disabled={saving || savingDraft}
                className="shrink-0 bg-accent text-white text-sm font-semibold rounded-lg px-6 py-3 hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? "Saving…" : isEdit ? "Save Changes" : "Log Workout"}
              </button>
              {!isEdit && (
                <button
                  type="button"
                  onClick={handleSaveAsDraft}
                  disabled={saving || savingDraft}
                  className="shrink-0 text-sm font-medium text-secondary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {savingDraft ? "Saving…" : "Save as Draft"}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-medium text-muted hover:text-secondary transition-colors"
          >
            Cancel
          </button>
        ) : (
          <Link
            href={isEdit ? `/workouts/${workoutId}` : "/workouts"}
            className="text-sm font-medium text-muted hover:text-secondary transition-colors"
          >
            Cancel
          </Link>
        )}
      </div>
      {error && <p className="text-sm text-danger font-medium text-center mt-1">{error}</p>}
    </div>
  );

  return (
    <div className={compact ? "space-y-5" : "space-y-8"}>
      {/* Details */}
      <div className={compact ? "space-y-4" : "rounded-xl bg-surface border border-border-subtle p-6 space-y-5"}>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider">Details</p>
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-1.5 flex-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted">Date</label>
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-elevated px-3.5 py-2.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
            />
          </div>
          <div className="space-y-1.5 w-20">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted">
              MinS
            </label>
            <input
              type="number"
              min="1"
              placeholder="60"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full rounded-lg border border-border bg-elevated px-2.5 py-2.5 text-sm text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
            />
          </div>
          <div className="space-y-1.5 w-20">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted">
              WEIGHT
            </label>
            <input
              type="number"
              min="1"
              step="0.1"
              placeholder="175"
              value={bodyWeight}
              onChange={(e) => setBodyWeight(e.target.value)}
              className="w-full rounded-lg border border-border bg-elevated px-2.5 py-2.5 text-sm text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
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
          <div className="flex items-center gap-2">
            <VoiceInput
              voiceState={voiceState}
              elapsed={elapsed}
              error={voiceError}
              disabled={saving || savingDraft}
              onToggle={handleVoiceToggle}
              onReset={resetVoice}
            />
            {!showSearch && (
              <button
                onClick={openSearch}
                className="flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
              >
                <span className="text-base leading-none">+</span> Add Exercise
              </button>
            )}
          </div>
        </div>

        {voiceState === "done" && voiceResult && transcript && (
          <VoiceResultPanel
            transcript={transcript}
            result={voiceResult}
            onAdd={handleVoiceExercises}
            onReparse={handleReparse}
            onDiscard={resetVoice}
          />
        )}

        <AnimatePresence mode="popLayout">
          {showSearch ? (
            <motion.div
              key="search"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
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
          ) : exercises.length === 0 && voiceState !== "done" ? (
            <motion.div
              key="empty-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="rounded-xl bg-surface border border-border-subtle border-dashed p-12 text-center"
            >
              <p className="font-display text-xl text-muted">No exercises added yet</p>
              <p className="text-sm text-muted mt-1">Tap &ldquo;Add Exercise&rdquo; or use the mic to get started</p>
            </motion.div>
          ) : null}
        </AnimatePresence>

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

      {actionButtons}
    </div>
  );
}
