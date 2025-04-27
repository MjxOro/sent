// stores/authStore.ts
import { create } from "zustand";
import { jwtVerify, JWTVerifyResult } from "jose";

// Define User type
export interface User {
  id: string;
  email: string;
  name: string;
  roles?: string[];
  [key: string]: any;
}

// Define JWT payload structure
interface JWTPayload {
  sub: string;
  email: string;
  name: string;
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

// Create the store without persist middleware
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

      // Convert JWT payload to user object
      // Extract required properties first
      const { sub, email, name, roles, ...restPayload } = payload;

      return {
        id: sub,
        email,
        name,
        roles: roles || [],
        ...restPayload, // Include any additional fields without duplicating the extracted ones
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

      console.log("Authentication successful");

      // Set the authenticated user
      set({
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
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
