// stores/dashboardStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

// Define Thread type
export interface Thread {
  id: string;
  title: string;
  isPinned?: boolean;
  lastUpdated: Date;
}

// Define Group type
export interface ThreadGroup {
  id: string;
  label: string;
  threads: Thread[];
}

// Define Dashboard state and actions
export interface DashboardState {
  sidebarOpen: boolean;
  threads: ThreadGroup[];
  currentThreadId: string | null;
  searchQuery: string;
  themeMode: "light" | "dark";

  // Actions
  toggleSidebar: () => void;
  setCurrentThread: (threadId: string) => void;
  pinThread: (threadId: string) => void;
  deleteThread: (threadId: string) => void;
  setSearchQuery: (query: string) => void;
  toggleThemeMode: () => void;
  createNewThread: (title: string) => string;
}

// Create the store with persistence
export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      sidebarOpen: true,
      threads: [
        {
          id: "recent",
          label: "Last 7 Days",
          threads: [
            {
              id: "thread1",
              title: "Untraditional software engineer losing hope",
              lastUpdated: new Date(),
            },
            {
              id: "thread2",
              title: "Avante Nvim Duplicate Index Provider Error",
              lastUpdated: new Date(),
            },
            {
              id: "thread3",
              title: "Chat App New Chat Flow",
              lastUpdated: new Date(),
            },
          ],
        },
        {
          id: "older",
          label: "Older",
          threads: [
            {
              id: "thread4",
              title: "Welcome to T3 Chat",
              lastUpdated: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
            },
            {
              id: "thread5",
              title: "FAQ",
              lastUpdated: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
            },
          ],
        },
      ],
      currentThreadId: null,
      searchQuery: "",
      themeMode: "dark",

      // Actions
      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setCurrentThread: (threadId) => set({ currentThreadId: threadId }),

      pinThread: (threadId) =>
        set((state) => {
          // Create a deep copy of threads array with the updated thread
          const newThreads = state.threads.map((group) => {
            const updatedThreads = group.threads.map((thread) =>
              thread.id === threadId
                ? { ...thread, isPinned: !thread.isPinned }
                : thread,
            );
            return { ...group, threads: updatedThreads };
          });

          return { threads: newThreads };
        }),

      deleteThread: (threadId) =>
        set((state) => {
          // Filter out the thread to be deleted from all groups
          const newThreads = state.threads.map((group) => ({
            ...group,
            threads: group.threads.filter((thread) => thread.id !== threadId),
          }));

          return { threads: newThreads };
        }),

      setSearchQuery: (query) => set({ searchQuery: query }),

      toggleThemeMode: () =>
        set((state) => ({
          themeMode: state.themeMode === "dark" ? "light" : "dark",
        })),

      createNewThread: (title) => {
        const id = `thread-${Date.now()}`;
        set((state) => {
          // Add the new thread to the recent group
          const updatedRecentGroup = state.threads.find(
            (group) => group.id === "recent",
          );

          if (updatedRecentGroup) {
            const newThread = {
              id,
              title: title || "New Chat",
              lastUpdated: new Date(),
            };

            // Update the recent group with the new thread
            const newThreads = state.threads.map((group) =>
              group.id === "recent"
                ? { ...group, threads: [newThread, ...group.threads] }
                : group,
            );

            set({
              threads: newThreads,
              currentThreadId: id,
            });
          }

          return {};
        });

        return id;
      },
    }),
    {
      name: "dashboard-storage",
      // Only persist certain parts of the state
      partialize: (state) => ({
        themeMode: state.themeMode,
        threads: state.threads,
      }),
    },
  ),
);
