"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardStore } from "@/stores/dashboardStore";

// Types
interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

interface Thread {
  id: string;
  title: string;
  isPinned?: boolean;
  lastUpdated: Date;
}

interface ThreadGroup {
  id: string;
  label: string;
  threads: Thread[];
}

const Dashboard = () => {
  const router = useRouter();
  const pathname = usePathname();

  // Access state from store
  const {
    sidebarOpen,
    toggleSidebar,
    threads,
    currentThreadId,
    searchQuery,
    setSearchQuery,
    themeMode,
    toggleThemeMode,
    setCurrentThread,
    pinThread,
    deleteThread,
    createNewThread,
  } = useDashboardStore();

  // Local state
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "48px";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = scrollHeight + "px";
    }
  }, [message]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle sending a message
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    // Create a new thread if none is selected
    if (!currentThreadId) {
      const newThreadId = createNewThread(message.substring(0, 30) + "...");
      handleSendMessage(message);
      router.push(`/chat/${newThreadId}`);
    } else {
      handleSendMessage(message);
    }

    setMessage("");
  };

  // Send message to API & handle response
  const handleSendMessage = async (messageText: string) => {
    // Add user message to UI
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Send message to API if we have a thread ID
      if (currentThreadId) {
        const response = await fetch(`/api/chat/${currentThreadId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: messageText }),
        });

        if (!response.ok) {
          throw new Error("Failed to send message");
        }
      }

      // For demo: simulate a response
      setTimeout(() => {
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: `Meow! Cat has received your message: "${messageText}" nya~`,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      console.error("Error sending message:", error);
      setIsLoading(false);
    }
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
              className="flex items-center justify-center w-full py-2 px-4 bg-pink-600 hover:bg-pink-700 text-white rounded-lg"
              onClick={(e) => {
                e.preventDefault();
                const id = createNewThread("New Chat");
                router.push(`/chat/${id}`);
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
            {threads.map((group) => (
              <div key={group.id} className="mb-6">
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  {group.label}
                </h3>
                <ul>
                  {group.threads.map((thread) => (
                    <li key={thread.id} className="mb-1">
                      <div
                        className={`relative flex items-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer ${
                          currentThreadId === thread.id
                            ? "bg-gray-100 dark:bg-gray-700"
                            : ""
                        }`}
                        onClick={() => handleThreadClick(thread.id)}
                      >
                        <span className="truncate text-sm dark:text-gray-300">
                          {thread.title}
                        </span>

                        {/* Thread Actions - Only show on hover */}
                        <div className="absolute right-0 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              pinThread(thread.id);
                            }}
                          >
                            📌
                          </button>
                          <button
                            className="p-1 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteThread(thread.id);
                            }}
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
              href="/settings"
              className="flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-md"
            >
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                  😺
                </div>
                <div className="ml-2">
                  <p className="text-sm font-medium dark:text-gray-200">
                    User Name
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
            <h2 className="text-lg font-semibold dark:text-gray-200">
              {currentThreadId
                ? threads
                    .flatMap((g) => g.threads)
                    .find((t) => t.id === currentThreadId)?.title || "Chat"
                : "New Chat"}
            </h2>

            <div className="flex items-center space-x-2">
              <button
                onClick={toggleThemeMode}
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                {themeMode === "dark" ? "🌞" : "🌙"}
              </button>
              <Link
                href="/settings"
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                ⚙️
              </Link>
            </div>
          </header>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900">
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
                    How can I help you?
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
                      'How many Rs are in the word "strawberry"?',
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
              <div className="space-y-6">
                <AnimatePresence>
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.role === "user"
                            ? "bg-pink-600 text-white"
                            : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                        }`}
                      >
                        <p>{msg.content}</p>
                        <div className="mt-1 text-xs opacity-70">
                          {msg.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-center"
                  >
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
                  className="w-full p-3 pr-12 border dark:border-gray-700 rounded-lg resize-none bg-gray-50 dark:bg-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  rows={1}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
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
                    disabled={!message.trim()}
                    className={`ml-2 p-1 rounded-full ${
                      message.trim()
                        ? "bg-pink-600 hover:bg-pink-700 text-white"
                        : "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    ⬆️
                  </button>
                </div>
              </div>

              <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                <span>GPT-4.1 Mini</span>
                <span className="ml-1">🔽</span>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
