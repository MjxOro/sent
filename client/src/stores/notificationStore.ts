// src/stores/notificationStore.ts
import { create } from "zustand";
import { useFriendStore } from "./friendStore";
import { useThreadStore } from "./threadStore";

interface ChatInviteData {
  // Chat invite fields
  roomId?: string;
  roomName?: string;
  inviterId?: string;
  inviterName?: string;

  // Friend request/acceptance fields
  userId?: string;
  userName?: string;
  userAvatar?: string;
  friendshipId?: string;

  // Message fields
  inviterAvatar?: string;
}

export type NotificationType =
  | "message" // New chat messages
  | "friend_request" // Friend requests
  | "friend_accepted" // When someone accepts your friend request
  | "chat_invite" // Room/chat invitations
  | "system"; // System notifications

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  sourceId?: string; // roomId or friendshipId
  data?: ChatInviteData;
  isRead: boolean;
  timestamp: Date;
  status?: string;
}

interface NotificationState {
  // State
  notifications: Notification[];
  unreadCount: number;
  // Actions
  addNotification: (
    notification: Omit<Notification, "id" | "isRead" | "timestamp">,
  ) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  loadNotifications: () => Promise<void>;
  handleChatInvite: (notification: Notification) => Promise<string>;
  declineChatInvite: (notificationId: string) => void;
  getChatInvites: () => Notification[];
  getNotificationsByType: (args: NotificationType) => Notification[];
  getFirstNotificationByType: (
    args: NotificationType,
  ) => Notification | undefined;
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  // Initial state
  notifications: [],
  unreadCount: 0,

  // Actions
  addNotification: (notification) => {
    const newNotification: Notification = {
      id: crypto.randomUUID(),
      isRead: false,
      timestamp: new Date(),
      ...notification,
    };

    set((state) => {
      const updatedNotifications = [newNotification, ...state.notifications];
      // Only keep most recent 50 notifications
      const trimmedNotifications = updatedNotifications.slice(0, 50);

      return {
        notifications: trimmedNotifications,
        unreadCount: state.unreadCount + 1,
      };
    });
  },
  handleChatInvite: async (notification) => {
    if (notification.type !== "chat_invite") {
      throw new Error("Invalid notification type");
    }

    try {
      // First update the notification status
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === notification.id
            ? {
                ...n,
                status: "accepted",
                isRead: true,
              }
            : n,
        ),
      }));

      // Make sure we have the room data
      const roomData = notification.data as ChatInviteData;
      if (!roomData?.roomId) {
        throw new Error("Missing room data");
      }

      // Refresh threads to include the new room
      await useThreadStore.getState().loadThreads();

      // Return the roomId for navigation
      return roomData.roomId;
    } catch (error) {
      // Revert notification status on error
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === notification.id ? { ...n, status: "pending" } : n,
        ),
      }));
      throw error;
    }
  },

  declineChatInvite: async (notificationId) => {
    try {
      // Update notification status
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === notificationId
            ? {
                ...n,
                status: "declined",
                isRead: true,
              }
            : n,
        ),
      }));

      // Could add API call here to notify server of decline
      // await api.declineChatInvite(notificationId);
    } catch (error) {
      console.error("Failed to decline chat invite:", error);
      throw error;
    }
  },

  getNotificationsByType: (type) => {
    return get().notifications.filter((n) => n.type === type && !n.isRead);
  },

  getFirstNotificationByType: (type: NotificationType) => {
    return get().notifications.find((n) => n.type === type && !n.isRead);
  },
  markAsRead: (notificationId) => {
    set((state) => {
      const updatedNotifications = state.notifications.map((notification) =>
        notification.id === notificationId
          ? { ...notification, isRead: true }
          : notification,
      );

      const unreadCount = updatedNotifications.filter((n) => !n.isRead).length;

      return {
        notifications: updatedNotifications,
        unreadCount,
      };
    });
  },

  getChatInvites: () => {
    return get().notifications.filter(
      (n) => n.type === "chat_invite" && !n.isRead,
    );
  },
  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((notification) => ({
        ...notification,
        isRead: true,
      })),
      unreadCount: 0,
    }));
  },

  clearNotifications: () => {
    set({
      notifications: [],
      unreadCount: 0,
    });
  },

  loadNotifications: async () => {
    // Create initial notification list from friend requests
    try {
      const pendingRequests = useFriendStore.getState().pendingRequests;

      const notificationList: Notification[] = pendingRequests?.map(
        (request) => ({
          id: `friend-req-${request.id}`,
          type: "friend_request",
          title: "Friend Request",
          message: `${request.friend_name} sent you a friend request`,
          sourceId: request.id,
          isRead: false,
          timestamp: new Date(request.created_at),
        }),
      );

      set({
        notifications: notificationList,
        unreadCount: notificationList.length,
      });
    } catch (error) {
      console.error("Failed to load initial notifications:", error);
    }
  },
}));
