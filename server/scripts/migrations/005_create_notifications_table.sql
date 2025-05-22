-- migrations/005_create_notifications_tables.sql
BEGIN;

-- Create notification types enum
DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM (
        'message',
        'friend_request',
        'chat_invite'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Base notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY,
    type notification_type NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    -- Indexes for common queries
    CONSTRAINT notifications_user_type_idx UNIQUE (user_id, type, id)
);

-- Message notifications table
CREATE TABLE IF NOT EXISTS message_notifications (
    notification_id UUID PRIMARY KEY REFERENCES notifications(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    -- Indexes for foreign keys and common queries
    CONSTRAINT message_notifications_unique_idx UNIQUE (message_id, notification_id)
);

-- Friend request notifications table
CREATE TABLE IF NOT EXISTS friend_request_notifications (
    notification_id UUID PRIMARY KEY REFERENCES notifications(id) ON DELETE CASCADE,
    friendship_id UUID NOT NULL REFERENCES friendships(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Indexes for foreign keys and common queries
    CONSTRAINT friend_request_notifications_unique_idx UNIQUE (friendship_id, notification_id)
);

-- Chat invite notifications table
CREATE TABLE IF NOT EXISTS chat_invite_notifications (
    notification_id UUID PRIMARY KEY REFERENCES notifications(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Indexes for foreign keys and common queries
    CONSTRAINT chat_invite_notifications_unique_idx UNIQUE (room_id, notification_id)
);

-- Room member notification state table (for tracking unread counts per room)
CREATE TABLE IF NOT EXISTS room_member_notification_states (
    id UUID PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    unread_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    -- Ensure one state per user per room
    CONSTRAINT room_member_notification_states_unique_idx UNIQUE (room_id, user_id)
);

-- Indexes for base notifications table
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read) WHERE NOT is_read;
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE NOT is_read;

-- Indexes for message notifications
CREATE INDEX IF NOT EXISTS idx_message_notifications_message_id ON message_notifications(message_id);
CREATE INDEX IF NOT EXISTS idx_message_notifications_room_id ON message_notifications(room_id);
CREATE INDEX IF NOT EXISTS idx_message_notifications_sender_id ON message_notifications(sender_id);

-- Indexes for friend request notifications
CREATE INDEX IF NOT EXISTS idx_friend_request_notifications_friendship_id ON friend_request_notifications(friendship_id);
CREATE INDEX IF NOT EXISTS idx_friend_request_notifications_requester_id ON friend_request_notifications(requester_id);

-- Indexes for chat invite notifications
CREATE INDEX IF NOT EXISTS idx_chat_invite_notifications_room_id ON chat_invite_notifications(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_invite_notifications_inviter_id ON chat_invite_notifications(inviter_id);

-- Indexes for room member notification states
CREATE INDEX IF NOT EXISTS idx_room_member_notification_states_room_id ON room_member_notification_states(room_id);
CREATE INDEX IF NOT EXISTS idx_room_member_notification_states_user_id ON room_member_notification_states(user_id);
CREATE INDEX IF NOT EXISTS idx_room_member_notification_states_unread ON room_member_notification_states(user_id) WHERE unread_count > 0;

-- Add helpful comments
COMMENT ON TABLE notifications IS 'Base table for all notification types';
COMMENT ON TABLE message_notifications IS 'Notifications for new messages in rooms';
COMMENT ON TABLE friend_request_notifications IS 'Notifications for friend requests';
COMMENT ON TABLE chat_invite_notifications IS 'Notifications for chat room invitations';
COMMENT ON TABLE room_member_notification_states IS 'Tracks unread message counts per user per room';

COMMENT ON COLUMN notifications.type IS 'Type of notification (message, friend_request, chat_invite)';
COMMENT ON COLUMN notifications.user_id IS 'User receiving the notification';
COMMENT ON COLUMN notifications.is_read IS 'Whether the notification has been read';

COMMENT ON COLUMN message_notifications.content IS 'Content of the message that triggered the notification';
COMMENT ON COLUMN friend_request_notifications.requester_id IS 'User who sent the friend request';
COMMENT ON COLUMN chat_invite_notifications.inviter_id IS 'User who sent the chat invitation';

COMMENT ON COLUMN room_member_notification_states.last_read_message_id IS 'ID of the last message read by the user in this room';
COMMENT ON COLUMN room_member_notification_states.unread_count IS 'Number of unread messages for this user in this room';

-- Add triggers to update room_member_notification_states.updated_at
CREATE OR REPLACE FUNCTION update_room_member_notification_states_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_room_member_notification_states_updated_at
    BEFORE UPDATE ON room_member_notification_states
    FOR EACH ROW
    EXECUTE FUNCTION update_room_member_notification_states_updated_at();

COMMIT;
