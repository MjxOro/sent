"use client";

import React from "react";

export default function ChatLoading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="text-center">
        <div className="flex justify-center space-x-2 mb-4">
          <div className="w-3 h-3 rounded-full bg-pink-600 animate-bounce" />
          <div
            className="w-3 h-3 rounded-full bg-pink-600 animate-bounce"
            style={{ animationDelay: "0.2s" }}
          />
          <div
            className="w-3 h-3 rounded-full bg-pink-600 animate-bounce"
            style={{ animationDelay: "0.4s" }}
          />
        </div>
        <p className="text-gray-700 dark:text-gray-300">Loading your chat...</p>
      </div>
    </div>
  );
}
