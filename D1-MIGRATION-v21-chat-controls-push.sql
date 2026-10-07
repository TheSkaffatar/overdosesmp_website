-- Run once before deploying v21.
CREATE TABLE IF NOT EXISTS notification_settings (account_id TEXT PRIMARY KEY, push_enabled INTEGER NOT NULL DEFAULT 0, preview_enabled INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS push_subscriptions (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, endpoint TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_account ON push_subscriptions(account_id);
CREATE TABLE IF NOT EXISTS push_events (id TEXT PRIMARY KEY, recipient_uuid TEXT NOT NULL, sender_uuid TEXT NOT NULL, body TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_push_events_recipient_time ON push_events(recipient_uuid, created_at);
CREATE TABLE IF NOT EXISTS message_preferences (owner_uuid TEXT NOT NULL, peer_uuid TEXT NOT NULL, muted INTEGER NOT NULL DEFAULT 0, pinned INTEGER NOT NULL DEFAULT 0, blocked INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL, PRIMARY KEY(owner_uuid, peer_uuid));
CREATE INDEX IF NOT EXISTS idx_message_preferences_blocked ON message_preferences(owner_uuid, peer_uuid, blocked);
