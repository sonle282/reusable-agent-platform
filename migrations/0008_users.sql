-- Users (2026-10-26): several people sign in with a role. Existing admins become owners.
-- owner: everything; manager: assistants, Data, customer chats and leads; staff: Home, Leads, Conversations.
ALTER TABLE admins ADD COLUMN role TEXT NOT NULL DEFAULT 'owner' CHECK(role IN ('owner','manager','staff'));
ALTER TABLE admins ADD COLUMN name TEXT NOT NULL DEFAULT '';

-- One-time links: an invite creates a user; a reset sets a new password for an existing one.
-- Only a hash of the link's token is stored. Links expire, and a used link can't be used again.
CREATE TABLE IF NOT EXISTS user_links (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('invite','reset')),
  email TEXT NOT NULL,
  role TEXT CHECK(role IN ('owner','manager','staff')),
  name TEXT NOT NULL DEFAULT '',
  admin_id TEXT REFERENCES admins(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_by TEXT,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_user_links_email ON user_links(email, kind);
