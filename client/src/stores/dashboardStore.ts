import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

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

// Standardized WebSocket message format
interface WSMessage {
  type: string;
  room_id?: string;
  content?: string;
  data?: any;
}

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
  pendingThreadCreation: {
    title: string;
    pendingMessages: string[];
    callback?: (threadId: string) => void;
  } | null;
  activeRooms: Set<string>; // Track which rooms we're subscribed to
  typingUsers: Record<
    string,
    { userId: string; userName: string; timestamp: number }[]
  >; // Track typing indicators by room

  // UI Actions
  toggleSidebar: () => void;
  setCurrentThread: (threadId: string) => void;
  pinThread: (threadId: string) => void;
  deleteThread: (threadId: string) => void;
  setSearchQuery: (query: string) => void;
  toggleThemeMode: () => void;
  createNewThread: (
    title: string,
    callback?: (threadId: string) => void,
  ) => void;

  // Thread management
  addThread: (threadId: string, title: string) => void;

  // WebSocket Actions
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
  subscribeToRoom: (roomId: string) => void;
  unsubscribeFromRoom: (roomId: string) => void;
  sendMessage: (content: string) => void;
  sendTypingIndicator: (isTyping: boolean) => void;
  markMessagesAsRead: (messageIds: string[]) => void;

  // Message Actions
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  loadMessages: (roomId: string, reset?: boolean) => Promise<void>;
  loadMoreMessages: () => Promise<void>;
}

// Create the store with persistence that works in Next.js
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
      pendingThreadCreation: null,
      activeRooms: new Set<string>(),
      typingUsers: {},

      // UI Actions
      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setCurrentThread: (threadId) => {
        const currentThreadId = get().currentThreadId;

        // If we're already on this thread, do nothing
        if (currentThreadId === threadId) return;

        // Unsubscribe from current room if we have one
        if (currentThreadId) {
          get().unsubscribeFromRoom(currentThreadId);
        }

        set({ currentThreadId: threadId });

        // Subscribe to the new room
        get().subscribeToRoom(threadId);
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

          // If we're deleting the current thread, unsubscribe from it
          if (state.currentThreadId === threadId) {
            get().unsubscribeFromRoom(threadId);
            set({ currentThreadId: null, messages: [] });
          }

          return { threads: newThreads };
        }),

      setSearchQuery: (query) => set({ searchQuery: query }),

      toggleThemeMode: () =>
        set((state) => ({
          themeMode: state.themeMode === "dark" ? "light" : "dark",
        })),

      // Modified to request a UUID from the server
      createNewThread: (title, callback) => {
        const { instance, status } = get().wsConnection;

        if (!title) {
          title = "New Chat";
        }

        // If WebSocket is connected, send thread creation request
        if (instance && status === "connected") {
          const message: WSMessage = {
            type: "create_thread",
            data: { title },
          };

          instance.send(JSON.stringify(message));

          // Store pending state
          set({
            pendingThreadCreation: {
              title,
              pendingMessages: [],
              callback,
            },
          });
        } else {
          // For fallback or testing, create a placeholder with temporary ID
          console.error("WebSocket not connected. Thread creation might fail.");

          // Store in pending state and try to reconnect WebSocket
          set({
            pendingThreadCreation: {
              title,
              pendingMessages: [],
              callback,
            },
          });

          // Try to connect WebSocket
          get().connectWebSocket();
        }
      },

      // New method to add a thread with server-generated ID
      addThread: (threadId, title) => {
        const pendingState = get().pendingThreadCreation;

        set((state) => {
          // Add the new thread to the recent group
          const updatedRecentGroup = state.threads.find(
            (group) => group.id === "recent",
          );

          if (updatedRecentGroup) {
            const newThread = {
              id: threadId,
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

            // Update state with the new thread
            set({
              threads: newThreads,
              currentThreadId: threadId,
              messages: [],
              pendingThreadCreation: null,
            });

            // Subscribe to the new room if we're connected
            const { status } = get().wsConnection;
            if (status === "connected") {
              get().subscribeToRoom(threadId);
            }

            // Send any pending messages for this thread
            if (pendingState?.pendingMessages.length) {
              pendingState.pendingMessages.forEach((content) => {
                // Queue a short delay to make sure subscription completes
                setTimeout(() => {
                  const message: WSMessage = {
                    type: "message",
                    room_id: threadId,
                    content: content,
                  };

                  const { instance } = get().wsConnection;
                  if (instance) {
                    instance.send(JSON.stringify(message));
                  }
                }, 100);
              });
            }

            // Execute callback if provided
            if (pendingState?.callback) {
              pendingState.callback(threadId);
            }
          }

          return {};
        });
      },

      // WebSocket Actions
      connectWebSocket: async () => {
        // Disconnect existing connection if any
        get().disconnectWebSocket();

        set({ wsConnection: { status: "connecting", instance: null } });

        try {
          // Get token from API endpoint
          const response = await fetch("/api/auth/cookie?purpose=ws");

          if (!response.ok) {
            throw new Error("Failed to get authentication token");
          }

          const data = await response.json();
          const token = data.token;
          if (!token) {
            set({ wsConnection: { status: "error", instance: null } });
            console.error("Cannot connect to WebSocket: No auth token found");
            return;
          }

          // Connect to WebSocket with the token
          const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080"}/api/ws?token=${token}`;
          const ws = new WebSocket(wsUrl);

          ws.onopen = () => {
            set({ wsConnection: { status: "connected", instance: ws } });
            console.log("Connected to WebSocket, nya~!");

            // If we have a pending thread creation, send it now
            const pendingThread = get().pendingThreadCreation;
            if (pendingThread) {
              const message: WSMessage = {
                type: "create_thread",
                data: { title: pendingThread.title },
              };
              ws.send(JSON.stringify(message));
            }

            // If we have a current thread, subscribe to it
            const currentThreadId = get().currentThreadId;
            if (currentThreadId) {
              get().subscribeToRoom(currentThreadId);
            }
          };

          ws.onclose = () => {
            set({ wsConnection: { status: "disconnected", instance: null } });
            console.log("Disconnected from WebSocket, meow!");
          };

          ws.onerror = (error) => {
            set({ wsConnection: { status: "error", instance: null } });
            console.error("WebSocket error:", error);
          };

          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);

              // Handle different message types
              switch (data.type) {
                case "message":
                  // Add received message
                  get().addMessage(data);
                  break;

                case "message_sent":
                  // Handle successful message send confirmation if needed
                  break;

                case "thread_created":
                  // Handle successful thread creation
                  if (data.success && data.thread_id) {
                    // Add the new thread with server-generated ID
                    const threadTitle =
                      data.data?.title ||
                      get().pendingThreadCreation?.title ||
                      "New Chat";
                    get().addThread(data.thread_id, threadTitle);
                  } else {
                    console.error("Failed to create thread:", data.message);
                  }
                  break;

                case "typing":
                  // Handle typing indicators
                  if (data.room_id && data.user_id && data.data) {
                    // Update typing users
                    set((state) => {
                      const roomTypers = state.typingUsers[data.room_id] || [];
                      const typerIndex = roomTypers.findIndex(
                        (t) => t.userId === data.user_id,
                      );

                      if (data.data.is_typing) {
                        // Add or update typing user
                        const typer = {
                          userId: data.user_id,
                          userName: data.data.user_name || "Unknown",
                          timestamp: Date.now(),
                        };

                        if (typerIndex >= 0) {
                          // Update existing
                          roomTypers[typerIndex] = typer;
                        } else {
                          // Add new
                          roomTypers.push(typer);
                        }
                      } else if (typerIndex >= 0) {
                        // Remove typing user
                        roomTypers.splice(typerIndex, 1);
                      }

                      return {
                        typingUsers: {
                          ...state.typingUsers,
                          [data.room_id]: roomTypers,
                        },
                      };
                    });
                  }
                  break;

                default:
                  console.log("Unhandled message type:", data.type);
              }
            } catch (error) {
              console.error("Failed to parse WebSocket message:", error);
            }
          };

          // Store websocket instance
          set({ wsConnection: { status: "connecting", instance: ws } });
        } catch (error) {
          set({ wsConnection: { status: "error", instance: null } });
          console.error("Error connecting to WebSocket:", error);
        }
      },

      disconnectWebSocket: () => {
        const { instance } = get().wsConnection;

        if (instance && instance.readyState === WebSocket.OPEN) {
          instance.close();
        }

        set({
          wsConnection: { status: "idle", instance: null },
          activeRooms: new Set<string>(),
        });
      },

      subscribeToRoom: (roomId) => {
        const { instance, status } = get().wsConnection;

        if (!roomId || status !== "connected" || !instance) return;

        // Create a subscribe message
        const message: WSMessage = {
          type: "subscribe",
          room_id: roomId,
        };

        // Send subscription request
        instance.send(JSON.stringify(message));

        // Update active rooms
        set((state) => {
          const newActiveRooms = new Set(state.activeRooms);
          newActiveRooms.add(roomId);
          return { activeRooms: newActiveRooms };
        });

        // Load messages for this room
        get().loadMessages(roomId, true);
      },

      unsubscribeFromRoom: (roomId) => {
        const { instance, status } = get().wsConnection;

        if (!roomId || status !== "connected" || !instance) return;

        // Create an unsubscribe message
        const message: WSMessage = {
          type: "unsubscribe",
          room_id: roomId,
        };

        // Send unsubscription request
        instance.send(JSON.stringify(message));

        // Update active rooms
        set((state) => {
          const newActiveRooms = new Set(state.activeRooms);
          newActiveRooms.delete(roomId);
          return { activeRooms: newActiveRooms };
        });
      },

      sendMessage: (content) => {
        const { instance, status } = get().wsConnection;
        const currentThreadId = get().currentThreadId;

        if (!content.trim()) return;

        // If we don't have a current thread, we need to create one first
        if (!currentThreadId) {
          // Store the message to send after thread creation
          const title =
            content.length > 30 ? content.substring(0, 27) + "..." : content;

          // Update pending thread creation with this message
          set({
            pendingThreadCreation: {
              title,
              pendingMessages: [content.trim()],
              callback: undefined,
            },
          });
          // Request thread creation
          const { instance, status } = get().wsConnection;
          if (instance && status === "connected") {
            const message: WSMessage = {
              type: "create_thread",
              data: { title },
            };
            instance.send(JSON.stringify(message));
          } else {
            // Try to connect if not connected
            get().connectWebSocket();
          }
          return;
        }

        // Create a standardized message
        const message: WSMessage = {
          type: "message",
          room_id: currentThreadId,
          content: content.trim(),
        };

        // If WebSocket is connected, send through there
        if (instance && status === "connected") {
          instance.send(JSON.stringify(message));
        } else {
          // Otherwise, use the REST API as fallback or try to reconnect
          console.error(
            "WebSocket not connected. Message might not be delivered.",
          );

          // Try to reconnect
          get().connectWebSocket();

          // For now, store in pending messages if there's a currentThreadId
          if (currentThreadId) {
            // We could implement a message queue here for offline support
            console.log(
              "Message queued for delivery when connection is restored",
            );
          }
        }
      },

      sendTypingIndicator: (isTyping) => {
        const { instance, status } = get().wsConnection;
        const currentThreadId = get().currentThreadId;

        if (!currentThreadId || status !== "connected" || !instance) return;

        const message: WSMessage = {
          type: "typing",
          room_id: currentThreadId,
          data: { is_typing: isTyping },
        };

        instance.send(JSON.stringify(message));
      },

      markMessagesAsRead: (messageIds) => {
        const { instance, status } = get().wsConnection;
        const currentThreadId = get().currentThreadId;

        if (
          !messageIds.length ||
          !currentThreadId ||
          status !== "connected" ||
          !instance
        )
          return;

        const message: WSMessage = {
          type: "read",
          room_id: currentThreadId,
          data: { message_ids: messageIds },
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
            `/api/rooms/${roomId}/messages?offset=${offset}&limit=50`,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
              },
            },
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
      // Only persist certain parts of the state to avoid Next.js hydration issues
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
      // Use createJSONStorage for Next.js compatibility
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
