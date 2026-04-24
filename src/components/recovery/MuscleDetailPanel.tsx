"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MuscleRecovery } from "@/lib/recovery";
import { STATUS_LABELS, STATUS_COLORS } from "./recoveryColors";
import { useWorkoutStore } from "@/store/workoutStore";

type Props = {
  recovery: MuscleRecovery;
  onClose: () => void;
};

function formatRelativeTime(isoDate: string, now: number): string {
  const diff = now - new Date(isoDate).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  // Use local date methods so the displayed day matches the user's calendar
  return `${weekdays[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

function formatHoursLeft(hoursLeft: number): string {
  if (hoursLeft < 6) return "Ready";
  if (hoursLeft < 24) return `~${Math.round(hoursLeft)}h`;
  return `~${Math.round(hoursLeft / 24)}d`;
}

// Shared fade props for value-level animations (sore→sore muscle switch)
const fadeValue = {
  initial: { opacity: 0, filter: "blur(6px)" },
  animate: { opacity: 1, filter: "blur(0px)" },
  exit: { opacity: 0, filter: "blur(6px)" },
  transition: { duration: 0.18, ease: "easeInOut" as const },
};

export function MuscleDetailPanel({ recovery, onClose }: Props) {
  const {
    muscle,
    recoveryPct,
    status,
    lastTrainedAt,
    lastSessionSets,
    lastSessionReps,
    lastSessionExercises,
    lastWorkoutDuration,
    lastWorkoutNotes,
    hoursSince,
  } = recovery;

  const openDrawer = useWorkoutStore((s) => s.openDrawer);
  const [clientNow, setClientNow] = useState<number | null>(null);
  /* eslint-disable react-hooks/set-state-in-effect -- client-only mount detection for relative time display */
  useEffect(() => { setClientNow(Date.now()); }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const pctDisplay = Math.round(recoveryPct * 100);

  const estRecovery =
    hoursSince === null || recoveryPct >= 1
      ? "Ready"
      : formatHoursLeft((hoursSince * (1 - recoveryPct)) / recoveryPct);

  const barColor =
    status === "recovered"
      ? "bg-success"
      : status === "partial"
        ? "bg-recovery-yellow"
        : "bg-danger";

  return (
    <div className="bg-surface border border-border-subtle rounded-xl h-full flex flex-col overflow-y-auto">

      {/* Static chrome — never animates */}
      <div className="px-5 pt-5 flex items-center justify-between gap-3 shrink-0">
        <p className="text-xs uppercase tracking-widest text-muted font-medium">Muscle Group</p>
        <button
          onClick={onClose}
          className="text-muted hover:text-primary transition-colors p-1 rounded"
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Static recovery bar — width/color CSS-transition on muscle change */}
      <div className="px-5 pt-3 shrink-0">
        <div className="flex justify-between text-xs text-muted mb-1.5">
          <span>Recovery</span>
          <span className="font-medium text-primary">{pctDisplay}%</span>
        </div>
        <div className="h-2 bg-elevated rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${pctDisplay}%` }}
          />
        </div>
      </div>

      {/*
        Outer AnimatePresence: keyed on whether the muscle has training data.
        Transitions only when going fresh↔sore — not on every muscle switch.
        Inner AnimatePresences: keyed on `muscle`, so only values fade on sore→sore.
        Labels ("Last trained", "Exercises") live outside inner keys and stay put.
      */}
      <AnimatePresence mode="wait" initial={false}>
        {lastTrainedAt ? (
          <motion.div
            key="with-data"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
            className="px-5 pt-4 pb-5 flex flex-col gap-4 flex-1 min-h-0"
          >
            {/* Muscle name + status — always fades on muscle switch */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={muscle} {...fadeValue} className="flex items-center justify-between gap-3">
                <h3 className="font-display text-xl text-primary capitalize">{muscle}</h3>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[status]}`}>
                  {STATUS_LABELS[status]}
                </span>
              </motion.div>
            </AnimatePresence>

            {/* "Last trained" label is static; date value fades per muscle */}
            <div>
              <p className="text-xs text-muted uppercase tracking-widest mb-1">Last trained</p>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={muscle} {...fadeValue}>
                  <p className="text-sm text-primary font-medium">
                    {clientNow ? formatRelativeTime(lastTrainedAt, clientNow) : formatDate(lastTrainedAt)}
                  </p>
                  {clientNow && <p className="text-xs text-secondary">{formatDate(lastTrainedAt)}</p>}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Stats — fades per muscle */}
            {lastSessionSets !== null && (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={muscle} {...fadeValue}>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-elevated rounded-lg p-2.5 text-center">
                      <p className="text-base font-semibold text-primary">{lastSessionSets}</p>
                      <p className="text-xs text-muted">sets</p>
                    </div>
                    <div className="bg-elevated rounded-lg p-2.5 text-center">
                      <p className="text-base font-semibold text-primary">{lastSessionReps}</p>
                      <p className="text-xs text-muted">reps</p>
                    </div>
                    <div className="bg-elevated rounded-lg p-2.5 text-center">
                      <p className={`text-sm font-semibold ${estRecovery === "Ready" ? "text-success" : "text-primary"}`}>
                        {estRecovery}
                      </p>
                      <p className="text-xs text-muted">est. ready</p>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            )}

            {/*
              Exercises section: outer key="has-exercises" only animates when exercise
              presence changes (not on every muscle switch). Label stays put when both
              muscles have exercises; tags fade per muscle below it.
            */}
            <AnimatePresence mode="wait" initial={false}>
              {lastSessionExercises.length > 0 && (
                <motion.div key="has-exercises" {...fadeValue}>
                  <p className="text-xs text-muted uppercase tracking-widest mb-2">Exercises</p>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div key={muscle} {...fadeValue} className="flex flex-wrap gap-1.5">
                      {lastSessionExercises.map((ex) => (
                        <span
                          key={ex}
                          className="text-xs bg-elevated text-secondary px-2.5 py-1 rounded-full border border-border-subtle"
                        >
                          {ex}
                        </span>
                      ))}
                    </motion.div>
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Last workout card — pinned to bottom, fades per muscle */}
            {recovery.lastWorkoutId && (
              <div className="mt-auto pt-2">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={muscle} {...fadeValue}>
                    <button
                      onClick={() => openDrawer(recovery.lastWorkoutId!)}
                      className="group w-full text-left rounded-xl bg-elevated border border-border-subtle px-4 py-3.5 hover:bg-bg hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-sm text-primary group-hover:text-accent transition-colors">
                              {clientNow ? formatRelativeTime(lastTrainedAt, clientNow) : formatDate(lastTrainedAt)}
                            </p>
                            {lastWorkoutDuration && (
                              <span className="text-xs text-muted bg-surface rounded-md px-2 py-0.5 tabular-nums">
                                {lastWorkoutDuration} min
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-secondary truncate">
                            {lastSessionExercises.join(", ")}
                          </p>
                          {lastWorkoutNotes && !lastWorkoutNotes.includes("[seed]") && (
                            <p className="text-xs text-muted mt-1 truncate italic">{lastWorkoutNotes}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xl font-bold text-primary tabular-nums leading-none">{lastSessionSets}</p>
                          <p className="text-xs text-muted mt-0.5">{lastSessionSets === 1 ? "set" : "sets"}</p>
                        </div>
                      </div>
                    </button>
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        ) : (
          /* Fresh muscle — no training data, only name + status + message */
          <motion.div
            key="no-data"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
            className="px-5 pt-4 pb-5 flex flex-col gap-4 flex-1 min-h-0"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={muscle} {...fadeValue} className="flex items-center justify-between gap-3">
                <h3 className="font-display text-xl text-primary capitalize">{muscle}</h3>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[status]}`}>
                  {STATUS_LABELS[status]}
                </span>
              </motion.div>
            </AnimatePresence>
            <div className="py-2">
              <p className="text-sm text-secondary">No training data in the last 4 days.</p>
              <p className="text-xs text-muted mt-1">This muscle group is fully recovered.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
