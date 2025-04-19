// stores/dashboardStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

// Define Message type
export interface Message {
  id: string;
  content: string;
  room_id: string;
  user_id: string;
  created_at: string;
  formatted?: {
    role: "user" | "assistant" | "system";
    timestamp: Date;
  };
}

// Define Thread type
export interface Thread {
  id: string;
  title: string;
  isPinned?: boolean;
  lastUpdated: Date;
  messages?: Message[];
  hasMoreMessages?: boolean;
  messageOffset?: number;
}

// Define Group type
export interface ThreadGroup {
  id: string;
  label: string;
  threads: Thread[];
}

// WebSocket connection states
type ConnectionStatus =
  | "connected"
  | "disconnected"
  | "connecting"
  | "error"
  | "idle";

// Define Dashboard state and actions
export interface DashboardState {
  sidebarOpen: boolean;
  threads: ThreadGroup[];
  currentThreadId: string | null;
  searchQuery: string;
  themeMode: "light" | "dark";
  wsConnection: {
    status: ConnectionStatus;
    instance: WebSocket | null;
  };
  messages: Message[];
  isLoadingMessages: boolean;
  messagesError: string | null;

  // Actions
  toggleSidebar: () => void;
  setCurrentThread: (threadId: string) => void;
  pinThread: (threadId: string) => void;
  deleteThread: (threadId: string) => void;
  setSearchQuery: (query: string) => void;
  toggleThemeMode: () => void;
  createNewThread: (title: string) => string;

  // WebSocket actions
  connectWebSocket: (roomId: string) => void;
  disconnectWebSocket: () => void;
  sendMessage: (content: string) => void;
  sendTypingIndicator: (isTyping: boolean) => void;

  // Messages actions
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  loadMessages: (roomId: string, reset?: boolean) => Promise<void>;
  loadMoreMessages: () => Promise<void>;
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
      wsConnection: {
        status: "idle",
        instance: null,
      },
      messages: [],
      isLoadingMessages: false,
      messagesError: null,

      // UI Actions
      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setCurrentThread: (threadId) => {
        set({ currentThreadId: threadId });

        // When changing threads, we should connect to the WebSocket for this room
        get().connectWebSocket(threadId);

        // And load messages for this thread
        get().loadMessages(threadId, true);
      },

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

          // If we're deleting the current thread, disconnect the WebSocket
          if (state.currentThreadId === threadId) {
            get().disconnectWebSocket();
            set({ currentThreadId: null, messages: [] });
          }

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
              messages: [],
              hasMoreMessages: false,
              messageOffset: 0,
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
              messages: [],
            });

            // Connect to the websocket for the new thread
            get().connectWebSocket(id);
          }

          return {};
        });

        return id;
      },

      // WebSocket Actions
      connectWebSocket: (roomId) => {
        // Disconnect existing connection if any
        get().disconnectWebSocket();

        // Get token
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("accessToken")
            : null;

        if (!token) {
          set({ wsConnection: { status: "error", instance: null } });
          console.error("Cannot connect to WebSocket: No auth token found");
          return;
        }

        set({ wsConnection: { status: "connecting", instance: null } });

        // Connect to WebSocket
        const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080"}/api/ws/room/${roomId}?token=${token}`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          set({ wsConnection: { status: "connected", instance: ws } });
          console.log(`Connected to WebSocket for room ${roomId}`);
        };

        ws.onclose = () => {
          set({ wsConnection: { status: "disconnected", instance: null } });
          console.log(`Disconnected from WebSocket for room ${roomId}`);
        };

        ws.onerror = (error) => {
          set({ wsConnection: { status: "error", instance: null } });
          console.error("WebSocket error:", error);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // Handle different message types
            if (data.type === "message") {
              // Add the new message to our store
              get().addMessage(data.payload);
            }
            // Handle other message types like typing indicators, etc.
          } catch (error) {
            console.error("Failed to parse WebSocket message:", error);
          }
        };
      },

      disconnectWebSocket: () => {
        const { instance } = get().wsConnection;

        if (instance && instance.readyState === WebSocket.OPEN) {
          instance.close();
        }

        set({ wsConnection: { status: "idle", instance: null } });
      },

      sendMessage: (content) => {
        const { instance, status } = get().wsConnection;
        const currentThreadId = get().currentThreadId;

        if (!content.trim() || !currentThreadId) return;

        // If WebSocket is connected, send through there
        if (instance && status === "connected") {
          const message = {
            type: "message",
            payload: {
              content,
              room_id: currentThreadId,
            },
          };

          instance.send(JSON.stringify(message));
        } else {
          // Otherwise, use the REST API as fallback
          // This code would be browser-side only
          if (typeof window !== "undefined") {
            fetch(`/api/chat/${currentThreadId}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ content }),
            })
              .then((response) => {
                if (!response.ok) throw new Error("Failed to send message");
                return response.json();
              })
              .then((data) => {
                // Add the sent message to our local store
                get().addMessage(data);
              })
              .catch((error) => {
                console.error("Error sending message:", error);
                // Attempt to reconnect WebSocket
                get().connectWebSocket(currentThreadId);
              });
          }
        }
      },

      sendTypingIndicator: (isTyping) => {
        const { instance, status } = get().wsConnection;
        const currentThreadId = get().currentThreadId;

        if (!currentThreadId || status !== "connected" || !instance) return;

        const message = {
          type: "typing",
          payload: {
            is_typing: isTyping,
            room_id: currentThreadId,
          },
        };

        instance.send(JSON.stringify(message));
      },

      // Message Actions
      setMessages: (messages) => set({ messages }),

      addMessage: (message) =>
        set((state) => ({
          messages: [message, ...state.messages],
        })),

      loadMessages: async (roomId, reset = false) => {
        if (!roomId) return;

        set({ isLoadingMessages: true, messagesError: null });

        try {
          // Find the current thread to get its messageOffset
          let offset = 0;
          let thread = null;

          for (const group of get().threads) {
            thread = group.threads.find((t) => t.id === roomId);
            if (thread) break;
          }

          if (thread && !reset) {
            offset = thread.messageOffset || 0;
          }

          // Load messages from API
          const response = await fetch(
            `/api/chat/${roomId}?offset=${offset}&limit=50`,
          );

          if (!response.ok) {
            throw new Error("Failed to load messages");
          }

          const data = await response.json();

          // Update the messages in state
          if (reset) {
            set({ messages: data });
          } else {
            set((state) => ({
              messages: [...state.messages, ...data],
            }));
          }

          // Update thread with new offset and hasMoreMessages flag
          set((state) => {
            const newThreads = state.threads.map((group) => ({
              ...group,
              threads: group.threads.map((thread) => {
                if (thread.id === roomId) {
                  return {
                    ...thread,
                    messageOffset: (thread.messageOffset || 0) + data.length,
                    hasMoreMessages: data.length === 50, // If we got less than 50, we're at the end
                  };
                }
                return thread;
              }),
            }));

            return { threads: newThreads };
          });
        } catch (error) {
          console.error("Error loading messages:", error);
          set({ messagesError: "Failed to load messages" });
        } finally {
          set({ isLoadingMessages: false });
        }
      },

      loadMoreMessages: async () => {
        const { currentThreadId, isLoadingMessages } = get();

        if (!currentThreadId || isLoadingMessages) return;

        // Find current thread
        let thread = null;
        for (const group of get().threads) {
          thread = group.threads.find((t) => t.id === currentThreadId);
          if (thread) break;
        }

        // If no thread found or no more messages
        if (!thread || !thread.hasMoreMessages) return;

        // Load more messages
        await get().loadMessages(currentThreadId);
      },
    }),
    {
      name: "dashboard-storage",
      // Only persist certain parts of the state
      partialize: (state) => ({
        themeMode: state.themeMode,
        threads: state.threads.map((group) => ({
          ...group,
          threads: group.threads.map((thread) => ({
            id: thread.id,
            title: thread.title,
            isPinned: thread.isPinned,
            lastUpdated: thread.lastUpdated,
          })),
        })),
      }),
    },
  ),
);
