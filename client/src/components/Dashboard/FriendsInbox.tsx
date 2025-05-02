"use client";

import { useState, useEffect } from "react";
import { useFriendStore, Friend, User } from "@/stores/friendStore";
import { useUIStore } from "@/stores/dashboardUIStore";
import { motion, AnimatePresence } from "framer-motion";
import { useNotificationStore } from "@/stores/notificationStore";

export default function FriendsInbox() {
  const {
    friends,
    pendingRequests,
    potentialFriends,
    isLoading,
    loadFriends,
    loadPendingRequests,
    loadPotentialFriends,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    blockUser,
    unblockUser,
    removeFriend,
  } = useFriendStore();

  const { addNotification } = useNotificationStore();

  const [activeTab, setActiveTab] = useState<
    "friends" | "pending" | "discover"
  >("friends");
  const [searchValue, setSearchValue] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filter function
  const filterBySearch = (item: Friend | User) => {
    if (!searchValue.trim()) return true;
    if (!item) return false;

    const searchLower = searchValue.toLowerCase();
    const nameField = "friend_name" in item ? item.friend_name : item.name;

    // Add null check for nameField
    if (!nameField) return false;

    return nameField.toLowerCase().includes(searchLower);
  };

  // Load data on mount
  useEffect(() => {
    loadFriends();
    loadPendingRequests();
    loadPotentialFriends();
  }, [loadFriends, loadPendingRequests, loadPotentialFriends]);

  // Handle friend actions with loading state
  const handleFriendAction = async (
    action: "add" | "accept" | "reject" | "block" | "unblock" | "remove",
    id: string,
  ) => {
    setActionLoading(id);
    try {
      switch (action) {
        case "add":
          await sendFriendRequest(id);
          addNotification({
            type: "system",
            title: "Friend Request Sent",
            message: "Your friend request has been sent successfully.",
          });
          break;
        case "accept":
          await acceptFriendRequest(id);
          addNotification({
            type: "system",
            title: "Friend Request Accepted",
            message: "You are now friends!",
          });
          break;
        case "reject":
          await rejectFriendRequest(id);
          break;
        case "block":
          await blockUser(id);
          addNotification({
            type: "system",
            title: "User Blocked",
            message: "This user has been blocked.",
          });
          break;
        case "unblock":
          await unblockUser(id);
          break;
        case "remove":
          await removeFriend(id);
          addNotification({
            type: "system",
            title: "Friend Removed",
            message: "Friend has been removed from your list.",
          });
          break;
      }
    } catch (error) {
      console.error(`Failed to ${action} friend:`, error);
      addNotification({
        type: "system",
        title: "Action Failed",
        message: `Failed to ${action} the user. Please try again.`,
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Render friend/user card
  const renderUserCard = (
    user: Friend | User,
    type: "friend" | "pending" | "potential",
  ) => {
    // Add null checks for all user properties
    if (!user) return null;

    const isActionLoading =
      actionLoading === ("id" in user ? user.id : user.friend_id);
    const userName = "friend_name" in user ? user.friend_name : user.name;
    const userId = "friend_id" in user ? user.friend_id : user.id;
    const userEmail = "friend_email" in user ? user.friend_email : user.email;
    const avatarUrl =
      "friend_avatar" in user ? user.friend_avatar : user.avatar;
    const friendshipId = "id" in user ? user.id : "";

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex items-center justify-between"
      >
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center overflow-hidden">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={userName || "User"}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xl">👤</span>
            )}
          </div>
          <div className="ml-3">
            <h3 className="font-medium dark:text-gray-200">
              {userName || "Unknown User"}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {userEmail || "No email"}
            </p>
          </div>
        </div>

        <div className="flex space-x-2">
          {type === "friend" && (
            <>
              <button
                onClick={() => handleFriendAction("remove", userId)}
                disabled={isActionLoading}
                className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded"
              >
                {isActionLoading ? "..." : "Remove"}
              </button>
              <button
                onClick={() => handleFriendAction("block", userId)}
                disabled={isActionLoading}
                className="px-3 py-1 text-sm bg-red-100 hover:bg-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-700 dark:text-red-400 rounded"
              >
                {isActionLoading ? "..." : "Block"}
              </button>
            </>
          )}

          {type === "pending" && (
            <>
              <button
                onClick={() => handleFriendAction("accept", friendshipId)}
                disabled={isActionLoading}
                className="px-3 py-1 text-sm bg-green-500 hover:bg-green-600 text-white rounded"
              >
                {isActionLoading ? "..." : "Accept"}
              </button>
              <button
                onClick={() => handleFriendAction("reject", friendshipId)}
                disabled={isActionLoading}
                className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded"
              >
                {isActionLoading ? "..." : "Reject"}
              </button>
            </>
          )}

          {type === "potential" && (
            <button
              onClick={() => handleFriendAction("add", userId)}
              disabled={isActionLoading}
              className="px-3 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded"
            >
              {isActionLoading ? "Sending..." : "Add Friend"}
            </button>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 border-b dark:border-gray-700">
          <h1 className="text-2xl font-bold dark:text-gray-200">Friends</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your connections
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b dark:border-gray-700">
          <div className="flex">
            <button
              onClick={() => setActiveTab("friends")}
              className={`px-4 py-3 font-medium text-sm focus:outline-none ${
                activeTab === "friends"
                  ? "border-b-2 border-pink-500 text-pink-600 dark:text-pink-400"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              Friends{" "}
              {(friends || []).length > 0 && `(${(friends || []).length})`}
            </button>
            <button
              onClick={() => setActiveTab("pending")}
              className={`px-4 py-3 font-medium text-sm focus:outline-none ${
                activeTab === "pending"
                  ? "border-b-2 border-pink-500 text-pink-600 dark:text-pink-400"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              Pending{" "}
              {(pendingRequests || []).length > 0 &&
                `(${(pendingRequests || []).length})`}
            </button>
            <button
              onClick={() => setActiveTab("discover")}
              className={`px-4 py-3 font-medium text-sm focus:outline-none ${
                activeTab === "discover"
                  ? "border-b-2 border-pink-500 text-pink-600 dark:text-pink-400"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              Discover Friends
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="p-4 border-b dark:border-gray-700">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 dark:text-gray-400">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search by name..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-500 dark:text-gray-200"
            />
          </div>
        </div>

        {/* Content area */}
        <div className="p-6">
          {isLoading &&
          (isLoading.friends || isLoading.requests || isLoading.potential) ? (
            <div className="py-10 text-center">
              <div className="inline-flex space-x-2 items-center">
                <div className="w-2 h-2 bg-pink-600 rounded-full animate-bounce"></div>
                <div
                  className="w-2 h-2 bg-pink-600 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                ></div>
                <div
                  className="w-2 h-2 bg-pink-600 rounded-full animate-bounce"
                  style={{ animationDelay: "0.4s" }}
                ></div>
              </div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Loading...
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence mode="wait">
                {activeTab === "friends" && (
                  <motion.div
                    key="friends-list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-3"
                  >
                    {(friends || []).filter(filterBySearch).length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500 dark:text-gray-400">
                          No friends found
                        </p>
                        <button
                          onClick={() => setActiveTab("discover")}
                          className="mt-3 text-sm text-pink-600 dark:text-pink-400 hover:underline"
                        >
                          Discover people to add
                        </button>
                      </div>
                    ) : (
                      (friends || [])
                        .filter(filterBySearch)
                        .map((friend) => renderUserCard(friend, "friend"))
                    )}
                  </motion.div>
                )}

                {activeTab === "pending" && (
                  <motion.div
                    key="pending-list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-3"
                  >
                    {(pendingRequests || []).filter(filterBySearch).length ===
                    0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500 dark:text-gray-400">
                          No pending requests
                        </p>
                      </div>
                    ) : (
                      (pendingRequests || [])
                        .filter(filterBySearch)
                        .map((request) => renderUserCard(request, "pending"))
                    )}
                  </motion.div>
                )}

                {activeTab === "discover" && (
                  <motion.div
                    key="discover-list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-3"
                  >
                    {(potentialFriends || []).filter(filterBySearch).length ===
                    0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500 dark:text-gray-400">
                          No users found
                        </p>
                        <button
                          onClick={() => loadPotentialFriends()}
                          className="mt-3 text-sm text-pink-600 dark:text-pink-400 hover:underline"
                        >
                          Refresh list
                        </button>
                      </div>
                    ) : (
                      (potentialFriends || [])
                        .filter(filterBySearch)
                        .map((user) => renderUserCard(user, "potential"))
                    )}

                    {(potentialFriends || []).length > 0 && (
                      <div className="pt-4 text-center">
                        <button
                          onClick={() =>
                            loadPotentialFriends(
                              20,
                              (potentialFriends || []).length,
                            )
                          }
                          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg"
                        >
                          Load More
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
