"use client";
// src/components/Dashboard/CreateChatModal.tsx
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFriendStore, Friend } from "@/stores/friendStore";

// Define the props type with proper typing
interface CreateChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, selectedFriends: string[]) => void;
}

const CreateChatModal: React.FC<CreateChatModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const { friends, loadFriends } = useFriendStore();

  useEffect(() => {
    if (isOpen) {
      // Reset form when opening
      setName("");
      setSelectedFriends([]);
      // Load friends if needed
      loadFriends();
    }
  }, [isOpen, loadFriends]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name, selectedFriends);
    }
  };

  const toggleFriendSelection = (friendId: string) => {
    setSelectedFriends((prev) =>
      prev.includes(friendId)
        ? prev.filter((id) => id !== friendId)
        : [...prev, friendId],
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6"
          >
            <h2 className="text-xl font-bold mb-4 dark:text-gray-200">
              Create New Chat
            </h2>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Chat Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter chat name"
                  className="w-full p-2 border rounded-md dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-sent-primary"
                  required
                />
              </div>

              {friends.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Add Friends (Optional)
                  </label>
                  <div className="max-h-48 overflow-y-auto border rounded-md dark:border-gray-700 p-2">
                    {friends.map((friend) => (
                      <div
                        key={friend.friend_id}
                        className={`flex items-center p-2 rounded-md cursor-pointer ${
                          selectedFriends.includes(friend.friend_id)
                            ? "bg-sent-primary/10 dark:bg-sent-primary/20"
                            : "hover:bg-gray-100 dark:hover:bg-gray-700"
                        }`}
                        onClick={() => toggleFriendSelection(friend.friend_id)}
                      >
                        <div className="w-8 h-8 rounded-full bg-sent-secondary flex items-center justify-center overflow-hidden mr-2">
                          {friend.friend_avatar ? (
                            <img
                              src={friend.friend_avatar}
                              alt={friend.friend_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>👤</span>
                          )}
                        </div>
                        <span className="dark:text-gray-200">
                          {friend.friend_name}
                        </span>
                        {selectedFriends.includes(friend.friend_id) && (
                          <div className="ml-auto">
                            <div className="w-5 h-5 bg-sent-primary rounded-full flex items-center justify-center">
                              <span className="text-white text-xs">✓</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2 mt-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sent-primary text-white rounded-md hover:bg-sent-primary/80"
                >
                  Create
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CreateChatModal;
