// src/stores/websocketStore.ts
import { create } from "zustand";
import { useMessageStore, Message } from "./messageStore";
import { useThreadStore } from "./threadStore";
import { useNotificationStore } from "./notificationStore";
import { useFriendStore } from "./friendStore";
import { useAuthStore, User } from "./authStore";

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
  id?: string;
  room_id?: string;
  user_id?: string;
  content?: string;
  created_at?: string | Date;
  updated_at?: string | Date;
  user_name?: string;
  user_avatar?: string;
  message_id?: string;
  thread_id?: string;
  success?: boolean;
  message?: string;
  message_ids?: string[];

  // Update data to include chat invite fields
  data?: {
    title?: string;
    is_typing?: boolean;
    user_name?: string;
    roomId?: string;
    roomName?: string;
    inviterId?: string;
    inviterName?: string;
    // Add these new fields for Redis notifications
    content?: string;
    room_id?: string;
    message_id?: string;
    sender_avatar?: string;
  };

  // For chat invites
  inviter_id?: string;
  inviter_name?: string;
  room_name?: string;

  friendship_id?: string;
}
// Message types to send to server
interface ClientMessage {
  type: string;
  room_id?: string;
  content?: string;
  data?: Record<string, unknown>;
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
  lastConnectedRoomId: null,
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

      const ws = new WebSocket(wsUrl);

      // Setup WebSocket event handlers
      ws.onopen = () => {
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
            }
          }, index * 100); // 100ms delay between subscriptions
        });

        // Handle any pending messages
        // ... rest of the existing code
      };

      ws.onclose = (event) => {
        // Only set disconnected if we're not in error state (might be reconnecting)
        if (get().status !== "error") {
          set({ status: "disconnected", instance: null });
        }

        // Auto-reconnect unless this was a normal closure
        if (event.code !== 1000) {
          console.error(
            "Abnormal close, attempting to reconnect in 5 seconds...",
          );
          setTimeout(() => {
            console.error("Reconnecting to WebSocket...");
            get().connect();
          }, 5000);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        set({ status: "error", instance: null });
      };

      ws.onmessage = (event) => {
        get()._handleMessage(event);
      };
    } catch (error) {
      set({ status: "error", instance: null });
      console.error("Error connecting to WebSocket:", error);

      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        console.error("Attempting to reconnect after error...");
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
  subscribeToRoom: (roomId) => {
    const { instance, status, activeRooms } = get();

    if (!roomId) return;

    if (activeRooms.has(roomId)) {
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
    const { instance, status } = get();

    // If we don't have a current room ID, we need to create a new thread first
    if (!roomId) {
      const title =
        content.length > 30 ? content.substring(0, 27) + "..." : content;

      // Queue the message to be sent after thread creation
      set({
        pendingThreadCreation: {
          title,
          callback: (newThreadId) => {
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

    // If WebSocket is connected, send through it
    if (instance && status === "connected") {
      try {
        let messageString;
        try {
          messageString = JSON.stringify(message);
        } catch (err) {
          console.error("Error stringifying message:", err);
          queueMessage(roomId, content.trim());
          return;
        }

        // Check if websocket is still open before sending
        if (instance.readyState !== WebSocket.OPEN) {
          queueMessage(roomId, content.trim());
          get().connect();
          return;
        }

        instance.send(messageString);
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
      const data = JSON.parse(event.data) as ServerMessage;

      const { addNotification } = useNotificationStore.getState();
      const currentUser = useAuthStore.getState().user;
      const currentThreadId = useThreadStore.getState().currentThreadId;

      // Handle different message types
      switch (data.type) {
        case "message":
          // Validate all required fields exist
          if (data.data && data.data.room_id && data.data.content) {
            console.log("WORKED");
            if (data.user_id !== currentUser?.id) {
              addNotification({
                type: "message",
                title: `New message from ${data.user_name}`,
                message: data.data.content,
                sourceId: data.data.room_id,
                data: {
                  roomId: data.data.room_id,
                  inviterId: data.user_id,
                  inviterAvatar: data.data.sender_avatar,
                },
              });
            }
          }
          if (!data.id || !data.room_id || !data.content || !data.created_at) {
            console.error("Received message missing required fields:", data);
            return;
          }
          const messageObj: Message = {
            id: data.id,
            room_id: data.room_id,
            user_id: data.user_id || "",
            content: data.content,
            created_at: data.created_at as string,
            updated_at: data.updated_at as string,
            user_name: data.user_name,
            user_avatar: data.user_avatar,
          };
          // Add received message to the store
          useMessageStore.getState().addMessage(messageObj);

          // If message is not from current user and not in active thread,
          // create a notification
          break;

        case "message_sent":
          // Handle message send confirmation
          if (data.success && data.message_id && data.room_id) {
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
              const roomTypers = state.typingUsers[data.room_id || ""] || [];
              const typerIndex = roomTypers.findIndex(
                (t) => t.userId === data.user_id,
              );

              const updatedRoomTypers = [...roomTypers];

              if (data.data?.is_typing) {
                // Add or update typing user
                const typer = {
                  userId: data.user_id || "",
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
                  [data.room_id || ""]: updatedRoomTypers,
                },
              };
            });
          }
          break;

        case "read":
          // Handle read receipts
          if (data.room_id && data.user_id && data.message_ids) {
            // Add implementation if needed
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
              sourceId: data?.friendship_id,
              data: {
                userId: data.user_id,
                userName: data.user_name,
                userAvatar: data?.user_avatar,
              },
            });

            // Refresh friends list
            useFriendStore.getState().loadFriends();
          }
          break;
        case "chat_invite":
          addNotification({
            type: "chat_invite",
            title: "Chat Invitation",
            message: `${data.inviter_name} invited you to ${data.room_name}`,
            sourceId: data.room_id,
            data: {
              roomId: data?.room_id,
              roomName: data?.room_name,
              inviterId: data?.inviter_id,
              inviterName: data?.inviter_name,
            },
            status: "pending",
          });
          break;
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
