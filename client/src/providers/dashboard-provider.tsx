"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { usePathname } from "next/navigation";

// Import all stores
import { useUIStore } from "@/stores/dashboardUIStore";
import { useThreadStore, ThreadGroup, Thread } from "@/stores/threadStore";
import { useMessageStore, Message } from "@/stores/messageStore";
import {
  useSocketStore,
  ConnectionStatus,
  TypingUser,
} from "@/stores/websocketStore";

// Define the chat context with all the properties and methods we want to expose
interface ChatContextType {
  // UI state
  sidebarOpen: boolean;
  themeMode: "light" | "dark";
  searchQuery: string;
  toggleSidebar: () => void;
  toggleThemeMode: () => void;
  setSearchQuery: (query: string) => void;

  // Thread state
  threads: ThreadGroup[];
  currentThreadId: string | null;
  setCurrentThread: (threadId: string) => void;
  createThread: (title: string) => Promise<string>;
  deleteThread: (threadId: string) => void;
  pinThread: (threadId: string) => void;

  // Message state
  messages: Message[];
  isLoadingMessages: boolean;
  messagesError: string | null;
  sendMessage: (content: string) => void;
  loadMoreMessages: () => Promise<void>;

  // WebSocket state
  wsStatus: ConnectionStatus;
  typingUsers: Record<string, TypingUser[]>;
  sendTypingIndicator: (isTyping: boolean) => void;
}

// Create the context
const ChatContext = createContext<ChatContextType | undefined>(undefined);

// Provider component that wraps the app
export function DashboardProvider({ children }: { children: ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const pathname = usePathname();

  // Get UI state from store
  const {
    sidebarOpen,
    themeMode,
    searchQuery,
    toggleSidebar,
    toggleThemeMode,
    setSearchQuery,
  } = useUIStore();

  // Get thread state from store
  const {
    threadGroups,
    currentThreadId,
    setCurrentThread: setCurrentThreadOriginal,
    createThread: createThreadOriginal,
    deleteThread,
    pinThread,
    threadsLoaded,
    loadThreads,
  } = useThreadStore();

  // Get message state from store
  const {
    messages: allMessages,
    messageLoadInfo,
    loadMessages,
    loadMoreMessages,
  } = useMessageStore();

  // Get socket state from store
  const {
    status: wsStatus,
    typingUsers,
    connect: connectWebSocket,
    disconnect: disconnectWebSocket,
    subscribeToRoom,
    unsubscribeFromRoom,
    sendMessage: sendMessageOriginal,
    sendTypingIndicator: sendTypingIndicatorOriginal,
    _cleanupStaleTypingIndicators,
  } = useSocketStore();

  // Wrap some functions to simplify the API
  const setCurrentThread = useCallback(
    (threadId: string) => {
      if (currentThreadId) {
        unsubscribeFromRoom(currentThreadId);
      }
      setCurrentThreadOriginal(threadId);
      subscribeToRoom(threadId);
    },
    [
      currentThreadId,
      setCurrentThreadOriginal,
      subscribeToRoom,
      unsubscribeFromRoom,
    ],
  );

  const createThread = useCallback(
    async (title: string) => {
      const threadId = await createThreadOriginal(title);
      setCurrentThread(threadId);
      return threadId;
    },
    [createThreadOriginal, setCurrentThread],
  );

  const sendMessage = useCallback(
    (content: string) => {
      sendMessageOriginal(currentThreadId, content);
    },
    [currentThreadId, sendMessageOriginal],
  );

  const sendTypingIndicator = useCallback(
    (isTyping: boolean) => {
      if (currentThreadId) {
        sendTypingIndicatorOriginal(currentThreadId, isTyping);
      }
    },
    [currentThreadId, sendTypingIndicatorOriginal],
  );

  // Get current thread messages
  const messages = currentThreadId ? allMessages[currentThreadId] || [] : [];
  const currentThreadInfo = currentThreadId
    ? messageLoadInfo[currentThreadId]
    : null;
  const isLoadingMessages = currentThreadInfo?.isLoading || false;
  const messagesError = currentThreadInfo?.error || null;

  // Get typing users for current thread
  const currentThreadTypingUsers = currentThreadId
    ? typingUsers[currentThreadId] || []
    : [];

  // Initialize app state on client-side only
  useEffect(() => {
    if (typeof window !== "undefined" && !isInitialized) {
      setIsInitialized(true);

      const initializeApp = async () => {
        // Load threads if not already loaded
        if (!threadsLoaded) {
          await loadThreads();
        }

        // Connect to WebSocket using your auth approach
        await connectWebSocket();
      };

      initializeApp();

      return () => {
        disconnectWebSocket();
      };
    }
  }, [
    isInitialized,
    threadsLoaded,
    loadThreads,
    connectWebSocket,
    disconnectWebSocket,
  ]);

  // Extract thread ID from pathname if available
  useEffect(() => {
    if (pathname?.startsWith("/chat/") && isInitialized) {
      const threadId = pathname.replace("/chat/", "");
      if (threadId && threadId !== currentThreadId) {
        setCurrentThread(threadId);
      }
    }
  }, [pathname, currentThreadId, setCurrentThread, isInitialized]);

  // Apply theme mode effect
  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.classList.toggle("dark", themeMode === "dark");
    }
  }, [themeMode]);

  // Setup auto-reconnect on network changes
  useEffect(() => {
    if (typeof window === "undefined" || !isInitialized) return;

    const handleOnline = () => {
      connectWebSocket();
    };

    const handleOffline = () => {
      // Update UI to show disconnected state, but don't close the socket
      // as it will auto-disconnect when offline
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [isInitialized, connectWebSocket]);

  // Setup typing indicator cleanup timer
  useEffect(() => {
    if (typeof window === "undefined" || !isInitialized) return;

    const timer = setInterval(() => {
      _cleanupStaleTypingIndicators();
    }, 1000);

    return () => clearInterval(timer);
  }, [isInitialized, _cleanupStaleTypingIndicators]);

  // Create context value to provide to components
  const contextValue: ChatContextType = {
    // UI state
    sidebarOpen,
    themeMode,
    searchQuery,
    toggleSidebar,
    toggleThemeMode,
    setSearchQuery,

    // Thread state
    threads: threadGroups,
    currentThreadId,
    setCurrentThread,
    createThread,
    deleteThread,
    pinThread,

    // Message state
    messages,
    isLoadingMessages,
    messagesError,
    sendMessage,
    loadMoreMessages: () => loadMoreMessages(currentThreadId || ""),

    // WebSocket state
    wsStatus,
    typingUsers: { [currentThreadId || ""]: currentThreadTypingUsers },
    sendTypingIndicator,
  };

  return (
    <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>
  );
}

// Custom hook to use the chat context
export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
