"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useChat } from "@/providers/dashboard-provider";
import { useAuth } from "@/providers/auth-provider";
import CreateChatModal from "@/components/Dashboard/CreateChatModal";
import NotificationWrapper from "@/components/Dashboard/NotificationWrapper";
import ChatInboxButton from "./Dashboard/ChatInboxButton";

// Define proper interfaces for the types
interface Thread {
  id: string;
  title: string;
  unreadCount?: number;
  isPinned?: boolean;
}

interface ThreadGroup {
  id: string;
  label: string;
  threads: Thread[];
}

interface Message {
  id: string;
  content: string;
  user_id: string;
  user_name?: string;
  user_avatar?: string;
  created_at: string | Date;
  formatted?: {
    role: "user" | "assistant" | "system";
    timestamp?: Date;
  };
}

interface ChatDetails {
  id: string;
  name: string;
  description?: string;
  members?: string[];
}

type DashboardProps = {
  initialChatId?: string;
  initialMessages?: Message[];
  chatDetails?: ChatDetails;
};

const Dashboard: React.FC<DashboardProps> = () => {
  const router = useRouter();

  // Use our new hook to access all chat state
  const {
    // UI state
    sidebarOpen,
    toggleSidebar,
    themeMode,
    toggleThemeMode,
    searchQuery,
    setSearchQuery,

    // Thread state
    threads,
    currentThreadId,
    setCurrentThread,
    createThread,
    pinThread,
    deleteThread,

    // Message state
    messages,
    isLoadingMessages,
    messagesError,
    sendMessage,
    loadMoreMessages,

    // WebSocket state
    wsStatus,
    typingUsers,
    sendTypingIndicator,
  } = useChat();

  // Local state
  const [message, setMessage] = useState("");
  const [hasLoadedMessages, setHasLoadedMessages] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "48px";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = scrollHeight + "px";
    }
  }, [message]);

  // Scroll to bottom on new messages
  useEffect(() => {
    // Only auto-scroll if we're near the bottom already
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;

      if (isNearBottom || messages.length <= 1) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
    setHasLoadedMessages(true);
  }, [messages]);

  // Handle sending a message
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    // Create a new thread if none is selected or send message to current thread
    if (!currentThreadId) {
      const title =
        message.length > 30 ? message.substring(0, 27) + "..." : message;

      createThread(title).then((newThreadId) => {
        sendMessage(message);
        router.push(`/chat/${newThreadId}`);
      });
    } else {
      sendMessage(message);
    }

    setMessage("");

    // Reset typing indicator
    sendTypingIndicator(false);
  };

  // Handle thread selection
  const handleThreadClick = (threadId: string) => {
    setCurrentThread(threadId);
    router.push(`/chat/${threadId}`);
  };

  // Handle search input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Handle keydown in textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send message on Enter (but not with Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (message.trim()) {
        handleSubmit(e);
      }
    }
  };

  // Custom debounce implementation
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(
    null,
  );

  // Handle message input change
  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setMessage(newValue);

    // Send typing indicator
    if (newValue.trim()) {
      // Clear existing timeout if any
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }

      // Send typing indicator immediately
      sendTypingIndicator(true);

      // Set timeout to stop typing indicator after 2 seconds of inactivity
      const timeout = setTimeout(() => {
        sendTypingIndicator(false);
      }, 2000);

      setTypingTimeout(timeout);
    } else {
      // If message is empty, immediately send not typing
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
      sendTypingIndicator(false);
    }
  };

  // Cleanup timeout
  useEffect(() => {
    return () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
    };
  }, [typingTimeout]);

  // Handle scroll to load more messages
  const handleScroll = () => {
    if (!messagesContainerRef.current || isLoadingMessages) return;

    const { scrollTop } = messagesContainerRef.current;

    // If we're near the top, load more messages
    if (scrollTop < 50) {
      loadMoreMessages();
    }
  };

  // Get current thread info
  const currentThread = threads
    .flatMap((g: ThreadGroup) => g.threads)
    .find((t: Thread) => t.id === currentThreadId);

  // Get typing users for current room
  const currentRoomTypingUsers = currentThreadId
    ? typingUsers[currentThreadId] || []
    : [];

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* Sidebar */}
      <motion.div
        className={`fixed inset-y-0 left-0 z-10 w-64 bg-white dark:bg-gray-800 shadow-lg transform ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 transition-transform duration-300 ease-in-out`}
        initial={false}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="p-4 border-b dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold">🐱 Chat</h1>
              <button
                onClick={toggleSidebar}
                className="md:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ❌
              </button>
            </div>

            {/* New Chat Button */}
            <Link
              href="/chat"
              className="flex items-center justify-center w-full py-2 px-4 bg-sent-primary hover:bg-sent-primary/80 text-white rounded-lg"
              onClick={(e) => {
                e.preventDefault();
                setIsChatModalOpen(true);
              }}
            >
              <span>New Chat</span>
            </Link>

            {/* Search Box */}
            <div className="mt-4 relative">
              <div className="flex items-center border rounded-md dark:border-gray-700">
                <span className="pl-3">🔍</span>
                <input
                  type="text"
                  placeholder="Search threads..."
                  className="w-full p-2 bg-transparent focus:outline-none dark:text-gray-200"
                  value={searchQuery}
                  onChange={handleSearchChange}
                />
              </div>
            </div>
          </div>

          {/* Thread Groups */}
          <div className="flex-1 overflow-y-auto p-4">
            {threads.map((group: ThreadGroup) => (
              <div key={group.id} className="mb-6">
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  {group.label}
                </h3>
                <ul>
                  {group.threads.map((thread: Thread) => (
                    <li key={thread.id} className="mb-1">
                      <div
                        className={`relative group flex items-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer ${
                          currentThreadId === thread.id
                            ? "bg-gray-100 dark:bg-gray-700"
                            : ""
                        }`}
                        onClick={() => handleThreadClick(thread.id)}
                      >
                        <span className="truncate text-sm dark:text-gray-300">
                          {thread.title}
                          {thread.unreadCount ? (
                            <span className="ml-2 bg-sent-primary text-white text-xs px-1.5 py-0.5 rounded-full">
                              {thread.unreadCount}
                            </span>
                          ) : null}
                        </span>

                        {/* Thread Actions - Show on hover */}
                        <div className="absolute right-0 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              pinThread(thread.id);
                            }}
                            title={thread.isPinned ? "Unpin" : "Pin"}
                          >
                            {thread.isPinned ? "📌" : "📌"}
                          </button>
                          <button
                            className="p-1 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteThread(thread.id);
                            }}
                            title="Delete"
                          >
                            ❌
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Sidebar Footer - User Profile */}
          <div className="p-4 border-t dark:border-gray-700">
            <Link
              href="#"
              className="flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-md"
              onClick={(e) => e.preventDefault()}
            >
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-sent-secondary dark:bg-sent-secondary flex items-center justify-center overflow-hidden">
                  {user?.avatar ? (
                    <Image
                      src={user.avatar}
                      alt={user?.name || "User"}
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>😺</span>
                  )}
                </div>
                <div className="ml-2">
                  <p className="text-sm font-medium dark:text-gray-200">
                    {user?.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Free
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Mobile Sidebar Toggle */}
      <button
        className="fixed top-4 left-4 z-20 md:hidden bg-white dark:bg-gray-800 p-2 rounded-md shadow-md text-gray-700 dark:text-gray-300"
        onClick={toggleSidebar}
      >
        📋
      </button>

      {/* Main Content */}
      <div
        className={`flex-1 ${sidebarOpen ? "md:ml-64" : ""} transition-all duration-300 ease-in-out`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <header className="bg-white dark:bg-gray-800 shadow-sm p-4 flex justify-between items-center">
            <div className="flex items-center">
              <h2 className="text-lg font-semibold dark:text-gray-200">
                {currentThread?.title || "New Chat"}
              </h2>

              {/* Connection Status Indicator */}
              <div className="ml-3 flex items-center">
                <span
                  className={`w-2 h-2 rounded-full ${
                    wsStatus === "connected"
                      ? "bg-green-500"
                      : wsStatus === "connecting"
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  }`}
                ></span>
                <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                  {wsStatus === "connected"
                    ? "Connected"
                    : wsStatus === "connecting"
                      ? "Connecting..."
                      : "Disconnected"}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <NotificationWrapper type="chat_invite">
                <ChatInboxButton />
              </NotificationWrapper>
              <NotificationWrapper type="friend_request">
                <Link
                  href="/friends"
                  className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  👥
                </Link>
              </NotificationWrapper>
              <Link
                href="#"
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                onClick={(e) => e.preventDefault()}
              >
                ⚙️
              </Link>
            </div>
          </header>

          {/* Messages Area */}
          <div
            className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900 flex flex-col"
            ref={messagesContainerRef}
            onScroll={handleScroll}
            style={{ scrollbarWidth: "thin" }}
          >
            {isLoadingMessages && messages.length > 0 && (
              <div className="flex justify-center mb-4">
                <div className="flex space-x-2 items-center">
                  <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-600 animate-bounce"></div>
                  <div
                    className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-600 animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                  <div
                    className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-600 animate-bounce"
                    style={{ animationDelay: "0.4s" }}
                  ></div>
                </div>
              </div>
            )}

            {messagesError && (
              <div className="text-center mb-4 text-red-500 dark:text-red-400">
                {messagesError}
              </div>
            )}

            {/* If no messages yet, show welcome screen */}
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="max-w-md w-full text-center space-y-6"
                >
                  <h2 className="text-2xl font-bold dark:text-gray-200">
                    How can I help you today?
                  </h2>

                  {/* Suggestion Buttons */}
                  <div className="flex flex-wrap justify-center gap-2">
                    {[
                      { emoji: "✨", text: "Create" },
                      { emoji: "📰", text: "Explore" },
                      { emoji: "💻", text: "Code" },
                      { emoji: "🎓", text: "Learn" },
                    ].map((suggestion, index) => (
                      <motion.button
                        key={index}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 dark:text-gray-200 rounded-full shadow-sm hover:shadow"
                        onClick={() =>
                          setMessage(`Help me ${suggestion.text.toLowerCase()}`)
                        }
                      >
                        <span>{suggestion.emoji}</span>
                        <span>{suggestion.text}</span>
                      </motion.button>
                    ))}
                  </div>

                  {/* Sample Questions */}
                  <div className="space-y-2 mt-6">
                    {[
                      "How does AI work?",
                      "Are black holes real?",
                      "Tell me about WebSockets",
                      "What is the meaning of life?",
                    ].map((question, index) => (
                      <motion.button
                        key={index}
                        whileHover={{ backgroundColor: "rgba(0,0,0,0.05)" }}
                        className="w-full p-2 text-left rounded-md dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                        onClick={() => setMessage(question)}
                      >
                        {question}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              </div>
            ) : (
              <div className="flex-grow flex flex-col justify-end space-y-6">
                {/* Messages are already in chronological order, so render them as is */}
                <AnimatePresence>
                  {messages.map((msg: Message) => {
                    const isUser = msg.formatted?.role === "user";
                    const isSystem = msg.formatted?.role === "system";
                    const currentUser = msg.user_id;
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={
                          hasLoadedMessages ? { opacity: 1, y: 0 } : undefined
                        }
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className={`flex w-full ${currentUser === user?.id ? "justify-end" : "justify-start"} mb-4`}
                      >
                        {/* Avatar for other users (not shown for user's own messages) */}
                        {!isUser && !isSystem && !isUser && (
                          <div className="w-8 h-8 rounded-full bg-sent-ternary dark:bg-sent-ternary flex items-center justify-center mr-2 flex-shrink-0 overflow-hidden">
                            {msg.user_avatar ? (
                              <Image
                                src={msg.user_avatar}
                                alt={msg.user_name || "User"}
                                width={32}
                                height={32}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span>👤</span>
                            )}
                          </div>
                        )}

                        <div
                          className={`max-w-[75%] rounded-lg p-3 shadow-sm ${
                            isUser
                              ? "bg-sent-primary text-white rounded-tr-none"
                              : isSystem
                                ? "bg-sent-ternary/20 dark:bg-sent-ternary/20 text-gray-800 dark:text-gray-200 text-xs italic"
                                : "bg-sent-ternary text-white rounded-tl-none"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          <div
                            className={`mt-1 text-xs ${isUser ? "text-white/70" : "text-white/70"}`}
                          >
                            {msg.formatted?.timestamp?.toLocaleTimeString() ||
                              new Date(msg.created_at).toLocaleTimeString()}
                          </div>
                        </div>

                        {/* Avatar for user's own messages */}
                        {isUser && (
                          <div className="w-8 h-8 rounded-full bg-sent-secondary flex items-center justify-center ml-2 flex-shrink-0 overflow-hidden">
                            {user?.avatar ? (
                              <Image
                                src={user.avatar}
                                alt={user?.name || "You"}
                                width={32}
                                height={32}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span>😺</span>
                            )}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {/* Auto scroll spacer */}
                <div className="pt-2" />{" "}
                {/* Added for space at bottom of messages */}
                {/* Typing indicator */}
                {currentRoomTypingUsers.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start mt-auto"
                  >
                    <div className="flex items-center bg-sent-ternary/20 dark:bg-sent-ternary/20 rounded-lg p-2 text-xs text-gray-700 dark:text-gray-300">
                      <span>
                        {currentRoomTypingUsers.length === 1
                          ? `${currentRoomTypingUsers[0].userName} is typing`
                          : `${currentRoomTypingUsers.length} people are typing`}
                      </span>
                      <div className="flex space-x-1 ml-2">
                        <div className="w-1 h-1 rounded-full bg-gray-500 animate-bounce"></div>
                        <div
                          className="w-1 h-1 rounded-full bg-gray-500 animate-bounce"
                          style={{ animationDelay: "0.2s" }}
                        ></div>
                        <div
                          className="w-1 h-1 rounded-full bg-gray-500 animate-bounce"
                          style={{ animationDelay: "0.4s" }}
                        ></div>
                      </div>
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Message Input */}
          <div className="bg-white dark:bg-gray-800 border-t dark:border-gray-700 p-4">
            <form onSubmit={handleSubmit} className="flex flex-col space-y-2">
              <div className="relative flex-1">
                <textarea
                  ref={textareaRef}
                  placeholder="Type your message here..."
                  className="w-full p-3 pr-12 border dark:border-gray-700 rounded-lg resize-none bg-gray-50 dark:bg-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-sent-primary"
                  rows={1}
                  value={message}
                  onChange={handleMessageChange}
                  onKeyDown={handleKeyDown}
                ></textarea>

                <div className="absolute bottom-3 right-3 flex items-center space-x-1">
                  <button
                    type="button"
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    📎
                  </button>
                  <button
                    type="submit"
                    disabled={!message.trim() || wsStatus !== "connected"}
                    className={`ml-2 p-1 rounded-full ${
                      message.trim() && wsStatus === "connected"
                        ? "bg-sent-primary hover:bg-sent-primary/80 text-white"
                        : "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    ⬆️
                  </button>
                </div>
              </div>

              <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                <span>Chat Mini</span>
                <span className="ml-1">🔽</span>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Create Chat Modal */}
      <CreateChatModal
        isOpen={isChatModalOpen}
        onClose={() => setIsChatModalOpen(false)}
        onSubmit={(name, selectedFriends) => {
          // Create the new room with members
          createThread(name, selectedFriends).then((id) => {
            router.push(`/chat/${id}`);
            setIsChatModalOpen(false);
          });
        }}
      />
    </div>
  );
};

export default Dashboard;
