// src/stores/notificationStore.ts
import { create } from "zustand";
import { useAuthStore } from "./authStore";
import { useFriendStore } from "./friendStore";

export interface Notification {
  id: string;
  type: "message" | "friend_request" | "friend_accepted" | "system";
  title: string;
  message: string;
  sourceId?: string; // roomId or friendshipId
  isRead: boolean;
  timestamp: Date;
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

      const notificationList: Notification[] = pendingRequests.map(
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
