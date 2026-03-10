import { create } from "zustand";

type ModalName = "exerciseDrawer" | "sessionSummary";

interface WorkoutStore {
  activeModal: ModalName | null;
  selectedWorkoutId: string | null;
  activeSession: { id: string } | null;
  openModal: (name: ModalName, workoutId?: string) => void;
  closeModal: () => void;
}

export const useWorkoutStore = create<WorkoutStore>((set) => ({
  activeModal: null,
  selectedWorkoutId: null,
  activeSession: null,
  openModal: (name, workoutId) =>
    set({
      activeModal: name,
      selectedWorkoutId: workoutId ?? null,
      activeSession: null,
    }),
  closeModal: () =>
    set({ activeModal: null, selectedWorkoutId: null, activeSession: null }),
}));
