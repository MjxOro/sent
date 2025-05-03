"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useAuthStore, User } from "@/stores/authStore";

// Create a context for authentication with proper types
export type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  error: string | null;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, user, error, logout, checkAuth } =
    useAuthStore();
  const [isInitialized, setIsInitialized] = useState(false);

  const LoadingSpinner = () => (
    <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-gray-900">
      <div className="flex flex-col items-center">
        <div className="w-16 h-16 border-4 border-sent-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sent-primary">Loading your experience...</p>
      </div>
    </div>
  );
  // Initialize auth state on client-side only
  useEffect(() => {
    const initAuth = async () => {
      try {
        await checkAuth();
      } catch (error) {
        console.error("Failed to initialize auth:", error);
      } finally {
        setIsInitialized(true);
      }
    };

    if (typeof window !== "undefined") {
      initAuth();
    }
    // }, [checkAuth]);
  }, []);

  // Create the context value
  const contextValue: AuthContextType = {
    isAuthenticated,
    isLoading: isLoading || !isInitialized,
    user,
    error,
    logout,
    checkAuth,
  };

  const checkUser = user && user.id && user.email;

  return checkUser ? (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  ) : (
    <LoadingSpinner />
  );
}

// Custom hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
