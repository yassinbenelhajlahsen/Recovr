"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { MuscleRecovery } from "@/types/recovery";
import { BodyMapFront } from "./BodyMapFront";
import { BodyMapBack } from "./BodyMapBack";
import { MuscleDetailPanel } from "./MuscleDetailPanel";
import { useRecoverySelection } from "./hooks/useRecoverySelection";
import { WorkoutDetailDrawer } from "@/components/workout/WorkoutDetailDrawer";

type Props = {
  recovery: MuscleRecovery[];
};

export function RecoveryView({ recovery }: Props) {
  const { selectedMuscle, selectedData, muscleMap, handleSelect, fatigued, partial, recovered } =
    useRecoverySelection(recovery);

  return (
    <div className="flex flex-col gap-6">
      {/* Summary stats bar */}
      <div className="flex gap-4 flex-wrap">
        <StatPill label="Recovered" count={recovered} colorClass="text-success bg-success/10" />
        <StatPill label="Recovering" count={partial} colorClass="text-recovery-yellow bg-recovery-yellow/10" />
        <StatPill label="Fatigued" count={fatigued} colorClass="text-danger bg-danger/10" />
      </div>

      {/* Maps + detail */}
      <div className="flex flex-col lg:flex-row lg:items-stretch gap-4">
        {/* Body maps */}
        <div className="flex flex-row gap-4 flex-1 min-w-0">
          <div className="flex-1 bg-surface border border-border-subtle rounded-xl p-4">
            <p className="text-xs uppercase tracking-widest text-muted text-center mb-3">Front</p>
            <div className="mx-auto" style={{ maxWidth: 200 }}>
              <BodyMapFront
                muscles={muscleMap}
                onSelectMuscle={handleSelect}
              />
            </div>
          </div>
          <div className="flex-1 bg-surface border border-border-subtle rounded-xl p-4">
            <p className="text-xs uppercase tracking-widest text-muted text-center mb-3">Back</p>
            <div className="mx-auto" style={{ maxWidth: 200 }}>
              <BodyMapBack
                muscles={muscleMap}
                onSelectMuscle={handleSelect}
              />
            </div>
          </div>
        </div>

        {/* Detail panel — always same height as maps */}
        <div className="lg:w-72 xl:w-80 flex flex-col">
          <AnimatePresence mode="wait" initial={false}>
            {selectedData ? (
              <motion.div
                key={selectedData.muscle}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="flex-1 flex flex-col min-h-0"
              >
                <MuscleDetailPanel
                  recovery={selectedData}
                  onClose={() => handleSelect(selectedMuscle!)}
                />
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="bg-surface border border-border-subtle rounded-xl flex-1 flex flex-col items-center justify-center text-center gap-2"
              >
                <p className="text-sm text-secondary">Tap a muscle group to see details</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <WorkoutDetailDrawer />
    </div>
  );
}

function StatPill({ label, count, colorClass }: { label: string; count: number; colorClass: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${colorClass}`}>
      <span className="text-base font-semibold">{count}</span>
      <span className="opacity-80">{label}</span>
    </div>
  );
}
