import { create } from "zustand";
import type { WorkoutPreview, Workout } from "@/types/workout";

export type DrawerView = "create" | "view" | "edit";

export type LocalMutation =
  | { type: "insert"; workout: Workout; at?: "start" | "end" }
  | { type: "remove"; id: string }
  | { type: "edit"; id: string; patch: Partial<Workout> }
  | { type: "restore"; workout: Workout; afterId: string | null };

interface WorkoutStore {
  isDrawerOpen: boolean;
  drawerView: DrawerView | null;
  selectedWorkoutId: string | null;
  previewData: WorkoutPreview | null;
  deletingWorkoutId: string | null;

  // Local mutation event bus — DashboardClient subscribes via useEffect on localMutationSeq
  // and applies the mutation to its local workout list. Monotonic seq forces the effect to
  // fire even when the same mutation is emitted twice (e.g. retry).
  localMutation: LocalMutation | null;
  localMutationSeq: number;

  openDrawer: (workoutId?: string, preview?: WorkoutPreview) => void;
  closeDrawer: () => void;
  setDrawerView: (view: DrawerView) => void;
  setDeletingWorkoutId: (id: string | null) => void;
  emitLocalMutation: (mutation: LocalMutation) => void;
}

export const useWorkoutStore = create<WorkoutStore>((set) => ({
  isDrawerOpen: false,
  drawerView: null,
  selectedWorkoutId: null,
  previewData: null,
  deletingWorkoutId: null,
  localMutation: null,
  localMutationSeq: 0,
  openDrawer: (workoutId, preview) =>
    set({
      isDrawerOpen: true,
      drawerView: workoutId ? "view" : "create",
      selectedWorkoutId: workoutId ?? null,
      previewData: preview ?? null,
    }),
  closeDrawer: () =>
    set({
      isDrawerOpen: false,
      drawerView: null,
      selectedWorkoutId: null,
      previewData: null,
    }),
  setDrawerView: (view) => set({ drawerView: view }),
  setDeletingWorkoutId: (id) => set({ deletingWorkoutId: id }),
  emitLocalMutation: (mutation) =>
    set((s) => ({
      localMutation: mutation,
      localMutationSeq: s.localMutationSeq + 1,
    })),
}));
