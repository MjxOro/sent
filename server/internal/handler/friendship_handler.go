// internal/handler/friendship_handler.go
package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/mjxoro/sent/server/internal/service"
)

// FriendshipHandler handles friendship-related requests
type FriendshipHandler struct {
	friendshipService *service.FriendshipService
}

// NewFriendshipHandler creates a new friendship handler
func NewFriendshipHandler(friendshipService *service.FriendshipService) *FriendshipHandler {
	return &FriendshipHandler{
		friendshipService: friendshipService,
	}
}

// GetFriends gets all friends for the current user
func (h *FriendshipHandler) GetFriends(c *gin.Context) {
	userID := c.GetString("userID")

	friends, err := h.friendshipService.GetFriends(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get friends"})
		return
	}

	c.JSON(http.StatusOK, friends)
}

// GetFriendRequests gets all pending friend requests for the current user
func (h *FriendshipHandler) GetFriendRequests(c *gin.Context) {
	userID := c.GetString("userID")

	requests, err := h.friendshipService.GetPendingRequests(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get friend requests"})
		return
	}

	c.JSON(http.StatusOK, requests)
}

// GetAllRelationships gets all friendship relationships for the current user
func (h *FriendshipHandler) GetAllRelationships(c *gin.Context) {
	userID := c.GetString("userID")

	relationships, err := h.friendshipService.GetAllRelationships(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get relationships"})
		return
	}

	c.JSON(http.StatusOK, relationships)
}

// SendFriendRequest handles sending a friend request
func (h *FriendshipHandler) SendFriendRequest(c *gin.Context) {
	userID := c.GetString("userID")
	friendID := c.Param("userId")

	if userID == friendID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot send friend request to yourself"})
		return
	}

	friendship, err := h.friendshipService.SendFriendRequest(userID, friendID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, friendship)
}

// AcceptFriendRequest handles accepting a friend request
func (h *FriendshipHandler) AcceptFriendRequest(c *gin.Context) {
	userID := c.GetString("userID")
	friendshipID := c.Param("friendshipId")

	err := h.friendshipService.AcceptFriendRequest(friendshipID, userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Friend request accepted"})
}

// RejectFriendRequest handles rejecting a friend request
func (h *FriendshipHandler) RejectFriendRequest(c *gin.Context) {
	userID := c.GetString("userID")
	friendshipID := c.Param("friendshipId")

	err := h.friendshipService.RejectFriendRequest(friendshipID, userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Friend request rejected"})
}

// RemoveFriend handles removing a friend
func (h *FriendshipHandler) RemoveFriend(c *gin.Context) {
	userID := c.GetString("userID")
	friendID := c.Param("userId")

	err := h.friendshipService.RemoveFriend(userID, friendID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Friend removed"})
}

// BlockUser handles blocking a user
func (h *FriendshipHandler) BlockUser(c *gin.Context) {
	userID := c.GetString("userID")
	blockUserID := c.Param("userId")

	err := h.friendshipService.BlockUser(userID, blockUserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User blocked"})
}

// UnblockUser handles unblocking a user
func (h *FriendshipHandler) UnblockUser(c *gin.Context) {
	userID := c.GetString("userID")
	blockedUserID := c.Param("userId")

	err := h.friendshipService.UnblockUser(userID, blockedUserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User unblocked"})
}

// GetPotentialFriends gets users who are not yet friends with the current user
func (h *FriendshipHandler) GetPotentialFriends(c *gin.Context) {
	userID := c.GetString("userID")

	// Parse pagination parameters
	limit := 20
	offset := 0

	if limitParam := c.Query("limit"); limitParam != "" {
		if parsedLimit, err := strconv.Atoi(limitParam); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	if offsetParam := c.Query("offset"); offsetParam != "" {
		if parsedOffset, err := strconv.Atoi(offsetParam); err == nil && parsedOffset >= 0 {
			offset = parsedOffset
		}
	}

	users, err := h.friendshipService.GetNonFriends(userID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get potential friends"})
		return
	}

	c.JSON(http.StatusOK, users)
}

// GetFriendshipStatus gets the status of friendship between the current user and another user
func (h *FriendshipHandler) GetFriendshipStatus(c *gin.Context) {
	userID := c.GetString("userID")
	otherUserID := c.Param("userId")

	status, err := h.friendshipService.GetFriendshipStatus(userID, otherUserID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "none"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": status})
}
