-- Run once before deploying the messaging UI update.
-- Existing messages are marked read so the new inbox starts clean; new incoming messages remain unread until opened.
ALTER TABLE player_messages ADD COLUMN read_at INTEGER;
UPDATE player_messages SET read_at = created_at WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_player_messages_unread ON player_messages(recipient_uuid, read_at, created_at);
