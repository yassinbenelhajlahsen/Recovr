export type DateRangePreset = "30d" | "90d" | "6m" | "1y" | "all";

export type MetricMode = "1rm" | "topWeight" | "both";

export type PerformedExercise = {
  id: string;
  name: string;
  sessionCount: number;
};

export type ExerciseSession = {
  date: string; // ISO string
  sets: { reps: number; weight: number }[];
};

export type ChartDataPoint = {
  date: string; // formatted display date (e.g. "Jan 5")
  dateRaw: string; // ISO string for sorting
  estimated1RM: number; // Epley: weight * (1 + reps/30), best set
  maxWeight: number; // heaviest set weight
  totalSets: number;
};

export type BodyWeightEntry = {
  date: string; // ISO string
  weight: number;
};

export type BodyWeightChartPoint = {
  date: string; // formatted display date
  dateRaw: string; // ISO string
  weight: number;
};

export type ProgressClientProps = {
  exercises: PerformedExercise[];
  sessionsByExercise: Record<string, ExerciseSession[]>;
  bodyWeightHistory: BodyWeightEntry[];
};
