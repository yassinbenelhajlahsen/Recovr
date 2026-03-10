export type RecoveryStatus = "recovered" | "partial" | "fatigued";

export type MuscleRecovery = {
  muscle: string;
  recoveryPct: number; // 0–1
  status: RecoveryStatus;
  lastTrainedAt: string | null; // ISO date string
  hoursSince: number | null;
  lastSessionVolume: number | null; // total lbs
  lastSessionSets: number | null;
  lastSessionReps: number | null;
  lastSessionExercises: string[];
};

export type BodyMapProps = {
  muscles: Record<string, { recoveryPct: number } | undefined>;
  onSelectMuscle?: (muscle: string) => void;
};
