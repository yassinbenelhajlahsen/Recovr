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
  exercises: SuggestedExercise[];
};

export type SuggestionStreamEvent =
  | { type: "meta"; cooldown: number }
  | { type: "title"; value: string }
  | { type: "rationale"; value: string }
  | { type: "exercise"; value: SuggestedExercise }
  | { type: "done" }
  | { type: "error"; message: string };
