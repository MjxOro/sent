// internal/db/postgres/notifications.go
package postgres

import (
	"fmt"
	"time"

	"github.com/mjxoro/sent/server/internal/models"
)

type NotificationRepository struct {
	db *DB
}

func NewNotificationRepository(db *DB) *NotificationRepository {
	return &NotificationRepository{
		db: db,
	}
}

// CreateMessageNotification creates a message type notification
func (r *NotificationRepository) CreateMessageNotification(n *models.MessageNotification) error {
	tx, err := r.db.Beginx()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Insert base notification
	baseQuery := `
        INSERT INTO notifications (id, type, user_id, is_read, created_at)
        VALUES ($1, $2, $3, $4, $5)
    `
	if _, err := tx.Exec(baseQuery, n.ID, n.Type, n.UserID, n.IsRead, n.CreatedAt); err != nil {
		return fmt.Errorf("failed to insert base notification: %w", err)
	}

	// Insert message notification
	msgQuery := `
        INSERT INTO message_notifications 
            (notification_id, message_id, room_id, sender_id, content)
        VALUES ($1, $2, $3, $4, $5)
    `
	if _, err := tx.Exec(msgQuery, n.ID, n.MessageID, n.RoomID, n.SenderID, n.Content); err != nil {
		return fmt.Errorf("failed to insert message notification: %w", err)
	}

	// Update room member notification state
	stateQuery := `
        INSERT INTO room_member_notification_states 
            (id, room_id, user_id, unread_count)
        VALUES ($1, $2, $3, 1)
        ON CONFLICT (room_id, user_id) DO UPDATE
        SET unread_count = room_member_notification_states.unread_count + 1,
            updated_at = NOW()
    `
	if _, err := tx.Exec(stateQuery, generateUUID(), n.RoomID, n.UserID); err != nil {
		return fmt.Errorf("failed to update notification state: %w", err)
	}

	return tx.Commit()
}

// CreateFriendRequestNotification creates a friend request type notification
func (r *NotificationRepository) CreateFriendRequestNotification(n *models.FriendRequestNotification) error {
	tx, err := r.db.Beginx()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Insert base notification
	baseQuery := `
        INSERT INTO notifications (id, type, user_id, is_read, created_at)
        VALUES ($1, $2, $3, $4, $5)
    `
	if _, err := tx.Exec(baseQuery, n.ID, n.Type, n.UserID, n.IsRead, n.CreatedAt); err != nil {
		return fmt.Errorf("failed to insert base notification: %w", err)
	}

	// Insert friend request notification
	friendQuery := `
        INSERT INTO friend_request_notifications 
            (notification_id, friendship_id, requester_id)
        VALUES ($1, $2, $3)
    `
	if _, err := tx.Exec(friendQuery, n.ID, n.FriendshipID, n.RequesterID); err != nil {
		return fmt.Errorf("failed to insert friend request notification: %w", err)
	}

	return tx.Commit()
}

// CreateChatInviteNotification creates a chat invite type notification
func (r *NotificationRepository) CreateChatInviteNotification(n *models.ChatInviteNotification) error {
	tx, err := r.db.Beginx()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Insert base notification
	baseQuery := `
        INSERT INTO notifications (id, type, user_id, is_read, created_at)
        VALUES ($1, $2, $3, $4, $5)
    `
	if _, err := tx.Exec(baseQuery, n.ID, n.Type, n.UserID, n.IsRead, n.CreatedAt); err != nil {
		return fmt.Errorf("failed to insert base notification: %w", err)
	}

	// Insert chat invite notification
	inviteQuery := `
        INSERT INTO chat_invite_notifications 
            (notification_id, room_id, inviter_id)
        VALUES ($1, $2, $3)
    `
	if _, err := tx.Exec(inviteQuery, n.ID, n.RoomID, n.InviterID); err != nil {
		return fmt.Errorf("failed to insert chat invite notification: %w", err)
	}

	return tx.Commit()
}

// GetNotifications retrieves all notifications for a user with their specific data
func (r *NotificationRepository) GetNotifications(userID string, limit, offset int) ([]*models.NotificationResponse, error) {
	// Get message notifications
	msgQuery := `
        SELECT 
            n.id, n.type, n.user_id, n.is_read, n.created_at,
            mn.message_id, mn.room_id, mn.sender_id, mn.content,
            u.name as sender_name, u.avatar as sender_avatar,
            r.name as room_name
        FROM notifications n
        JOIN message_notifications mn ON n.id = mn.notification_id
        JOIN users u ON mn.sender_id = u.id
        JOIN rooms r ON mn.room_id = r.id
        WHERE n.user_id = $1 AND n.type = 'message'
    `

	// Get friend request notifications
	friendQuery := `
        SELECT 
            n.id, n.type, n.user_id, n.is_read, n.created_at,
            frn.friendship_id, frn.requester_id,
            u.name as requester_name, u.avatar as requester_avatar
        FROM notifications n
        JOIN friend_request_notifications frn ON n.id = frn.notification_id
        JOIN users u ON frn.requester_id = u.id
        WHERE n.user_id = $1 AND n.type = 'friend_request'
    `

	// Get chat invite notifications
	inviteQuery := `
        SELECT 
            n.id, n.type, n.user_id, n.is_read, n.created_at,
            cin.room_id, cin.inviter_id,
            u.name as inviter_name, u.avatar as inviter_avatar,
            r.name as room_name
        FROM notifications n
        JOIN chat_invite_notifications cin ON n.id = cin.notification_id
        JOIN users u ON cin.inviter_id = u.id
        JOIN rooms r ON cin.room_id = r.id
        WHERE n.user_id = $1 AND n.type = 'chat_invite'
    `

	// Combine queries with UNION ALL and add ordering and pagination
	query := fmt.Sprintf(`
        WITH all_notifications AS (
            (%s)
            UNION ALL
            (%s)
            UNION ALL
            (%s)
        )
        SELECT * FROM all_notifications
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
    `, msgQuery, friendQuery, inviteQuery)

	rows, err := r.db.Queryx(query, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to query notifications: %w", err)
	}
	defer rows.Close()

	var notifications []*models.NotificationResponse
	for rows.Next() {
		var baseNotif struct {
			ID        string    `db:"id"`
			Type      string    `db:"type"`
			UserID    string    `db:"user_id"`
			IsRead    bool      `db:"is_read"`
			CreatedAt time.Time `db:"created_at"`
		}

		// Scan base fields first
		if err := rows.StructScan(&baseNotif); err != nil {
			return nil, fmt.Errorf("failed to scan base notification: %w", err)
		}

		// Create response object based on type
		notif := &models.NotificationResponse{
			ID:        baseNotif.ID,
			Type:      models.NotificationType(baseNotif.Type),
			UserID:    baseNotif.UserID,
			IsRead:    baseNotif.IsRead,
			CreatedAt: baseNotif.CreatedAt,
		}

		// Scan type-specific fields
		switch models.NotificationType(baseNotif.Type) {
		case models.NotificationTypeMessage:
			var msg models.MessageNotification
			if err := rows.StructScan(&msg); err != nil {
				return nil, fmt.Errorf("failed to scan message notification: %w", err)
			}
			notif.Data = msg.ToResponse().Data

		case models.NotificationTypeFriendRequest:
			var friend models.FriendRequestNotification
			if err := rows.StructScan(&friend); err != nil {
				return nil, fmt.Errorf("failed to scan friend request notification: %w", err)
			}
			notif.Data = friend.ToResponse().Data

		case models.NotificationTypeChatInvite:
			var invite models.ChatInviteNotification
			if err := rows.StructScan(&invite); err != nil {
				return nil, fmt.Errorf("failed to scan chat invite notification: %w", err)
			}
			notif.Data = invite.ToResponse().Data
		}

		notifications = append(notifications, notif)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating notifications: %w", err)
	}

	return notifications, nil
}

// MarkAsRead marks notifications as read
func (r *NotificationRepository) MarkAsRead(userID string, notificationIDs []string) error {
	query := `
        UPDATE notifications 
        SET is_read = true 
        WHERE user_id = $1 AND id = ANY($2)
    `
	result, err := r.db.Exec(query, userID, notificationIDs)
	if err != nil {
		return fmt.Errorf("failed to mark notifications as read: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get affected rows: %w", err)
	}

	if rows == 0 {
		return fmt.Errorf("no notifications were updated")
	}

	return nil
}

// GetUnreadCount gets the number of unread notifications for a user
func (r *NotificationRepository) GetUnreadCount(userID string) (int, error) {
	var count int
	query := `
        SELECT COUNT(*) 
        FROM notifications 
        WHERE user_id = $1 AND is_read = false
    `
	if err := r.db.Get(&count, query, userID); err != nil {
		return 0, fmt.Errorf("failed to get unread count: %w", err)
	}
	return count, nil
}

// DeleteNotification deletes a notification
func (r *NotificationRepository) DeleteNotification(userID string, notificationID string) error {
	query := `
        DELETE FROM notifications 
        WHERE id = $1 AND user_id = $2
    `
	result, err := r.db.Exec(query, notificationID, userID)
	if err != nil {
		return fmt.Errorf("failed to delete notification: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get affected rows: %w", err)
	}

	if rows == 0 {
		return fmt.Errorf("notification not found")
	}

	return nil
}

// generateUUID generates a new UUID (implement this based on your UUID package)
func generateUUID() string {
	// Implement using your preferred UUID package
	return "uuid" // placeholder
}
