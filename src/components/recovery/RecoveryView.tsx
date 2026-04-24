"use client";

import { AnimatePresence, motion } from "framer-motion";
import useSWR from "swr";
import { BodyMapFront } from "./BodyMapFront";
import { BodyMapBack } from "./BodyMapBack";
import { MuscleDetailPanel } from "./MuscleDetailPanel";
import { useRecoverySelection } from "./hooks/useRecoverySelection";
import { WorkoutDetailDrawer } from "@/components/workout/WorkoutDetailDrawer";
import { useRecovery } from "@/lib/hooks";
import { FetchError } from "@/components/ui/FetchError";
import { normalizeGender } from "@/lib/utils";
import type { UserProfile } from "@/types/user";

export function RecoveryView() {
  const { data: recovery = [], error: recoveryError, mutate: mutateRecovery } = useRecovery();
  // Reuse the same SWR key as useNavbar — already warm from layout mount
  const { data: profile } = useSWR<UserProfile>("/api/user/profile", {
    dedupingInterval: 30_000,
  });
  // Wait until profile has loaded before rendering body maps to prevent
  // a flash from male (default) → actual gender on page load.
  const profileReady = profile !== undefined;
  const gender = normalizeGender(profile?.gender);
  const {selectedData, muscleMap, handleSelect, clearSelection, fatigued, partial, recovered } =
    useRecoverySelection(recovery);

  if (recoveryError) return <FetchError onRetry={() => mutateRecovery()} />;

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
              {profileReady ? (
                <BodyMapFront
                  muscles={muscleMap}
                  onSelectMuscle={handleSelect}
                  gender={gender}
                />
              ) : (
                <div style={{ aspectRatio: "160 / 340" }} />
              )}
            </div>
          </div>
          <div className="flex-1 bg-surface border border-border-subtle rounded-xl p-4">
            <p className="text-xs uppercase tracking-widest text-muted text-center mb-3">Back</p>
            <div className="mx-auto" style={{ maxWidth: 200 }}>
              {profileReady ? (
                <BodyMapBack
                  muscles={muscleMap}
                  onSelectMuscle={handleSelect}
                  gender={gender}
                />
              ) : (
                <div style={{ aspectRatio: "160 / 340" }} />
              )}
            </div>
          </div>
        </div>

        {/* Detail panel — always same height as maps */}
        <div className="lg:w-72 xl:w-80 flex flex-col">
          <AnimatePresence mode="wait" initial={false}>
            {selectedData ? (
              <motion.div
                key="panel"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="flex-1 flex flex-col min-h-0"
              >
                <MuscleDetailPanel
                  recovery={selectedData}
                  onClose={clearSelection}
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
