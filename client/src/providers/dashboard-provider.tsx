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
import { usePathname } from "next/navigation";

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

  // WebSocket properties
  wsStatus: "connected" | "disconnected" | "connecting" | "error" | "idle";
  messages: Message[];
  isLoadingMessages: boolean;
  messagesError: string | null;
  typingUsers: Record<
    string,
    { userId: string; userName: string; timestamp: number }[]
  >;

  // WebSocket methods
  sendMessage: (content: string) => void;
  sendTypingIndicator: (isTyping: boolean) => void;
  markMessagesAsRead: (messageIds: string[]) => void;
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
    typingUsers,

    // WebSocket & Messages actions
    connectWebSocket,
    disconnectWebSocket,
    sendMessage,
    sendTypingIndicator,
    markMessagesAsRead,
    loadMoreMessages,
  } = useDashboardStore();

  const [isInitialized, setIsInitialized] = useState(false);
  const pathname = usePathname();

  // Extract thread ID from pathname if available
  useEffect(() => {
    if (pathname?.startsWith("/chat/")) {
      const threadId = pathname.replace("/chat/", "");
      if (threadId && threadId !== currentThreadId) {
        setCurrentThread(threadId);
      }
    }
  }, [pathname, currentThreadId, setCurrentThread]);

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

  // Initialize WebSocket connection on mount
  useEffect(() => {
    if (typeof window === "undefined" || !isInitialized) return;

    connectWebSocket();

    return () => {
      disconnectWebSocket();
    };
  }, [isInitialized, connectWebSocket, disconnectWebSocket]);

  // Auto-reconnect WebSocket on network connectivity changes
  useEffect(() => {
    if (typeof window === "undefined" || !isInitialized) return;

    const handleOnline = () => {
      connectWebSocket();
    };

    const handleOffline = () => {
      // We'll let the WebSocket naturally disconnect
      // but we'll update the UI to show disconnected state
      useDashboardStore.setState({
        wsConnection: {
          status: "disconnected",
          instance: wsConnection.instance,
        },
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [isInitialized, connectWebSocket, wsConnection.instance]);

  // Setup typing indicator auto-clearing
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Set up a timer to regularly check for stale typing indicators
    const timer = setInterval(() => {
      if (Object.keys(typingUsers).length > 0) {
        const now = Date.now();
        let hasChanges = false;

        const updatedTypingUsers = { ...typingUsers };

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
        if (hasChanges) {
          useDashboardStore.setState({ typingUsers: updatedTypingUsers });
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [typingUsers]);

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
    typingUsers,

    // WebSocket methods
    sendMessage,
    sendTypingIndicator,
    markMessagesAsRead,
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
