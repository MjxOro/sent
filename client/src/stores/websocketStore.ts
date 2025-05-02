// src/stores/websocketStore.ts
import { create } from "zustand";
import { useMessageStore } from "./messageStore";
import { useThreadStore } from "./threadStore";
import { useNotificationStore } from "./notificationStore";
import { useFriendStore } from "./friendStore";

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
  lastConnectedRoomId: string | null;
  saveLastConnectedRoom: (roomId: string) => void;

  // Message actions
  sendMessage: (roomId: string | null, content: string) => void;
  sendTypingIndicator: (roomId: string, isTyping: boolean) => void;
  createThread: (title: string) => Promise<string>;

  // Read message tracking
  markMessagesAsRead: (roomId: string, messageIds: string[]) => void;

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
  lastConnectedRoomId: localStorage.getItem("lastConnectedRoomId") || null,
  saveLastConnectedRoom: (roomId) => {
    if (roomId) {
      localStorage.setItem("lastConnectedRoomId", roomId);
      set({ lastConnectedRoomId: roomId });
    }
  },

  // Connection actions
  connect: async () => {
    // If already connecting or connected, don't try again
    const currentStatus = get().status;
    if (currentStatus === "connecting" || currentStatus === "connected") {
      console.log(
        `Already ${currentStatus} to WebSocket, skipping connection attempt`,
      );
      return;
    }

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

      // Setup WebSocket event handlers
      // Update in websocketStore.ts in the connect method
      (ws.onopen = () => {
        console.log("WebSocket connected!");
        set({ status: "connected", instance: ws });

        // Reconnect to active rooms ONE AT A TIME with a slight delay
        // This prevents flooding the server with subscription requests
        const { activeRooms, lastConnectedRoomId } = get();

        // If no active rooms but we have a last connected room,
        // add it to active rooms
        if (activeRooms.size === 0 && lastConnectedRoomId) {
          activeRooms.add(lastConnectedRoomId);
        }

        // Convert Set to Array for easier iteration with delay
        const roomsArray = Array.from(activeRooms);

        // Subscribe to rooms with a 100ms delay between each
        roomsArray.forEach((roomId, index) => {
          setTimeout(() => {
            // Check if the instance is still valid
            if (get().instance && get().status === "connected") {
              const message = {
                type: "subscribe",
                room_id: roomId,
              };
              get().instance?.send(JSON.stringify(message));
              console.log("Resubscribed to room:", roomId);
            }
          }, index * 100); // 100ms delay between subscriptions
        });

        // Handle any pending messages
        // ... rest of the existing code
      }),
        (ws.onclose = (event) => {
          console.log("WebSocket closed:", event.code, event.reason);

          // Only set disconnected if we're not in error state (might be reconnecting)
          if (get().status !== "error") {
            set({ status: "disconnected", instance: null });
          }

          // Auto-reconnect unless this was a normal closure
          if (event.code !== 1000) {
            console.log(
              "Abnormal close, attempting to reconnect in 5 seconds...",
            );
            setTimeout(() => {
              console.log("Reconnecting to WebSocket...");
              get().connect();
            }, 5000);
          }
        });

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        set({ status: "error", instance: null });
      };

      ws.onmessage = (event) => {
        console.log("WebSocket message received:", event.data);
        get()._handleMessage(event);
      };
    } catch (error) {
      set({ status: "error", instance: null });
      console.error("Error connecting to WebSocket:", error);

      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        console.log("Attempting to reconnect after error...");
        get().connect();
      }, 5000);
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
  // In websocketStore.ts - update subscribeToRoom method
  subscribeToRoom: (roomId) => {
    const { instance, status, activeRooms } = get();

    if (!roomId) return;

    // NEW CHECK: Skip if already subscribed to this room
    if (activeRooms.has(roomId)) {
      console.log(
        `Already subscribed to room ${roomId}, skipping duplicate subscription`,
      );
      return;
    }

    // Add to active rooms set
    const newActiveRooms = new Set(activeRooms);
    newActiveRooms.add(roomId);
    set({ activeRooms: newActiveRooms });

    // Save as last connected room
    get().saveLastConnectedRoom(roomId);

    // Load messages for this room
    useMessageStore.getState().loadMessages(roomId, true);

    // If not connected, just keep in active rooms to subscribe later
    if (status !== "connected" || !instance) {
      if (status === "disconnected") {
        get().connect();
      }
      return;
    }

    // If connected, send subscription message
    console.log(`Subscribing to room ${roomId}`);
    const message = {
      type: "subscribe",
      room_id: roomId,
    };

    try {
      instance.send(JSON.stringify(message));
    } catch (err) {
      console.error(`Error subscribing to room ${roomId}:`, err);
      // No need for complex error handling in basic chat
    }
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

    const { instance, status, activeRooms } = get();
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

        // FIX: Add extra safety with try-catch blocks
        let messageString;
        try {
          messageString = JSON.stringify(message);
          console.log("Stringified message:", messageString);
        } catch (err) {
          console.error("Error stringifying message:", err);
          queueMessage(roomId, content.trim());
          return;
        }

        // Check if websocket is still open before sending
        if (instance.readyState !== WebSocket.OPEN) {
          console.log("WebSocket is no longer open, reconnecting...");
          queueMessage(roomId, content.trim());
          get().connect();
          return;
        }

        instance.send(messageString);
        console.log("Message sent successfully");
      } catch (err) {
        console.error("Error sending message:", err);
        // Queue message if sending fails
        queueMessage(roomId, content.trim());

        // Try to reconnect
        setTimeout(() => {
          get().connect();
        }, 1000);
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

  // Mark messages as read
  markMessagesAsRead: (roomId, messageIds) => {
    const { instance, status } = get();

    if (!roomId || !messageIds.length || status !== "connected" || !instance)
      return;

    console.log(`Marking messages as read in room ${roomId}:`, messageIds);

    // Send read receipt via WebSocket
    const message: ClientMessage = {
      type: "read",
      room_id: roomId,
      data: { message_ids: messageIds },
    };

    try {
      instance.send(JSON.stringify(message));

      // Update the UI immediately (optimistic update)
      useMessageStore.getState().markMessagesAsRead(roomId, messageIds);

      // Reset unread count for this thread
      useThreadStore.getState().resetUnreadCount(roomId);
    } catch (err) {
      console.error("Error sending read receipts:", err);
    }
  },

  _handleMessage: (event) => {
    try {
      console.log("Received WebSocket message:", event.data);
      const data = JSON.parse(event.data) as ServerMessage;
      console.log("Parsed message:", data);

      const { addNotification } = useNotificationStore.getState();

      // Handle different message types
      switch (data.type) {
        case "message":
          // Validate all required fields exist
          if (!data.id || !data.room_id || !data.content || !data.created_at) {
            console.error("Received message missing required fields:", data);
            return;
          }

          console.log("Adding message to store:", data);
          // Add received message to the store
          useMessageStore.getState().addMessage(data);

          // If message is not from current user and not in active thread,
          // create a notification
          const currentThreadId = useThreadStore.getState().currentThreadId;
          const userId = localStorage.getItem("userId");

          if (data.user_id !== userId && data.room_id !== currentThreadId) {
            // Get username
            const userName = data.user_name || "Someone";

            // Create notification
            addNotification({
              type: "message",
              title: `New message from ${userName}`,
              message:
                data.content.length > 50
                  ? `${data.content.substring(0, 47)}...`
                  : data.content,
              sourceId: data.room_id,
            });
          }
          break;

        case "message_sent":
          // Handle message send confirmation
          if (data.success && data.message_id && data.room_id) {
            console.log("Message sent confirmation received:", data);

            // Since messages are added by the server broadcast in the "message" case,
            // we don't need to add a new message here. The server should broadcast
            // the message to all clients (including the sender) after saving it.

            // However, if you notice messages not appearing immediately after sending,
            // you could fetch the latest messages for the room:
            if (data.room_id) {
              // Optionally refresh messages for this room
              useMessageStore.getState().loadMessages(data.room_id, true);
            }
          }
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
          if (data.room_id && data.user_id && data.message_ids) {
            // Update message read status in the UI
            // This is useful if you want to show read receipts for messages
            console.log(
              `User ${data.user_id} read messages:`,
              data.message_ids,
            );

            // You could update individual message objects to show "read by" info
            // For now, we'll just acknowledge it
          }
          break;

        case "friend_request":
          // Handle incoming friend request
          if (data.user_id && data.user_name) {
            // Add a notification for the friend request
            addNotification({
              type: "friend_request",
              title: "New Friend Request",
              message: `${data.user_name} sent you a friend request`,
              sourceId: data.friendship_id,
            });

            // Refresh friend requests
            useFriendStore.getState().loadPendingRequests();
          }
          break;

        case "friend_accepted":
          // Handle friend request accepted
          if (data.user_id && data.user_name) {
            // Add a notification
            addNotification({
              type: "friend_accepted",
              title: "Friend Request Accepted",
              message: `${data.user_name} accepted your friend request`,
              sourceId: data.user_id,
            });

            // Refresh friends list
            useFriendStore.getState().loadFriends();
          }
          break;

        default:
          console.log("Unhandled message type:", data.type);
      }
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error, event.data);
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
