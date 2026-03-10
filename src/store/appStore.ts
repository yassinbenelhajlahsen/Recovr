import { create } from "zustand";

interface AppStore {
  isOnboarding: boolean;
  setOnboarding: (value: boolean) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  isOnboarding: false,
  setOnboarding: (value) => set({ isOnboarding: value }),
}));
