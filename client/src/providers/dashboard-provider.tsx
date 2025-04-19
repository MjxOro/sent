"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  useDashboardStore,
  Thread,
  ThreadGroup,
} from "@/stores/dashboardStore";

// Create a context for dashboard with proper types
export type DashboardContextType = {
  sidebarOpen: boolean;
  threads: ThreadGroup[];
  currentThreadId: string | null;
  searchQuery: string;
  themeMode: "light" | "dark";
  toggleSidebar: () => void;
  setCurrentThread: (threadId: string) => void;
  pinThread: (threadId: string) => void;
  deleteThread: (threadId: string) => void;
  setSearchQuery: (query: string) => void;
  toggleThemeMode: () => void;
  createNewThread: (title: string) => string;
};

const DashboardContext = createContext<DashboardContextType | undefined>(
  undefined,
);

// Provider component
export function DashboardProvider({ children }: { children: ReactNode }) {
  const {
    sidebarOpen,
    threads,
    currentThreadId,
    searchQuery,
    themeMode,
    toggleSidebar,
    setCurrentThread,
    pinThread,
    deleteThread,
    setSearchQuery,
    toggleThemeMode,
    createNewThread,
  } = useDashboardStore();

  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize dashboard state on client-side only
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Any initialization logic can go here
      setIsInitialized(true);
    }
  }, []);

  // Apply theme mode effect
  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.classList.toggle("dark", themeMode === "dark");
    }
  }, [themeMode]);

  // Create the context value
  const contextValue: DashboardContextType = {
    sidebarOpen,
    threads,
    currentThreadId,
    searchQuery,
    themeMode,
    toggleSidebar,
    setCurrentThread,
    pinThread,
    deleteThread,
    setSearchQuery,
    toggleThemeMode,
    createNewThread,
  };

  return (
    <DashboardContext.Provider value={contextValue}>
      {children}
    </DashboardContext.Provider>
  );
}

// Custom hook to use the dashboard context
export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}
