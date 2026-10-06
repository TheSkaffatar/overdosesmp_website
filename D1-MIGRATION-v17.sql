-- Run once in Cloudflare D1 Console before deploying v17.
ALTER TABLE accounts ADD COLUMN profile_public INTEGER NOT NULL DEFAULT 1;
