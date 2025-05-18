// components/modals/ChatInviteModal.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useNotificationStore } from "@/stores/notificationStore";
import { Notification } from "@/stores/notificationStore";
import { useThreadStore } from "@/stores/threadStore";

interface ChatInviteModalProps {
  onClose: () => void;
}

const ChatInviteModal = ({ onClose }: ChatInviteModalProps) => {
  const [isLoading, setIsLoading] = useState<string | null>(null); // Track which invite is loading
  const router = useRouter();
  // Just destructure getChatInvites like any other action
  const { getChatInvites, markAsRead } = useNotificationStore();
  const chatInvites = getChatInvites();

  const handleAccept = async (notification: Notification) => {
    setIsLoading(notification.id);
    try {
      const response = await fetch(
        `/api/rooms/${notification.data?.roomId}/invites/accept`,
        {
          method: "POST",
        },
      );
      if (!response.ok) throw new Error("Failed to accept invite");
      markAsRead(notification.id);
      await useThreadStore.getState().loadThreads();
      router.push(`/chat/${notification.data?.roomId}`);
      onClose();
    } catch (error) {
      console.error("Failed to accept invite:", error);
    } finally {
      setIsLoading(null);
    }
  };
  const handleDecline = async (notification: Notification) => {
    try {
      const response = await fetch(
        `/api/rooms/${notification.data?.roomId}/invites/decline`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to decline invitation");
      }
      markAsRead(notification.id);
      onClose();
    } catch (error) {
      console.error("Error declining invitation:", error);
    }
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md mx-4 p-6">
        <h2 className="text-xl font-semibold mb-4 text-center">Chat Invites</h2>

        {chatInvites.length === 0 ? (
          <p className="text-center text-gray-500">No new chat invites</p>
        ) : (
          <div className="space-y-4">
            {chatInvites.map((invite) => (
              <div key={invite.id} className="border rounded-lg p-4">
                <p className="text-center">
                  <span className="font-medium">
                    {invite.data?.inviterName}
                  </span>{" "}
                  has invited you to join:
                </p>
                <p className="text-center mt-2 text-lg font-medium">
                  {invite.data?.roomName}
                </p>
                <div className="flex justify-center gap-4 mt-4">
                  <button
                    onClick={() => handleDecline(invite)}
                    className="px-4 py-2"
                    disabled={isLoading === invite.id}
                  >
                    👎 Decline
                  </button>
                  <button
                    onClick={() => handleAccept(invite)}
                    disabled={isLoading === invite.id}
                    className="px-4 py-2"
                  >
                    {isLoading === invite.id ? "⏳" : "👍"}
                    {isLoading === invite.id ? "Processing..." : "Accept"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInviteModal;
