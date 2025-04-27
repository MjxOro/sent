"use client";

import { useState, useEffect } from "react";
import { useFriendStore, Friend } from "@/stores/friendStore";

interface CreateChatModalProps {
  modalOpen: boolean;
  modalClose: () => void;
  modalSubmit: (chatName: string, friendIds: string[]) => void;
}

const CreateChatModal: React.FC<CreateChatModalProps> = ({
  modalOpen,
  modalClose,
  modalSubmit,
}) => {
  const [name, setName] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { friends, loadFriends, isLoading } = useFriendStore();

  // Load friends when modal opens
  useEffect(() => {
    if (modalOpen) {
      loadFriends();
    }
  }, [modalOpen, loadFriends]);

  // Reset form when modal closes
  useEffect(() => {
    if (!modalOpen) {
      setName("");
      setSelectedFriends([]);
      setIsPrivate(false);
      setSearchQuery("");
    }
  }, [modalOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      modalSubmit(name, selectedFriends);
    }
  };

  const handleFriendToggle = (friendId: string) => {
    if (selectedFriends.includes(friendId)) {
      setSelectedFriends(selectedFriends.filter((id) => id !== friendId));
    } else {
      setSelectedFriends([...selectedFriends, friendId]);
    }
  };

  // Filter friends by search query
  const filteredFriends = friends.filter((friend) => {
    if (!searchQuery.trim()) return true;

    const searchLower = searchQuery.toLowerCase();
    return friend.friend_name.toLowerCase().includes(searchLower);
  });

  // If modal isn't open, don't render anything
  if (!modalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={modalClose}
        ></div>

        <div className="relative inline-block w-full max-w-md bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-xl transform transition-all my-8">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Create New Chat
              </h3>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                onClick={modalClose}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">
                  Chat Name
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter chat name..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="mb-4">
                <label className="flex items-center text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">
                  <input
                    type="checkbox"
                    className="mr-2 h-4 w-4 text-pink-600 focus:ring-pink-500 border-gray-300 rounded"
                    checked={isPrivate}
                    onChange={() => setIsPrivate(!isPrivate)}
                  />
                  Private Chat
                </label>
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">
                  Add Friends (Optional)
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500 dark:bg-gray-700 dark:text-white mb-2"
                  placeholder="Search friends..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />

                <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md">
                  {isLoading.friends ? (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                      Loading friends...
                    </div>
                  ) : filteredFriends.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                      {searchQuery
                        ? "No friends match your search"
                        : "No friends found"}
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredFriends.map((friend) => (
                        <li key={friend.friend_id} className="p-2">
                          <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                              type="checkbox"
                              className="h-4 w-4 text-pink-600 focus:ring-pink-500 border-gray-300 rounded"
                              checked={selectedFriends.includes(
                                friend.friend_id,
                              )}
                              onChange={() =>
                                handleFriendToggle(friend.friend_id)
                              }
                            />
                            <div className="flex items-center">
                              <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center overflow-hidden mr-2">
                                {friend.friend_avatar ? (
                                  <img
                                    src={friend.friend_avatar}
                                    alt={friend.friend_name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="text-gray-600 dark:text-gray-400">
                                    👤
                                  </span>
                                )}
                              </div>
                              <span className="text-gray-700 dark:text-gray-300">
                                {friend.friend_name}
                              </span>
                            </div>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {selectedFriends.length > 0 && (
                  <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {selectedFriends.length} friend
                    {selectedFriends.length > 1 ? "s" : ""} selected
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400"
                  onClick={modalClose}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  disabled={!name.trim()}
                >
                  Create Chat
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
export default CreateChatModal;
