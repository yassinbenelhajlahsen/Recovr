"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type SetEntry = { id: string; set_number: number; reps: string; weight: string };
type ExerciseEntry = {
  id: string;
  exercise_id: string;
  exercise_name: string;
  muscle_groups: string[];
  order: number;
  sets: SetEntry[];
};
type Exercise = {
  id: string;
  name: string;
  muscle_groups: string[];
  equipment: string | null;
  user_id: string | null;
};

export type WorkoutFormInitialData = {
  date: string;
  notes: string | null;
  duration_minutes: number | null;
  exercises: {
    exercise_id: string;
    exercise_name: string;
    muscle_groups: string[];
    order: number;
    sets: { set_number: number; reps: number; weight: number }[];
  }[];
};

type Props = {
  workoutId?: string;
  initialData?: WorkoutFormInitialData;
  onSave?: (data: {
    id: string;
    date: string;
    duration_minutes: number | null;
    notes: string | null;
    workout_exercises: {
      id: string;
      exercise: { id: string; name: string; muscle_groups: string[] };
      sets: { id: string; set_number: number; reps: number; weight: number }[];
    }[];
  }) => void;
  onCancel?: () => void;
  compact?: boolean;
};

let _uid = 0;
const uid = () => `local-${++_uid}`;

export function WorkoutForm({ workoutId, initialData, onSave, onCancel, compact }: Props) {
  const router = useRouter();
  const isEdit = !!workoutId;

  const [date, setDate] = useState(() => {
    if (initialData?.date) return initialData.date;
    // Build YYYY-MM-DD from UTC to avoid hydration mismatch
    const d = new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [duration, setDuration] = useState(
    initialData?.duration_minutes != null ? String(initialData.duration_minutes) : ""
  );
  const [exercises, setExercises] = useState<ExerciseEntry[]>(
    initialData?.exercises.map((ex) => ({
      id: uid(),
      exercise_id: ex.exercise_id,
      exercise_name: ex.exercise_name,
      muscle_groups: ex.muscle_groups,
      order: ex.order,
      sets: ex.sets.map((s) => ({
        id: uid(),
        set_number: s.set_number,
        reps: String(s.reps),
        weight: String(s.weight),
      })),
    })) ?? []
  );

  // Exercise search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Exercise[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchPanelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Custom exercise
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customMuscles, setCustomMuscles] = useState("");
  const [customEquipment, setCustomEquipment] = useState("");
  const [customLoading, setCustomLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchCache = useRef<Map<string, Exercise[]>>(new Map());

  const fetchExercises = useCallback(async (q: string) => {
    const cached = searchCache.current.get(q);
    if (cached) {
      setSearchResults(cached);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/exercises?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      searchCache.current.set(q, data);
      setSearchResults(data);
    } catch {
      /* ignore */
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (!showSearch) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchExercises(searchQuery), 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery, showSearch, fetchExercises]);

  // Open search: load results + focus
  useEffect(() => {
    if (showSearch) {
      fetchExercises(searchQuery);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSearch]);

  // Close on outside click
  useEffect(() => {
    if (!showSearch) return;
    const handle = (e: MouseEvent) => {
      if (!searchPanelRef.current?.contains(e.target as Node)) {
        setShowSearch(false);
        setSearchQuery("");
        setShowCustomForm(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showSearch]);

  function addExercise(ex: Exercise) {
    if (exercises.some((e) => e.exercise_id === ex.id)) return;
    setExercises((prev) => [
      {
        id: uid(),
        exercise_id: ex.id,
        exercise_name: ex.name,
        muscle_groups: ex.muscle_groups,
        order: 0,
        sets: [{ id: uid(), set_number: 1, reps: "", weight: "" }],
      },
      ...prev,
    ]);
    setShowSearch(false);
    setSearchQuery("");
    setShowCustomForm(false);
  }

  function removeExercise(localId: string) {
    setExercises((prev) => prev.filter((e) => e.id !== localId));
  }

  function addSet(exId: string) {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id !== exId
          ? ex
          : {
              ...ex,
              sets: [
                ...ex.sets,
                { id: uid(), set_number: ex.sets.length + 1, reps: "", weight: "" },
              ],
            }
      )
    );
  }

  function removeSet(exId: string, setId: string) {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id !== exId
          ? ex
          : {
              ...ex,
              sets: ex.sets
                .filter((s) => s.id !== setId)
                .map((s, i) => ({ ...s, set_number: i + 1 })),
            }
      )
    );
  }

  function updateSet(exId: string, setId: string, field: "reps" | "weight", value: string) {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id !== exId
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s)),
            }
      )
    );
  }

  async function createCustomExercise() {
    if (!customName.trim() || !customMuscles.trim()) return;
    setCustomLoading(true);
    try {
      const muscle_groups = customMuscles
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);
      const res = await fetch("/api/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: customName.trim(),
          muscle_groups,
          equipment: customEquipment.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();
      addExercise(await res.json());
      searchCache.current.clear();
      setCustomName("");
      setCustomMuscles("");
      setCustomEquipment("");
    } catch {
      setError("Failed to create custom exercise");
    } finally {
      setCustomLoading(false);
    }
  }

  async function handleSubmit() {
    if (exercises.length === 0) {
      setError("Add at least one exercise");
      return;
    }
    for (const ex of exercises) {
      for (const s of ex.sets) {
        if (!s.reps || !s.weight) {
          setError(`Fill in reps and weight for all sets in ${ex.exercise_name}`);
          return;
        }
      }
    }
    setError("");
    setSaving(true);
    try {
      const body = {
        date,
        notes: notes || null,
        duration_minutes: duration || null,
        exercises: exercises.map((ex, i) => ({
          exercise_id: ex.exercise_id,
          order: i,
          sets: ex.sets.map((s) => ({
            set_number: s.set_number,
            reps: s.reps,
            weight: s.weight,
          })),
        })),
      };
      const res = await fetch(
        isEdit ? `/api/workouts/${workoutId}` : "/api/workouts",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) throw new Error();
      const { id } = await res.json();
      if (onSave) {
        onSave({
          id,
          date,
          duration_minutes: duration ? Number(duration) : null,
          notes: notes || null,
          workout_exercises: exercises.map((ex, i) => ({
            id: `local-we-${i}`,
            exercise: { id: ex.exercise_id, name: ex.exercise_name, muscle_groups: ex.muscle_groups },
            sets: ex.sets.map((s) => ({
              id: s.id,
              set_number: s.set_number,
              reps: Number(s.reps),
              weight: Number(s.weight),
            })),
          })),
        });
      } else {
        router.push(`/workouts/${id}`);
        router.refresh();
      }
    } catch {
      setError("Failed to save workout. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className={compact ? "space-y-5" : "space-y-8"}>
      {/* Details */}
      <div className={compact ? "space-y-4" : "rounded-xl bg-surface border border-border-subtle p-6 space-y-5"}>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider">
          Details
        </p>
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
              onClick={() => setShowSearch(true)}
              className="flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
            >
              <span className="text-base leading-none">+</span> Add Exercise
            </button>
          )}
        </div>

        {/* Inline exercise search */}
        {showSearch && (
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
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm text-primary placeholder-muted focus:outline-none"
              />
              <button
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery("");
                  setShowCustomForm(false);
                }}
                className="text-muted hover:text-primary transition-colors p-0.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Results */}
            <div className="max-h-52 overflow-y-auto">
              {searchLoading && (
                <p className="text-sm text-muted text-center py-6">Searching…</p>
              )}
              {!searchLoading && searchResults.length === 0 && (
                <p className="text-sm text-muted text-center py-6">No exercises found</p>
              )}
              {!searchLoading &&
                searchResults.map((ex) => {
                  const already = exercises.some((e) => e.exercise_id === ex.id);
                  return (
                    <button
                      key={ex.id}
                      onClick={() => addExercise(ex)}
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
                        <p className="text-xs text-muted mt-0.5">
                          {ex.muscle_groups.join(", ")}
                        </p>
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
                    </button>
                  );
                })}
            </div>

            {/* Custom exercise */}
            <div className="border-t border-border p-4">
              {!showCustomForm ? (
                <button
                  onClick={() => setShowCustomForm(true)}
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
                      onClick={createCustomExercise}
                      disabled={customLoading || !customName.trim() || !customMuscles.trim()}
                      className="flex-1 bg-accent text-white text-sm font-semibold rounded-lg py-2.5 hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {customLoading ? "Creating…" : "Create & Add"}
                    </button>
                    <button
                      onClick={() => setShowCustomForm(false)}
                      className="px-4 text-sm text-secondary hover:text-primary transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {exercises.length === 0 && !showSearch && (
          <div className="rounded-xl bg-surface border border-border-subtle border-dashed p-12 text-center">
            <p className="font-display text-xl text-muted">No exercises added yet</p>
            <p className="text-sm text-muted mt-1">Tap &ldquo;Add Exercise&rdquo; to get started</p>
          </div>
        )}

        {exercises.map((ex) => (
          <div
            key={ex.id}
            className="rounded-xl bg-surface border border-border-subtle overflow-hidden"
          >
            <div className="flex items-start justify-between px-5 py-4 border-b border-border">
              <div>
                <p className="font-semibold text-primary">
                  {ex.exercise_name}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {ex.muscle_groups.map((m) => (
                    <span
                      key={m}
                      className="text-xs text-muted bg-bg rounded-md px-2 py-0.5"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => removeExercise(ex.id)}
                className="text-muted hover:text-danger transition-colors p-1 -mr-1 -mt-0.5 shrink-0"
                aria-label="Remove exercise"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4">
              <div className="grid grid-cols-[40px_1fr_1fr_28px] gap-2 mb-3 text-[11px] font-semibold text-muted uppercase tracking-wider">
                <span>Set</span>
                <span>Reps</span>
                <span>LBS</span>
                <span />
              </div>
              {ex.sets.map((s) => (
                <div key={s.id} className="grid grid-cols-[40px_1fr_1fr_28px] gap-2 mb-2 items-center">
                  <span className="text-sm font-medium text-muted tabular-nums">
                    {s.set_number}
                  </span>
                  <input
                    type="number"
                    min="1"
                    placeholder="10"
                    value={s.reps}
                    onChange={(e) => updateSet(ex.id, s.id, "reps", e.target.value)}
                    className="min-w-0 w-full rounded-lg border border-border bg-elevated px-2.5 py-2 text-sm text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="60"
                    value={s.weight}
                    onChange={(e) => updateSet(ex.id, s.id, "weight", e.target.value)}
                    className="min-w-0 w-full rounded-lg border border-border bg-elevated px-2.5 py-2 text-sm text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
                  />
                  <button
                    onClick={() => removeSet(ex.id, s.id)}
                    disabled={ex.sets.length === 1}
                    className="flex items-center justify-center text-muted hover:text-danger disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                    aria-label="Remove set"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              <button
                onClick={() => addSet(ex.id)}
                className="mt-2 text-xs font-semibold text-accent hover:underline"
              >
                + Add set
              </button>
            </div>
          </div>
        ))}

        {/* Add more exercises after list */}
        {exercises.length > 0 && !showSearch && (
          <button
            onClick={() => setShowSearch(true)}
            className="w-full rounded-xl border border-border-subtle border-dashed py-3 text-sm font-semibold text-muted hover:text-accent hover:border-accent transition-colors"
          >
            + Add Exercise
          </button>
        )}
      </div>

      {error && <p className="text-sm text-danger font-medium">{error}</p>}

      {/* Actions */}
      <div className="flex items-center gap-4 pt-2">
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
    </div>
  );
}
