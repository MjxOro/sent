-- server/scripts/migrations/004_add_room_member_status.sql
BEGIN;

-- Add status column to room_members
ALTER TABLE room_members 
    ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'joined';

-- Update existing members to 'joined' status
UPDATE room_members 
    SET status = 'joined';

-- Add constraint to ensure valid status values
ALTER TABLE room_members
    ADD CONSTRAINT room_members_status_check 
    CHECK (status IN ('pending', 'joined', 'declined'));

COMMIT;
