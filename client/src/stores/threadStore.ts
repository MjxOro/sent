// src/stores/threadStore.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Message } from "@/stores/messageStore"; // Import for type

// Types
export interface Thread {
  id: string;
  title: string;
  isPinned?: boolean;
  lastUpdated: Date;
  lastMessage?: string;
  unreadCount?: number;
}

export interface ThreadGroup {
  id: string;
  label: string;
  threads: Thread[];
}

// Helper function to categorize threads into groups
const categorizeThreads = (threads: Thread[]): ThreadGroup[] => {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Sort threads by lastUpdated
  const sortedThreads = [...threads].sort(
    (a, b) =>
      new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime(),
  );

  // Split into recent and older
  const recentThreads = sortedThreads.filter(
    (thread) => new Date(thread.lastUpdated) >= sevenDaysAgo,
  );

  const olderThreads = sortedThreads.filter(
    (thread) => new Date(thread.lastUpdated) < sevenDaysAgo,
  );

  // Create group structure
  return [
    {
      id: "recent",
      label: "Last 7 Days",
      threads: recentThreads,
    },
    {
      id: "older",
      label: "Older",
      threads: olderThreads,
    },
  ];
};

interface ThreadState {
  // State
  threads: Thread[];
  threadGroups: ThreadGroup[];
  currentThreadId: string | null;
  threadsLoaded: boolean;
  threadsLoading: boolean;
  threadsError: string | null;

  // Actions
  loadThreads: () => Promise<void>;
  setCurrentThread: (threadId: string) => void;
  createThread: (title: string) => Promise<string>;
  deleteThread: (threadId: string) => Promise<void>;
  pinThread: (threadId: string) => void;
  updateThreadLastMessage: (threadId: string, message: Message) => void;
  incrementUnreadCount: (threadId: string) => void;
  resetUnreadCount: (threadId: string) => void;
}

export const useThreadStore = create<ThreadState>()(
  persist(
    (set, get) => ({
      // Initial state
      threads: [],
      threadGroups: [],
      currentThreadId: null,
      threadsLoaded: false,
      threadsLoading: false,
      threadsError: null,

      // Actions
      loadThreads: async () => {
        try {
          set({ threadsLoading: true, threadsError: null });

          // Fetch threads from API (using cookie auth approach)
          const response = await fetch("/api/rooms");

          if (!response.ok) {
            throw new Error("Failed to load threads");
          }

          const roomsData = await response.json();

          // Map rooms to threads
          const threads: Thread[] = roomsData.map((room: any) => ({
            id: room.id,
            title: room.name || "Unnamed Chat",
            isPinned: false, // We'll store pinned status locally
            lastUpdated: new Date(room.updated_at),
            unreadCount: 0, // Will be updated separately
          }));

          // Group the threads by date
          const threadGroups = categorizeThreads(threads);

          set({
            threads,
            threadGroups,
            threadsLoaded: true,
            threadsLoading: false,
          });
        } catch (error) {
          console.error("Error loading threads:", error);
          set({
            threadsError:
              error instanceof Error ? error.message : "Unknown error",
            threadsLoading: false,
          });
        }
      },

      setCurrentThread: (threadId) => {
        set({ currentThreadId: threadId });
      },

      createThread: async (title) => {
        try {
          // API call to create a new thread/room (using cookie auth approach)
          const response = await fetch("/api/rooms", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: title,
              description: "",
              is_private: false,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to create thread");
          }

          const newRoom = await response.json();

          // Add the new thread to state
          const newThread: Thread = {
            id: newRoom.id,
            title: newRoom.name || "New Chat",
            isPinned: false,
            lastUpdated: new Date(),
            unreadCount: 0,
          };

          set((state) => {
            const updatedThreads = [...state.threads, newThread];
            return {
              threads: updatedThreads,
              threadGroups: categorizeThreads(updatedThreads),
              currentThreadId: newRoom.id,
            };
          });

          return newRoom.id;
        } catch (error) {
          console.error("Error creating thread:", error);
          throw error;
        }
      },

      deleteThread: async (threadId) => {
        try {
          // API call to delete the thread/room (using cookie auth approach)
          const response = await fetch(`/api/rooms/${threadId}`, {
            method: "DELETE",
          });

          if (!response.ok) {
            throw new Error("Failed to delete thread");
          }

          // Remove thread from state
          set((state) => {
            const updatedThreads = state.threads.filter(
              (t) => t.id !== threadId,
            );

            // If we're deleting the current thread, clear current thread ID
            const newCurrentThreadId =
              state.currentThreadId === threadId ? null : state.currentThreadId;

            return {
              threads: updatedThreads,
              threadGroups: categorizeThreads(updatedThreads),
              currentThreadId: newCurrentThreadId,
            };
          });
        } catch (error) {
          console.error("Error deleting thread:", error);
          throw error;
        }
      },

      pinThread: (threadId) => {
        set((state) => {
          const updatedThreads = state.threads.map((thread) =>
            thread.id === threadId
              ? { ...thread, isPinned: !thread.isPinned }
              : thread,
          );

          return {
            threads: updatedThreads,
            threadGroups: categorizeThreads(updatedThreads),
          };
        });
      },

      updateThreadLastMessage: (threadId, message) => {
        set((state) => {
          const updatedThreads = state.threads.map((thread) => {
            if (thread.id === threadId) {
              return {
                ...thread,
                lastMessage:
                  message.content.substring(0, 50) +
                  (message.content.length > 50 ? "..." : ""),
                lastUpdated: new Date(message.created_at),
              };
            }
            return thread;
          });

          return {
            threads: updatedThreads,
            threadGroups: categorizeThreads(updatedThreads),
          };
        });
      },

      incrementUnreadCount: (threadId) => {
        set((state) => {
          const updatedThreads = state.threads.map((thread) => {
            if (thread.id === threadId && thread.id !== state.currentThreadId) {
              return {
                ...thread,
                unreadCount: (thread.unreadCount || 0) + 1,
              };
            }
            return thread;
          });

          return {
            threads: updatedThreads,
            threadGroups: categorizeThreads(updatedThreads),
          };
        });
      },

      resetUnreadCount: (threadId) => {
        set((state) => {
          const updatedThreads = state.threads.map((thread) => {
            if (thread.id === threadId) {
              return {
                ...thread,
                unreadCount: 0,
              };
            }
            return thread;
          });

          return {
            threads: updatedThreads,
            threadGroups: categorizeThreads(updatedThreads),
          };
        });
      },
    }),
    {
      name: "chat-threads-storage",
      partialize: (state) => ({
        // Only persist these fields
        threads: state.threads.map((thread) => ({
          id: thread.id,
          title: thread.title,
          isPinned: thread.isPinned,
          lastUpdated: thread.lastUpdated,
        })),
        currentThreadId: state.currentThreadId,
      }),
      storage: createJSONStorage(() => {
        if (typeof window !== "undefined") {
          return localStorage;
        }
        return {
          getItem: () => null,
          setItem: () => null,
          removeItem: () => null,
        };
      }),
    },
  ),
);
