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
  Message,
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

  // New WebSocket properties
  wsStatus: "connected" | "disconnected" | "connecting" | "error" | "idle";
  messages: Message[];
  isLoadingMessages: boolean;
  messagesError: string | null;

  // New WebSocket methods
  sendMessage: (content: string) => void;
  sendTypingIndicator: (isTyping: boolean) => void;
  loadMoreMessages: () => Promise<void>;
};

const DashboardContext = createContext<DashboardContextType | undefined>(
  undefined,
);

// Provider component
export function DashboardProvider({ children }: { children: ReactNode }) {
  const {
    // UI state
    sidebarOpen,
    threads,
    currentThreadId,
    searchQuery,
    themeMode,

    // UI actions
    toggleSidebar,
    setCurrentThread,
    pinThread,
    deleteThread,
    setSearchQuery,
    toggleThemeMode,
    createNewThread,

    // WebSocket & Messages state
    wsConnection,
    messages,
    isLoadingMessages,
    messagesError,

    // WebSocket & Messages actions
    connectWebSocket,
    disconnectWebSocket,
    sendMessage,
    sendTypingIndicator,
    loadMoreMessages,
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

  // Auto-reconnect WebSocket on network connectivity changes
  useEffect(() => {
    if (typeof window === "undefined" || !isInitialized) return;

    const handleOnline = () => {
      if (currentThreadId) {
        connectWebSocket(currentThreadId);
      }
    };

    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [isInitialized, currentThreadId, connectWebSocket]);

  // Clean up WebSocket on unmount
  useEffect(() => {
    return () => {
      disconnectWebSocket();
    };
  }, [disconnectWebSocket]);

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

    // WebSocket properties
    wsStatus: wsConnection.status,
    messages,
    isLoadingMessages,
    messagesError,

    // WebSocket methods
    sendMessage,
    sendTypingIndicator,
    loadMoreMessages,
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
