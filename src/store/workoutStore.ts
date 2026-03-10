import { create } from "zustand";
import type { WorkoutPreview, SessionSummaryData } from "@/types/workout";

type ModalName = "exerciseDrawer" | "sessionSummary";

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
