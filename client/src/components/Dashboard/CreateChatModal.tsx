"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFriendStore, Friend } from "@/stores/friendStore";

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
  const [roomName, setRoomName] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    friends,
    loadFriends,
    isLoading: { friends: isLoadingFriends },
    errors: { friends: friendsError },
  } = useFriendStore();

  // Load friends when modal opens
  useEffect(() => {
    if (isOpen) {
      loadFriends();
      // Reset form when opening
      setRoomName("");
      setSelectedFriends([]);
      setSearchQuery("");
    }
  }, [isOpen, loadFriends]);

  // Filter friends by search query
  const filteredFriends = friends.filter((friend) => {
    if (!searchQuery.trim()) return true;

    return (
      friend.friend_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      friend.friend_email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Handle friend selection
  const toggleFriendSelection = (friendId: string) => {
    if (selectedFriends.includes(friendId)) {
      setSelectedFriends(selectedFriends.filter((id) => id !== friendId));
    } else {
      setSelectedFriends([...selectedFriends, friendId]);
    }
  };

  // Select/deselect all friends
  const toggleSelectAll = () => {
    if (selectedFriends.length === filteredFriends.length) {
      // If all are selected, deselect all
      setSelectedFriends([]);
    } else {
      // Otherwise, select all filtered friends
      setSelectedFriends(filteredFriends.map((friend) => friend.friend_id));
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomName.trim()) {
      onSubmit(roomName, selectedFriends);
    }
  };

  // Close on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      window.addEventListener("keydown", handleEsc);
    }

    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, [isOpen, onClose]);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  // Click outside to close
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
          onClick={handleBackdropClick}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold dark:text-gray-200">
                  Create New Chat
                </h2>
                <button
                  onClick={onClose}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1"
                  aria-label="Close"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                {/* Chat name input */}
                <div className="mb-6">
                  <label
                    htmlFor="roomName"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Chat Name
                  </label>
                  <input
                    type="text"
                    id="roomName"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="Enter chat name..."
                    className="w-full p-3 border dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Give your chat room a descriptive name
                  </p>
                </div>

                {/* Friend selection section */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Add Friends
                    </label>
                    {filteredFriends.length > 0 && (
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="text-xs text-pink-600 hover:text-pink-800 dark:text-pink-400 dark:hover:text-pink-300"
                      >
                        {selectedFriends.length === filteredFriends.length
                          ? "Deselect All"
                          : "Select All"}
                      </button>
                    )}
                  </div>

                  {/* Search input */}
                  <div className="mb-3 relative">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg
                          className="h-4 w-4 text-gray-400"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search friends..."
                        className="w-full pl-10 p-3 border rounded-md dark:border-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          <svg
                            className="h-4 w-4"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Friends list */}
                  <div className="max-h-60 overflow-y-auto border rounded-md dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                    {isLoadingFriends ? (
                      <div className="flex justify-center items-center h-20">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-pink-500"></div>
                      </div>
                    ) : friendsError ? (
                      <div className="p-4 text-center text-red-500">
                        Failed to load friends: {friendsError}
                      </div>
                    ) : filteredFriends.length > 0 ? (
                      filteredFriends.map((friend) => (
                        <div
                          key={friend.id}
                          className={`flex items-center p-3 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer transition-colors ${
                            selectedFriends.includes(friend.friend_id)
                              ? "bg-pink-50 dark:bg-pink-900/20"
                              : ""
                          }`}
                          onClick={() =>
                            toggleFriendSelection(friend.friend_id)
                          }
                        >
                          <div className="flex-shrink-0 mr-3">
                            {friend.friend_avatar ? (
                              <img
                                src={friend.friend_avatar}
                                alt={friend.friend_name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-pink-600 rounded-full flex items-center justify-center text-white font-medium">
                                {friend.friend_name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium dark:text-gray-200 truncate">
                              {friend.friend_name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {friend.friend_email}
                            </div>
                          </div>
                          <div className="ml-3 flex-shrink-0">
                            <div
                              className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                                selectedFriends.includes(friend.friend_id)
                                  ? "bg-pink-500 border-pink-500"
                                  : "border-gray-300 dark:border-gray-500"
                              }`}
                            >
                              {selectedFriends.includes(friend.friend_id) && (
                                <svg
                                  className="w-4 h-4 text-white"
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                        {searchQuery
                          ? "No friends match your search"
                          : "No friends found. Add some friends first!"}
                      </div>
                    )}
                  </div>

                  {/* Selected friends count */}
                  {selectedFriends.length > 0 && (
                    <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      {selectedFriends.length} friend
                      {selectedFriends.length !== 1 ? "s" : ""} selected
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!roomName.trim()}
                    className={`px-4 py-2 text-white rounded-md transition-colors ${
                      roomName.trim()
                        ? "bg-pink-600 hover:bg-pink-700"
                        : "bg-pink-400 cursor-not-allowed opacity-70"
                    }`}
                  >
                    Create Chat
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CreateChatModal;
