// stores/authStore.ts
import { create } from "zustand";
import { jwtVerify, JWTVerifyResult } from "jose";

// Define User type with proper field structure
export interface User {
  id: string; // Changed from user_id to id
  email: string;
  name: string;
  avatar?: string; // Optional avatar field
  roles?: string[];
  [key: string]: any; // Allow additional fields
}

// Define JWT payload structure
interface JWTPayload {
  sub: string; // This will become id
  email: string;
  name: string;
  avatar?: string; // Optional avatar
  roles?: string[];
  exp: number;
  iat: number;
  [key: string]: any;
}

// Define the store state and actions
export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
  parseToken: (token: string) => Promise<User | null>;
}

// Create the store
export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isLoading: false,
  isAuthenticated: false,
  error: null,

  parseToken: async (token: string): Promise<User | null> => {
    try {
      // Use jose to verify and decode the token
      const secret = new TextEncoder().encode(
        process.env.JWT_SECRET ||
          process.env.NEXT_PUBLIC_JWT_SECRET ||
          "secret",
      );

      const { payload } = (await jwtVerify(
        token,
        secret,
      )) as JWTVerifyResult<JWTPayload>;

      // Check token expiration
      const currentTime = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < currentTime) {
        set({ error: "Token expired" });
        return null;
      }

      // Convert JWT payload to user object with proper field structure
      const { sub, email, name, avatar, roles, ...restPayload } = payload;

      // Generate avatar URL if not present but email exists
      const userAvatar =
        avatar ||
        (email
          ? `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
          : undefined);

      return {
        id: sub, // Map sub to id
        email,
        name,
        avatar: userAvatar, // Use generated avatar if none exists
        roles: roles || [],
        ...restPayload, // Include any additional fields
      };
    } catch (error) {
      console.error("Failed to parse JWT token:", error);
      set({ error: "Invalid authentication token" });
      return null;
    }
  },

  checkAuth: async () => {
    set({ isLoading: true, error: null });

    try {
      // Call server-side API to check authentication
      const response = await fetch("/api/auth/cookie", {
        credentials: "include", // Important to include cookies
      });

      // Parse the response
      const data = await response.json();

      if (!response.ok || !data.authenticated) {
        console.log(
          "Authentication check failed:",
          data.message || "Unknown error",
        );
        set({ isAuthenticated: false, user: null, isLoading: false });
        return false;
      }

      // If response contains a token, parse it
      if (data.token) {
        const user = await get().parseToken(data.token);
        if (user) {
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          });
          return true;
        }
      }
      // If response directly contains user data
      else if (data.user) {
        // Ensure proper field structure
        const { user_id, ...restUser } = data.user;

        // Use the avatar from OAuth directly - no need to generate one
        // OAuth providers should always give us an avatar URL
        const formattedUser: User = {
          id: user_id || data.user.id, // Use user_id or id, depending on what's available
          ...restUser,
          avatar: data.user.avatar,
        };

        set({
          user: formattedUser,
          isAuthenticated: true,
          isLoading: false,
        });
        return true;
      } else {
        set({
          isAuthenticated: false,
          user: null,
          isLoading: false,
          error: "No user data or token found in response",
        });
        return false;
      }
      return false;
    } catch (error) {
      console.error("Auth check request failed:", error);
      set({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: "Authentication check failed",
      });
      return false;
    }
  },

  logout: async () => {
    set({ isLoading: true });

    try {
      // Call your backend to clear cookies
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Logout request failed");
      }
    } catch (error) {
      console.error("Logout error:", error);
      // Continue with client-side logout even if API call fails
    } finally {
      // Reset state
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });

      // Redirect to root page
      window.location.href = "/";
    }
  },
}));
