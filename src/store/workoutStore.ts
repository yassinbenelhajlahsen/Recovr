import { create } from "zustand";

type ModalName = "exerciseDrawer" | "sessionSummary";

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
    exercise: { id: string; name: string; muscle_groups: string[] };
    sets: { id: string; set_number: number; reps: number; weight: number }[];
  }[];
};

interface WorkoutStore {
  activeModal: ModalName | null;
  selectedWorkoutId: string | null;
  activeSession: SessionSummaryData | null;
  previewData: WorkoutPreview | null;
  openModal: (name: ModalName, workoutId?: string, preview?: WorkoutPreview) => void;
  closeModal: () => void;
}

export const useWorkoutStore = create<WorkoutStore>((set) => ({
  activeModal: null,
  selectedWorkoutId: null,
  activeSession: null,
  previewData: null,
  openModal: (name, workoutId, preview) =>
    set({
      activeModal: name,
      selectedWorkoutId: workoutId ?? null,
      activeSession: null,
      previewData: preview ?? null,
    }),
  closeModal: () =>
    set({ activeModal: null, selectedWorkoutId: null, activeSession: null, previewData: null }),
}));
