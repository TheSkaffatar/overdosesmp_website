-- Run once in Cloudflare D1 Console before deploying the security-hardened build.
-- Stores short-lived counters used to throttle brute force, verification guessing and message spam.
CREATE TABLE IF NOT EXISTS api_rate_limits (
  rate_key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (rate_key, window_start)
);
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_window ON api_rate_limits(window_start);
