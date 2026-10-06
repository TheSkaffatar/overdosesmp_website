-- Run once in Cloudflare D1 Console before deploying v18.
-- Adds the three new profile statistics and persistent cross-platform messages.
ALTER TABLE minecraft_player_stats ADD COLUMN duels_won INTEGER NOT NULL DEFAULT 0;
ALTER TABLE minecraft_player_stats ADD COLUMN duels_lost INTEGER NOT NULL DEFAULT 0;
ALTER TABLE minecraft_player_stats ADD COLUMN contracts_completed INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS player_messages (
  id TEXT PRIMARY KEY,
  sender_uuid TEXT NOT NULL,
  recipient_uuid TEXT NOT NULL,
  body TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('web','game')),
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending','delivered')),
  delivery_mode TEXT CHECK (delivery_mode IN ('msg','mail')),
  created_at INTEGER NOT NULL,
  delivered_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_player_messages_pair_time ON player_messages(sender_uuid, recipient_uuid, created_at);
CREATE INDEX IF NOT EXISTS idx_player_messages_outbox ON player_messages(source, delivery_status, created_at);
