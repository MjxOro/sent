// internal/db/postgres/room_repo.go
package postgres

import (
	"time"

	"github.com/mjxoro/sent/server/internal/models"
)

// Room handles database operations for rooms
type Room struct {
	db *DB
}
type RoomMemberStatus string

const (
	RoomMemberStatusPending  RoomMemberStatus = "pending"
	RoomMemberStatusJoined   RoomMemberStatus = "joined"
	RoomMemberStatusDeclined RoomMemberStatus = "declined"
)

// NewRoom creates a new room repository
func NewRoom(db *DB) *Room {
	return &Room{
		db: db,
	}
}

// FindByID finds a room by ID
func (r *Room) FindByID(id string) (*models.Room, error) {
	query := `SELECT * FROM rooms WHERE id = $1`

	var room models.Room
	err := r.db.Get(&room, query, id)
	if err != nil {
		return nil, err
	}

	return &room, nil
}

// FindRoomsByUserID finds all rooms a user is a member of
func (r *Room) FindRoomsByUserID(userID string) ([]*models.Room, error) {
	query := `
    SELECT r.* FROM rooms r
    JOIN room_members rm ON r.id = rm.room_id
    WHERE rm.user_id = $1 AND rm.status = 'joined'
    ORDER BY r.updated_at DESC
	`
	var rooms []*models.Room
	err := r.db.Select(&rooms, query, userID)
	if err != nil {
		return nil, err
	}

	return rooms, nil
}

// Create creates a new room
func (r *Room) Create(room *models.Room) error {
	query := `
		INSERT INTO rooms (name, description, creator_id, is_private, type, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`

	now := time.Now()
	room.CreatedAt = now
	room.UpdatedAt = now

	return r.db.QueryRow(
		query,
		room.Name,
		room.Description,
		room.CreatorID,
		room.IsPrivate,
		room.Type,
		room.CreatedAt,
		room.UpdatedAt,
	).Scan(&room.ID)
}

// FindDMRoom finds a direct message room between two users
func (r *Room) FindDMRoom(user1ID, user2ID string) (*models.Room, error) {
	query := `
		SELECT r.* FROM rooms r
		JOIN room_members rm1 ON r.id = rm1.room_id
		JOIN room_members rm2 ON r.id = rm2.room_id
		WHERE r.type = 'direct'
		AND rm1.user_id = $1
		AND rm2.user_id = $2
		LIMIT 1
	`

	var room models.Room
	err := r.db.Get(&room, query, user1ID, user2ID)
	if err != nil {
		return nil, err
	}

	return &room, nil
}

// AddMember adds a user to a room
func (r *Room) AddMember(roomID, userID, role string, isCreator bool) error {
	query := `
        INSERT INTO room_members (
            room_id, 
            user_id, 
            role, 
            status,
            joined_at, 
            created_at, 
            updated_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    `

	now := time.Now()
	status := RoomMemberStatusPending
	if isCreator {
		status = RoomMemberStatusJoined
	}

	_, err := r.db.Exec(
		query,
		roomID,
		userID,
		role,
		status,
		now,
	)
	return err
}

// UpdateMemberStatus updates a member's status in a room
func (r *Room) UpdateMemberStatus(roomID, userID string, status RoomMemberStatus) error {
	statusStr := string(status)

	query := `
        UPDATE room_members 
        SET status = $1::varchar,
            joined_at = CASE 
                WHEN $1::varchar = 'joined' THEN NOW() 
                ELSE joined_at 
            END,
            updated_at = NOW()
        WHERE room_id = $2 AND user_id = $3
    `

	_, err := r.db.Exec(query, statusStr, roomID, userID)
	return err
}

// GetRoomMembers gets all members of a room
func (r *Room) GetRoomMembers(roomID string) ([]*models.User, error) {
	query := `
		SELECT u.* FROM users u
		JOIN room_members rm ON u.id = rm.user_id
		WHERE rm.room_id = $1
	`

	var users []*models.User
	err := r.db.Select(&users, query, roomID)
	if err != nil {
		return nil, err
	}

	return users, nil
}

// Delete deletes a room by ID
func (r *Room) Delete(id string) error {
	query := `DELETE FROM rooms WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}
