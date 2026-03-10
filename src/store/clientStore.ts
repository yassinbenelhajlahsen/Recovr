import { create } from "zustand";

interface ClientState {
  mounted: boolean;
  isDark: boolean;
  hydrate: () => () => void;
}

export const useClientStore = create<ClientState>((set) => ({
  mounted: false,
  isDark: false,
  hydrate: () => {
    const check = () =>
      set({
        mounted: true,
        isDark: document.documentElement.classList.contains("dark"),
      });
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  },
}));
