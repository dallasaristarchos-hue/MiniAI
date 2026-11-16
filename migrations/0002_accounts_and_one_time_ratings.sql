CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
ALTER TABLE ratings ADD COLUMN account_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ratings_one_per_account ON ratings(account_id) WHERE account_id IS NOT NULL;
