// src/stores/uiStore.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface UIState {
  // UI state
  sidebarOpen: boolean;
  themeMode: "light" | "dark";
  searchQuery: string;

  // UI actions
  toggleSidebar: () => void;
  toggleThemeMode: () => void;
  setSearchQuery: (query: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Initial state
      sidebarOpen: true,
      themeMode: "dark",
      searchQuery: "",

      // Actions
      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      toggleThemeMode: () =>
        set((state) => ({
          themeMode: state.themeMode === "dark" ? "light" : "dark",
        })),
      setSearchQuery: (query: string) => set({ searchQuery: query }),
    }),
    {
      name: "chat-ui-storage",
      partialize: (state) => ({
        themeMode: state.themeMode,
        sidebarOpen: state.sidebarOpen,
      }),
      storage: createJSONStorage(() => {
        // Use localStorage only on the client side
        if (typeof window !== "undefined") {
          return localStorage;
        }
        // Return a dummy storage for SSR
        return {
          getItem: () => null,
          setItem: () => null,
          removeItem: () => null,
        };
      }),
    },
  ),
);
