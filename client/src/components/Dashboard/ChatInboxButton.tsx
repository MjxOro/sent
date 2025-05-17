// components/buttons/ChatInboxButton.tsx
"use client";

import { useState } from "react";
import ChatInviteModal from "@/components/Dashboard/ChatInviteModal";

const ChatInboxButton = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="relative cursor-pointer">
      <span
        onClick={() => setIsModalOpen(true)}
        className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
      >
        📧
      </span>

      {isModalOpen && <ChatInviteModal onClose={() => setIsModalOpen(false)} />}
    </div>
  );
};
export default ChatInboxButton;
