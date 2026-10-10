PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id_hash TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  csrf_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS login_attempts (
  key_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS credentials (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  kind TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  primary_language TEXT NOT NULL DEFAULT 'vi',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','archived')),
  active_version_id TEXT,
  draft_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_versions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(agent_id, version)
);
CREATE INDEX IF NOT EXISTS idx_agent_versions_agent ON agent_versions(agent_id, version DESC);

CREATE TABLE IF NOT EXISTS data_collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  schema_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS data_records (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL REFERENCES data_collections(id) ON DELETE CASCADE,
  external_key TEXT,
  data_json TEXT NOT NULL,
  search_text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('draft','active','archived')),
  valid_from TEXT,
  valid_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(collection_id, external_key)
);
CREATE INDEX IF NOT EXISTS idx_records_collection_status ON data_records(collection_id, status);
CREATE INDEX IF NOT EXISTS idx_records_validity ON data_records(valid_from, valid_until);

CREATE TABLE IF NOT EXISTS data_record_values (
  record_id TEXT NOT NULL REFERENCES data_records(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  value_type TEXT NOT NULL,
  value_text TEXT,
  value_number REAL,
  value_boolean INTEGER,
  value_date TEXT,
  PRIMARY KEY(record_id, field_key)
);
CREATE INDEX IF NOT EXISTS idx_record_values_text ON data_record_values(field_key, value_text);
CREATE INDEX IF NOT EXISTS idx_record_values_number ON data_record_values(field_key, value_number);

CREATE TABLE IF NOT EXISTS knowledge_sources (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('text','file','url')),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','ready','failed')),
  r2_key TEXT,
  source_url TEXT,
  content_hash TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_knowledge_agent ON knowledge_sources(agent_id, status);

CREATE TABLE IF NOT EXISTS tool_definitions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('collection','http_get','plugin')),
  config_json TEXT NOT NULL,
  input_schema_json TEXT NOT NULL,
  output_schema_json TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(agent_id, name)
);

CREATE TABLE IF NOT EXISTS connections (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('generic_api','generic_webhook','zernio')),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','paused','error')),
  token_hash TEXT NOT NULL UNIQUE,
  api_key_hash TEXT,
  callback_url TEXT,
  config_json TEXT NOT NULL DEFAULT '{}',
  credential_id TEXT REFERENCES credentials(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_connections_agent ON connections(agent_id, status);

CREATE TABLE IF NOT EXISTS idempotency_events (
  event_id TEXT NOT NULL,
  connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'accepted',
  result_json TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(event_id, connection_id)
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  phone TEXT,
  email TEXT,
  locale TEXT,
  stage TEXT NOT NULL DEFAULT 'new',
  custom_json TEXT NOT NULL DEFAULT '{}',
  consent_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contact_identities (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  external_account_id TEXT NOT NULL DEFAULT '',
  external_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(channel, external_account_id, external_user_id)
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  connection_id TEXT,
  external_conversation_id TEXT NOT NULL,
  external_user_id TEXT NOT NULL,
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  agent_version_id TEXT,
  stage TEXT NOT NULL DEFAULT 'new',
  human_takeover INTEGER NOT NULL DEFAULT 0,
  last_message_preview TEXT NOT NULL DEFAULT '',
  last_activity_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(agent_id, connection_id, external_conversation_id)
);
CREATE INDEX IF NOT EXISTS idx_conversations_activity ON conversations(last_activity_at DESC);

CREATE TABLE IF NOT EXISTS runtime_events (
  id TEXT PRIMARY KEY,
  conversation_id TEXT,
  agent_id TEXT NOT NULL,
  version_id TEXT,
  request_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  latency_ms INTEGER,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_runtime_events_request ON runtime_events(request_id);

CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','delivered','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  response_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(connection_id, request_id)
);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status, updated_at);

CREATE TABLE IF NOT EXISTS eval_cases (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  input TEXT NOT NULL,
  assertions_json TEXT NOT NULL,
  critical INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS eval_runs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  version_id TEXT,
  status TEXT NOT NULL,
  result_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO settings(key, value_json) VALUES
  ('setup_complete', 'false'),
  ('brand', '{"name":"Agent Platform","logoUrl":"","primaryColor":"#d4ff57","supportUrl":""}');

INSERT OR IGNORE INTO data_collections(id, name, slug, description, schema_json) VALUES
  ('tpl_products', 'Products', 'products', 'Reusable product or service catalogue', '{"fields":[{"key":"name","label":"Name","type":"text","required":true},{"key":"summary","label":"Summary","type":"long_text","required":true},{"key":"price","label":"Price","type":"number","required":false},{"key":"url","label":"URL","type":"url","required":false},{"key":"image_url","label":"Image","type":"image_url","required":false}]}'),
  ('tpl_offers', 'Offers', 'offers', 'Time-bound promotions and offers', '{"fields":[{"key":"title","label":"Title","type":"text","required":true},{"key":"content","label":"Content","type":"long_text","required":true},{"key":"conditions","label":"Conditions","type":"long_text","required":false}]}'),
  ('tpl_policies', 'Policies', 'policies', 'Approved business facts and policies', '{"fields":[{"key":"topic","label":"Topic","type":"text","required":true},{"key":"question","label":"Customer question","type":"long_text","required":false},{"key":"answer","label":"Approved answer","type":"long_text","required":true}]}');
