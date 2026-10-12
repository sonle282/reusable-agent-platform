-- Photos the assistant has sent to a customer on a real channel. They are kept so chat history never shows a
-- missing photo; only photos no row links to and no customer has received are deleted.
CREATE TABLE IF NOT EXISTS sent_images (
  name TEXT PRIMARY KEY,
  first_sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);
