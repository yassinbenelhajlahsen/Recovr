export type SuggestedSet = {
  reps: number;
  weight: number | null; // null = bodyweight
};

export type SuggestedExercise = {
  name: string;
  muscleGroups: string[];
  sets: SuggestedSet[];
  notes?: string;
};

export type WorkoutSuggestion = {
  title: string;
  rationale: string;
  estimatedMinutes: number;
  exercises: SuggestedExercise[];
};
