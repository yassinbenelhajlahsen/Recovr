/** LLM parsed output */
export type ParsedExercise = {
  name: string;
  muscle_groups: string[];
  sets: { reps: number; weight: number | null }[];
};

/** Response from transcribe-only endpoint */
export type VoiceTranscriptResult = {
  transcript: string;
};

/** API response after DB matching (parse endpoint) */
export type VoiceTranscribeResponse = {
  transcript: string;
  exercises: {
    exercise_id: string;
    exercise_name: string;
    muscle_groups: string[];
    equipment: string | null;
    sets: { reps: number; weight: number }[];
  }[];
  unmatched: string[];
};
