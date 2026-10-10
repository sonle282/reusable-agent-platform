-- "Fix this answer": one row per fix, from suggestion to verified/published (PRD 7.1-7.2).
-- customer_message is stored with phone numbers and emails masked.
CREATE TABLE IF NOT EXISTS answer_fixes (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  origin TEXT NOT NULL CHECK(origin IN ('test','conversation','attention')),
  conversation_id TEXT,
  customer_message TEXT NOT NULL,
  bad_reply TEXT NOT NULL,
  correct_reply TEXT NOT NULL,
  suggestion_json TEXT NOT NULL DEFAULT '{}',
  target_kind TEXT CHECK(target_kind IN ('data','knowledge','rule')),
  change_json TEXT,
  eval_case_id TEXT,
  status TEXT NOT NULL DEFAULT 'suggested' CHECK(status IN ('suggested','verified','kept_failing','published','dismissed','undone')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  applied_at TEXT,
  verified_at TEXT,
  published_version_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_answer_fixes_agent_status ON answer_fixes(agent_id, status);

-- Needs attention items the owner dismissed, with the reason they gave.
CREATE TABLE IF NOT EXISTS attention_dismissals (
  item_key TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
