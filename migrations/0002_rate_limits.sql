CREATE TABLE IF NOT EXISTS api_rate_limits (
  key_hash TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(key_hash, window_start)
);

DELETE FROM api_rate_limits WHERE window_start < (unixepoch() / 60) - 1440;

