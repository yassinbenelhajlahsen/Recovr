import { useState, useMemo, useCallback } from "react";
import type { MuscleRecovery } from "@/types/recovery";

export type RecoveryMuscleMap = Record<string, { recoveryPct: number } | undefined>;

export type UseRecoverySelectionResult = {
  selectedMuscle: string | null;
  selectedData: MuscleRecovery | null;
  muscleMap: RecoveryMuscleMap;
  handleSelect: (name: string) => void;
  fatigued: number;
  partial: number;
  recovered: number;
};

export function useRecoverySelection(muscles: MuscleRecovery[]): UseRecoverySelectionResult {
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);

  const muscleMap = useMemo(
    () => Object.fromEntries(muscles.map((r) => [r.muscle, { recoveryPct: r.recoveryPct }])),
    [muscles]
  );

  const selectedData = useMemo(
    () => muscles.find((r) => r.muscle === selectedMuscle) ?? null,
    [muscles, selectedMuscle]
  );

  const fatigued = useMemo(() => muscles.filter((r) => r.status === "fatigued").length, [muscles]);
  const partial = useMemo(() => muscles.filter((r) => r.status === "partial").length, [muscles]);
  const recovered = useMemo(() => muscles.filter((r) => r.status === "recovered").length, [muscles]);

  const handleSelect = useCallback((name: string) => {
    setSelectedMuscle((prev) => (prev === name ? null : name));
  }, []);

  return { selectedMuscle, selectedData, muscleMap, handleSelect, fatigued, partial, recovered };
}
