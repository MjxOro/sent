"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Dashboard from "@/components/Dashboard";
import { useChat } from "@/providers/dashboard-provider";
import { useAuth } from "@/providers/auth-provider";

export default function NewChatPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { createThread } = useChat();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      // Create a new thread and redirect to it
      const createAndRedirect = async () => {
        try {
          // Create a new thread with default title
          const threadId = await createThread("New Chat");
          // Redirect to the new thread
          router.push(`/chat/${threadId}`);
        } catch (error) {
          console.error("Failed to create new chat:", error);
          router.push("/");
        }
      };

      createAndRedirect();
    }
  }, [createThread, router, isAuthenticated, isLoading]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-pink-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-700 dark:text-gray-300">
            Creating new chat...
          </p>
        </div>
      </div>
    );
  }
  // While redirecting, show the dashboard in a "new chat" state
  return <Dashboard />;
}
