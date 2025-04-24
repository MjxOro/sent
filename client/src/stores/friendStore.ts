// src/stores/friendStore.ts
import { create } from "zustand";

// Types
export interface Friend {
  id: string;
  user_id: string;
  friend_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  friend_name: string;
  friend_email: string;
  friend_avatar: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  created_at?: string;
  updated_at?: string;
}

interface FriendState {
  // State
  friends: Friend[];
  pendingRequests: Friend[];
  potentialFriends: User[];
  isLoading: {
    friends: boolean;
    requests: boolean;
    potential: boolean;
  };
  errors: {
    friends: string | null;
    requests: string | null;
    potential: string | null;
  };

  // Actions
  loadFriends: () => Promise<void>;
  loadPendingRequests: () => Promise<void>;
  loadPotentialFriends: (limit?: number, offset?: number) => Promise<void>;
  sendFriendRequest: (userId: string) => Promise<void>;
  acceptFriendRequest: (friendshipId: string) => Promise<void>;
  rejectFriendRequest: (friendshipId: string) => Promise<void>;
  removeFriend: (userId: string) => Promise<void>;
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  getFriendshipStatus: (userId: string) => Promise<string>;
}

export const useFriendStore = create<FriendState>()((set, get) => ({
  // Initial state
  friends: [],
  pendingRequests: [],
  potentialFriends: [],
  isLoading: {
    friends: false,
    requests: false,
    potential: false,
  },
  errors: {
    friends: null,
    requests: null,
    potential: null,
  },

  // Actions
  loadFriends: async () => {
    set((state) => ({
      isLoading: { ...state.isLoading, friends: true },
      errors: { ...state.errors, friends: null },
    }));

    try {
      const response = await fetch("/api/friends", {
        credentials: "include", // Important for cookie auth
      });

      if (!response.ok) {
        throw new Error("Failed to load friends");
      }

      const friends: Friend[] = await response.json();

      set({
        friends,
        isLoading: { ...get().isLoading, friends: false },
      });
    } catch (error) {
      console.error("Error loading friends:", error);
      set({
        isLoading: { ...get().isLoading, friends: false },
        errors: {
          ...get().errors,
          friends: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  },

  loadPendingRequests: async () => {
    set((state) => ({
      isLoading: { ...state.isLoading, requests: true },
      errors: { ...state.errors, requests: null },
    }));

    try {
      const response = await fetch("/api/friends/requests", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to load friend requests");
      }

      const pendingRequests: Friend[] = await response.json();

      set({
        pendingRequests,
        isLoading: { ...get().isLoading, requests: false },
      });
    } catch (error) {
      console.error("Error loading friend requests:", error);
      set({
        isLoading: { ...get().isLoading, requests: false },
        errors: {
          ...get().errors,
          requests: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  },

  loadPotentialFriends: async (limit = 20, offset = 0) => {
    set((state) => ({
      isLoading: { ...state.isLoading, potential: true },
      errors: { ...state.errors, potential: null },
    }));

    try {
      const response = await fetch(
        `/api/friends/potential?limit=${limit}&offset=${offset}`,
        {
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load potential friends");
      }

      const potentialFriends: User[] = await response.json();

      set({
        potentialFriends,
        isLoading: { ...get().isLoading, potential: false },
      });
    } catch (error) {
      console.error("Error loading potential friends:", error);
      set({
        isLoading: { ...get().isLoading, potential: false },
        errors: {
          ...get().errors,
          potential: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  },

  sendFriendRequest: async (userId: string) => {
    try {
      const response = await fetch(`/api/friends/request/${userId}`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to send friend request");
      }

      // Refresh potential friends list
      await get().loadPotentialFriends();
    } catch (error) {
      console.error("Error sending friend request:", error);
      throw error;
    }
  },

  acceptFriendRequest: async (friendshipId: string) => {
    try {
      const response = await fetch(`/api/friends/accept/${friendshipId}`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to accept friend request");
      }

      // Remove from pending requests
      set((state) => ({
        pendingRequests: state.pendingRequests.filter(
          (req) => req.id !== friendshipId,
        ),
      }));

      // Refresh friends list
      await get().loadFriends();
    } catch (error) {
      console.error("Error accepting friend request:", error);
      throw error;
    }
  },

  rejectFriendRequest: async (friendshipId: string) => {
    try {
      const response = await fetch(`/api/friends/reject/${friendshipId}`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to reject friend request");
      }

      // Remove from pending requests
      set((state) => ({
        pendingRequests: state.pendingRequests.filter(
          (req) => req.id !== friendshipId,
        ),
      }));
    } catch (error) {
      console.error("Error rejecting friend request:", error);
      throw error;
    }
  },

  removeFriend: async (userId: string) => {
    try {
      const response = await fetch(`/api/friends/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to remove friend");
      }

      // Remove from friends list
      set((state) => ({
        friends: state.friends.filter(
          (friend) => friend.friend_id !== userId && friend.user_id !== userId,
        ),
      }));
    } catch (error) {
      console.error("Error removing friend:", error);
      throw error;
    }
  },

  blockUser: async (userId: string) => {
    try {
      const response = await fetch(`/api/friends/block/${userId}`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to block user");
      }

      // Refresh lists
      await Promise.all([
        get().loadFriends(),
        get().loadPendingRequests(),
        get().loadPotentialFriends(),
      ]);
    } catch (error) {
      console.error("Error blocking user:", error);
      throw error;
    }
  },

  unblockUser: async (userId: string) => {
    try {
      const response = await fetch(`/api/friends/unblock/${userId}`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to unblock user");
      }

      // Refresh lists after unblocking
      await Promise.all([get().loadFriends(), get().loadPotentialFriends()]);
    } catch (error) {
      console.error("Error unblocking user:", error);
      throw error;
    }
  },

  getFriendshipStatus: async (userId: string) => {
    try {
      const response = await fetch(`/api/friends/status/${userId}`, {
        credentials: "include",
      });

      const data = await response.json();
      return data.status;
    } catch (error) {
      console.error("Error getting friendship status:", error);
      return "none";
    }
  },
}));
