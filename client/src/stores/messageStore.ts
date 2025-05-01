// src/stores/messageStore.ts (updated with read status)
import { create } from "zustand";
import { useThreadStore } from "./threadStore";

// Types
export interface Message {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at?: string;
  user_name?: string;
  user_avatar?: string;
  read_by?: string[]; // Array of user IDs who have read this message
  formatted?: {
    role: "user" | "assistant" | "system";
    timestamp: Date;
  };
}

interface MessageState {
  // State
  messages: Record<string, Message[]>; // Keyed by room_id
  messageLoadInfo: Record<
    string,
    {
      isLoading: boolean;
      hasMoreMessages: boolean;
      offset: number;
      error: string | null;
    }
  >;

  // Actions
  loadMessages: (roomId: string, refresh?: boolean) => Promise<void>;
  loadMoreMessages: (roomId: string) => Promise<void>;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  clearMessages: (roomId: string) => void;
  markMessagesAsRead: (roomId: string, messageIds: string[]) => Promise<void>;

  // Get unread messages in a room
  getUnreadMessages: (roomId: string) => Message[];
}

export const useMessageStore = create<MessageState>()((set, get) => ({
  // Initial state
  messages: {},
  messageLoadInfo: {},

  // Actions
  loadMessages: async (roomId, refresh = false) => {
    if (!roomId) return;

    // Get current state for this room
    const currentLoadInfo = get().messageLoadInfo[roomId] || {
      isLoading: false,
      hasMoreMessages: true,
      offset: 0,
      error: null,
    };

    // If already loading or no more messages, return
    if (
      currentLoadInfo.isLoading ||
      (!refresh && !currentLoadInfo.hasMoreMessages)
    ) {
      return;
    }

    try {
      // Update loading state
      set((state) => ({
        messageLoadInfo: {
          ...state.messageLoadInfo,
          [roomId]: {
            ...currentLoadInfo,
            isLoading: true,
            error: null,
          },
        },
      }));

      // Determine offset - if refreshing, start from 0
      const offset = refresh ? 0 : currentLoadInfo.offset;
      const limit = 50; // Number of messages to fetch

      // Fetch messages from API (using cookie auth approach)
      const response = await fetch(
        `/api/rooms/${roomId}/messages?offset=${offset}&limit=${limit}`,
      );

      if (!response.ok) {
        throw new Error("Failed to load messages");
      }

      const messagesData: Message[] = await response.json();

      // Update thread's last message if we have messages and refreshing
      if (messagesData.length > 0 && refresh) {
        // Find the most recent message
        const latestMessage = messagesData.reduce((latest, current) => {
          const latestDate = new Date(latest.created_at).getTime();
          const currentDate = new Date(current.created_at).getTime();
          return currentDate > latestDate ? current : latest;
        }, messagesData[0]);

        // Update the thread with the latest message
        useThreadStore
          .getState()
          .updateThreadLastMessage(roomId, latestMessage);
      }

      // Format messages
      const formattedMessages: Message[] = messagesData.map((msg) => ({
        ...msg,
        formatted: {
          role:
            msg.user_id === "system"
              ? "system"
              : msg.user_id === localStorage.getItem("userId")
                ? "user"
                : "assistant",
          timestamp: new Date(msg.created_at),
        },
      }));

      // Update state
      set((state) => {
        const currentMessages = refresh ? [] : state.messages[roomId] || [];

        // Add new messages - avoid duplicates by ID
        const existingIds = new Set(currentMessages.map((m) => m.id));
        const newMessages = formattedMessages.filter(
          (m) => !existingIds.has(m.id),
        );

        // Sort messages newest first (for rendering in reverse)
        // const allMessages = [...currentMessages, ...newMessages]
        const allMessages = [...newMessages, ...currentMessages];

        return {
          messages: {
            ...state.messages,
            [roomId]: allMessages,
          },
          messageLoadInfo: {
            ...state.messageLoadInfo,
            [roomId]: {
              isLoading: false,
              hasMoreMessages: messagesData.length === limit,
              offset: offset + messagesData.length,
              error: null,
            },
          },
        };
      });

      // Reset unread count for this room
      useThreadStore.getState().resetUnreadCount(roomId);
    } catch (error) {
      console.error("Error loading messages:", error);

      // Update error state
      set((state) => ({
        messageLoadInfo: {
          ...state.messageLoadInfo,
          [roomId]: {
            ...currentLoadInfo,
            isLoading: false,
            error: error instanceof Error ? error.message : "Unknown error",
          },
        },
      }));
    }
  },

  loadMoreMessages: async (roomId) => {
    // Just call loadMessages - it handles pagination internally
    await get().loadMessages(roomId, false);
  },

  addMessage: (message) => {
    const roomId = message.room_id;

    // Ensure the message has the formatted property that matches our Message type
    const formattedMessage: Message = {
      ...message,
      formatted: message.formatted || {
        role:
          message.user_id === "system"
            ? "system"
            : message.user_id === localStorage.getItem("userId")
              ? "user"
              : "assistant",
        timestamp: new Date(message.created_at),
      },
    };

    // Update state
    set((state) => {
      const currentMessages = state.messages[roomId] || [];

      // Check if message already exists by ID
      if (currentMessages.some((m) => m.id === message.id)) {
        return state; // Message already exists, no update needed
      }

      // Add message and sort (newest first)
      // const updatedMessages = [formattedMessage, ...currentMessages];
      const updatedMessages = [...currentMessages, formattedMessage];

      return {
        messages: {
          ...state.messages,
          [roomId]: updatedMessages,
        },
      };
    });

    // Update thread with last message
    useThreadStore.getState().updateThreadLastMessage(roomId, message);

    // If message is not from current user, increment unread count
    if (message.user_id !== localStorage.getItem("userId")) {
      // Only increment if this isn't the active thread
      if (useThreadStore.getState().currentThreadId !== roomId) {
        useThreadStore.getState().incrementUnreadCount(roomId);
      }
    }
  },

  updateMessage: (messageId, updates) => {
    set((state) => {
      // Create a new messages object with the update applied
      const updatedMessages = { ...state.messages };

      // Find the room containing this message
      for (const roomId in updatedMessages) {
        const roomMessages = updatedMessages[roomId];
        const messageIndex = roomMessages.findIndex((m) => m.id === messageId);

        if (messageIndex >= 0) {
          // Update the message
          const updatedRoomMessages = [...roomMessages];
          updatedRoomMessages[messageIndex] = {
            ...updatedRoomMessages[messageIndex],
            ...updates,
          };

          updatedMessages[roomId] = updatedRoomMessages;
          break;
        }
      }

      return { messages: updatedMessages };
    });
  },

  clearMessages: (roomId) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [roomId]: [],
      },
      messageLoadInfo: {
        ...state.messageLoadInfo,
        [roomId]: {
          isLoading: false,
          hasMoreMessages: true,
          offset: 0,
          error: null,
        },
      },
    }));
  },

  markMessagesAsRead: async (roomId, messageIds) => {
    if (!roomId || !messageIds.length) return;

    const userId = localStorage.getItem("userId");
    if (!userId) return;

    try {
      // API call to mark messages as read (using cookie auth approach)
      const response = await fetch(`/api/rooms/${roomId}/read`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message_ids: messageIds }),
      });

      if (!response.ok) {
        throw new Error("Failed to mark messages as read");
      }

      // Update local message state to reflect read status
      set((state) => {
        const roomMessages = state.messages[roomId];
        if (!roomMessages) return state;

        const updatedMessages = roomMessages.map((message) => {
          if (messageIds.includes(message.id)) {
            // Create or update read_by array
            const readBy = message.read_by || [];
            if (!readBy.includes(userId)) {
              return {
                ...message,
                read_by: [...readBy, userId],
              };
            }
          }
          return message;
        });

        return {
          messages: {
            ...state.messages,
            [roomId]: updatedMessages,
          },
        };
      });

      // Reset unread count for this thread
      useThreadStore.getState().resetUnreadCount(roomId);
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  },

  // Get unread messages for a specific room
  getUnreadMessages: (roomId) => {
    const messages = get().messages[roomId] || [];
    const userId = localStorage.getItem("userId");

    if (!userId) return [];

    // Return messages that haven't been read by the current user
    // and weren't sent by the current user
    return messages.filter(
      (message) =>
        message.user_id !== userId &&
        (!message.read_by || !message.read_by.includes(userId)),
    );
  },
}));
