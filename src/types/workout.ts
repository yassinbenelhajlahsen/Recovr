import type { MuscleRecovery } from "@/types/recovery";

export type SetEntry = { id: string; set_number: number; reps: string; weight: string };

export type ExerciseEntry = {
  id: string;
  exercise_id: string;
  exercise_name: string;
  muscle_groups: string[];
  equipment?: string | null;
  order: number;
  sets: SetEntry[];
};

export type Exercise = {
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
    equipment?: string | null;
    order: number;
    sets: { set_number: number; reps: number; weight: number }[];
  }[];
};

export type WorkoutSaveData = {
  id: string;
  date: string;
  duration_minutes: number | null;
  notes: string | null;
  workout_exercises: {
    id: string;
    exercise: { id: string; name: string; muscle_groups: string[]; equipment: string | null };
    sets: { id: string; set_number: number; reps: number; weight: number }[];
  }[];
};

export type WorkoutFormProps = {
  workoutId?: string;
  initialData?: WorkoutFormInitialData;
  onSave?: (data: WorkoutSaveData) => void;
  onCancel?: () => void;
  compact?: boolean;
};

export type WorkoutPreview = {
  id: string;
  date: string;
  dateFormatted: string;
  durationMinutes: number | null;
  notes: string | null;
  exerciseNames: string[];
  totalSets: number;
};

export type SessionSummaryData = {
  id: string;
  date: string;
  duration_minutes: number | null;
  notes: string | null;
  workout_exercises: {
    id: string;
    exercise: { id: string; name: string; muscle_groups: string[]; equipment: string | null };
    sets: { id: string; set_number: number; reps: number; weight: number }[];
  }[];
};

export type SetData = { id: string; set_number: number; reps: number; weight: number };

export type ExerciseData = { id: string; name: string; muscle_groups: string[]; equipment: string | null };

export type WorkoutExerciseData = {
  id: string;
  exercise: ExerciseData;
  order: number;
  sets: SetData[];
};

export type WorkoutDetail = {
  id: string;
  date: string;
  duration_minutes: number | null;
  notes: string | null;
  workout_exercises: WorkoutExerciseData[];
};

export type Workout = {
  id: string;
  date: string;
  dateFormatted: string;
  durationMinutes: number | null;
  notes: string | null;
  exerciseNames: string[];
  totalSets: number;
};

export type DashboardClientProps = {
  displayName: string | null | undefined;
  workouts: Workout[];
  hasFilters: boolean;
  recovery: MuscleRecovery[];
};
