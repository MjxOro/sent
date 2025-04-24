// src/stores/socketStore.ts
import { create } from "zustand";
import { useMessageStore } from "./messageStore";
import { useThreadStore } from "./threadStore";

// Types
export type ConnectionStatus =
  | "connected"
  | "disconnected"
  | "connecting"
  | "error"
  | "idle";

export interface TypingUser {
  userId: string;
  userName: string;
  timestamp: number;
}

// Message types from server
interface ServerMessage {
  type: string;
  [key: string]: any;
}

// Message types to send to server
interface ClientMessage {
  type: string;
  room_id?: string;
  content?: string;
  data?: any;
  [key: string]: any;
}

interface SocketState {
  // Connection state
  status: ConnectionStatus;
  instance: WebSocket | null;

  // Subscription state
  activeRooms: Set<string>;
  typingUsers: Record<string, TypingUser[]>;
  pendingMessages: Record<string, string[]>;
  pendingThreadCreation: {
    title: string;
    callback?: (threadId: string) => void;
  } | null;

  // Connection actions
  connect: () => Promise<void>;
  disconnect: () => void;

  // Subscription actions
  subscribeToRoom: (roomId: string) => void;
  unsubscribeFromRoom: (roomId: string) => void;

  // Message actions
  sendMessage: (roomId: string | null, content: string) => void;
  sendTypingIndicator: (roomId: string, isTyping: boolean) => void;
  createThread: (title: string) => Promise<string>;

  // Internal actions (not exposed in provider)
  _handleMessage: (event: MessageEvent) => void;
  _cleanupStaleTypingIndicators: () => void;
}

export const useSocketStore = create<SocketState>()((set, get) => ({
  // Initial state
  status: "idle",
  instance: null,
  activeRooms: new Set<string>(),
  typingUsers: {},
  pendingMessages: {},
  pendingThreadCreation: null,

  // Connection actions
  connect: async () => {
    // Disconnect existing connection if any
    get().disconnect();

    set({ status: "connecting" });

    try {
      const response = await fetch("/api/auth/cookie?purpose=token");
      const data = await response.json();
      const token = data.token;
      if (!token) {
        set({ status: "error", instance: null });
        console.error("Cannot connect to WebSocket: No token found");
        return;
      }

      const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080"}/api/ws?token=${token}`;

      console.log("Connecting to WebSocket with URL:", wsUrl);

      const ws = new WebSocket(wsUrl);

      // Setup WebSocket event handlers...
      ws.onopen = () => {
        set({ status: "connected", instance: ws });
        console.log("Connected to WebSocket!");

        // Handle reconnection logic
        // Rest of your code...
      };

      // Other event handlers...
    } catch (error) {
      set({ status: "error", instance: null });
      console.error("Error connecting to WebSocket:", error);
    }
  },

  disconnect: () => {
    const { instance } = get();

    if (instance && instance.readyState === WebSocket.OPEN) {
      instance.close();
    }

    set({
      status: "idle",
      instance: null,
      activeRooms: new Set<string>(),
    });
  },

  // Subscription actions
  subscribeToRoom: (roomId) => {
    const { instance, status, activeRooms } = get();

    if (!roomId || status !== "connected" || !instance) return;

    // Create a subscribe message
    const message: ClientMessage = {
      type: "subscribe",
      room_id: roomId,
    };

    // Send subscription request
    instance.send(JSON.stringify(message));

    // Update active rooms
    const newActiveRooms = new Set(activeRooms);
    newActiveRooms.add(roomId);
    set({ activeRooms: newActiveRooms });

    // Load messages for this room
    useMessageStore.getState().loadMessages(roomId, true);
  },

  unsubscribeFromRoom: (roomId) => {
    const { instance, status, activeRooms } = get();

    if (!roomId || status !== "connected" || !instance) return;

    // Create an unsubscribe message
    const message: ClientMessage = {
      type: "unsubscribe",
      room_id: roomId,
    };

    // Send unsubscription request
    instance.send(JSON.stringify(message));

    // Update active rooms
    const newActiveRooms = new Set(activeRooms);
    newActiveRooms.delete(roomId);
    set({ activeRooms: newActiveRooms });
  },

  // Message actions
  sendMessage: (roomId, content) => {
    console.log(`Attempting to send message to room ${roomId}: ${content}`);

    if (!content.trim()) {
      console.log("Message is empty, not sending");
      return;
    }

    const { instance, status, pendingMessages } = get();
    console.log(`WebSocket status: ${status}, instance exists: ${!!instance}`);

    // If we don't have a current room ID, we need to create a new thread first
    if (!roomId) {
      console.log("No roomId provided, creating a new thread");
      const title =
        content.length > 30 ? content.substring(0, 27) + "..." : content;

      // Queue the message to be sent after thread creation
      set({
        pendingThreadCreation: {
          title,
          callback: (newThreadId) => {
            console.log(
              `Thread created with ID: ${newThreadId}, now sending message`,
            );
            // Send message once we have the thread ID
            get().sendMessage(newThreadId, content);
          },
        },
      });

      // Request thread creation
      get().createThread(title);
      return;
    }

    // Create a standardized message
    const message = {
      type: "message",
      room_id: roomId,
      content: content.trim(),
    };

    console.log("Prepared message object:", message);

    // If WebSocket is connected, send through it
    if (instance && status === "connected") {
      try {
        console.log("Sending message via WebSocket...");
        const messageString = JSON.stringify(message);
        console.log("Stringified message:", messageString);
        instance.send(messageString);
        console.log("Message sent successfully");
      } catch (err) {
        console.error("Error sending message:", err);
        // Queue message if sending fails
        queueMessage(roomId, content.trim());
      }
    } else {
      console.log(
        `WebSocket not connected (status: ${status}). Queueing message.`,
      );
      queueMessage(roomId, content.trim());
      // Try to connect
      get().connect();
    }

    // Helper function to queue messages
    function queueMessage(roomId: string, content: string) {
      set((state) => {
        const updatedPendingMessages = { ...state.pendingMessages };
        if (!updatedPendingMessages[roomId]) {
          updatedPendingMessages[roomId] = [];
        }
        updatedPendingMessages[roomId].push(content);
        console.log(`Message queued for room ${roomId}`);
        return { pendingMessages: updatedPendingMessages };
      });
    }
  },

  sendTypingIndicator: (roomId, isTyping) => {
    const { instance, status } = get();

    if (!roomId || status !== "connected" || !instance) return;

    const message: ClientMessage = {
      type: "typing",
      room_id: roomId,
      data: { is_typing: isTyping },
    };

    instance.send(JSON.stringify(message));
  },

  createThread: async (title) => {
    return new Promise<string>((resolve, reject) => {
      const { instance, status } = get();

      // Update pending thread creation
      set((state) => ({
        pendingThreadCreation: {
          ...state.pendingThreadCreation,
          title,
          callback: (threadId) => {
            resolve(threadId);
            // If there was a previous callback, call it too
            if (state.pendingThreadCreation?.callback) {
              state.pendingThreadCreation.callback(threadId);
            }
          },
        },
      }));

      // If connected, send the create thread message
      if (status === "connected" && instance) {
        const message: ClientMessage = {
          type: "create_thread",
          data: { title },
        };
        instance.send(JSON.stringify(message));
      } else {
        // If not connected, try to connect
        get()
          .connect()
          .catch((error) => {
            reject(error);
          });
      }
    });
  },

  _handleMessage: (event) => {
    try {
      const data = JSON.parse(event.data) as ServerMessage;

      // Handle different message types
      switch (data.type) {
        case "message":
          // Add received message to the store
          useMessageStore.getState().addMessage(data);
          break;

        case "message_sent":
          // Handle message send confirmation if needed
          break;

        case "thread_created":
          // Handle thread creation confirmation
          if (data.success && data.thread_id) {
            const { pendingThreadCreation } = get();
            const threadTitle =
              data.data?.title || pendingThreadCreation?.title || "New Chat";

            // Add thread to thread store
            const threadId = data.thread_id;
            useThreadStore.getState().setCurrentThread(threadId);

            // Subscribe to the new thread
            get().subscribeToRoom(threadId);

            // Clear pending thread creation
            if (pendingThreadCreation?.callback) {
              pendingThreadCreation.callback(threadId);
            }
            set({ pendingThreadCreation: null });
          } else {
            console.error("Failed to create thread:", data.message);
          }
          break;

        case "typing":
          // Handle typing indicators
          if (data.room_id && data.user_id && data.data) {
            set((state) => {
              const roomTypers = state.typingUsers[data.room_id] || [];
              const typerIndex = roomTypers.findIndex(
                (t) => t.userId === data.user_id,
              );

              let updatedRoomTypers = [...roomTypers];

              if (data.data.is_typing) {
                // Add or update typing user
                const typer = {
                  userId: data.user_id,
                  userName: data.data.user_name || "Unknown",
                  timestamp: Date.now(),
                };

                if (typerIndex >= 0) {
                  // Update existing
                  updatedRoomTypers[typerIndex] = typer;
                } else {
                  // Add new
                  updatedRoomTypers.push(typer);
                }
              } else if (typerIndex >= 0) {
                // Remove typing user
                updatedRoomTypers.splice(typerIndex, 1);
              }

              return {
                typingUsers: {
                  ...state.typingUsers,
                  [data.room_id]: updatedRoomTypers,
                },
              };
            });
          }
          break;

        case "read":
          // Handle read receipts
          break;

        default:
          console.log("Unhandled message type:", data.type);
      }
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error);
    }
  },

  _cleanupStaleTypingIndicators: () => {
    set((state) => {
      const now = Date.now();
      const updatedTypingUsers = { ...state.typingUsers };
      let hasChanges = false;

      // Check each room
      Object.keys(updatedTypingUsers).forEach((roomId) => {
        // Filter out typing indicators older than 3 seconds
        const freshTypers = updatedTypingUsers[roomId].filter(
          (user) => now - user.timestamp < 3000,
        );

        if (freshTypers.length !== updatedTypingUsers[roomId].length) {
          hasChanges = true;

          if (freshTypers.length === 0) {
            delete updatedTypingUsers[roomId];
          } else {
            updatedTypingUsers[roomId] = freshTypers;
          }
        }
      });

      // Only update state if there were changes
      return hasChanges ? { typingUsers: updatedTypingUsers } : state;
    });
  },
}));
