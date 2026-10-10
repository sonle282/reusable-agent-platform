-- Owners can hide tables they no longer use; rows and history stay intact.
ALTER TABLE data_collections ADD COLUMN archived_at TEXT;
