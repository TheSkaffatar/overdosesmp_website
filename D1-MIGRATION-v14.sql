-- Run once in Cloudflare D1 Console before deploying v14.
ALTER TABLE verification_codes ADD COLUMN request_id TEXT;
ALTER TABLE verification_codes ADD COLUMN generation INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS idx_verification_minecraft_uuid ON verification_codes(minecraft_uuid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_verification_request_id ON verification_codes(request_id);
