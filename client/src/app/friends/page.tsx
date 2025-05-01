"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import FriendsInbox from "@/components/Dashboard/FriendsInbox";
import { useAuth } from "@/providers/auth-provider";

export default function FriendsPage() {
  const { isAuthenticated, isLoading, checkAuth } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      if (!isAuthenticated) {
        const authResult = await checkAuth();
        if (!authResult) {
          router.push("/login");
        }
      }
    };

    init();
  }, [isAuthenticated, checkAuth, router]);

  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <div className="flex justify-center space-x-2">
            <div className="w-3 h-3 bg-pink-600 rounded-full animate-bounce"></div>
            <div
              className="w-3 h-3 bg-pink-600 rounded-full animate-bounce"
              style={{ animationDelay: "0.2s" }}
            ></div>
            <div
              className="w-3 h-3 bg-pink-600 rounded-full animate-bounce"
              style={{ animationDelay: "0.4s" }}
            ></div>
          </div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-4">
          <button
            onClick={() => router.push("/")}
            className="flex items-center text-gray-600 dark:text-gray-300 hover:text-pink-600 dark:hover:text-pink-400"
          >
            <span>← Back to Chat</span>
          </button>
        </div>

        <FriendsInbox />
      </div>
    </div>
  );
}
