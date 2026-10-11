-- Leads (v2.1): a lead is a contact who left a phone number or email in a real conversation.
-- The columns live on contacts so capture, export and erase keep working on one row.
ALTER TABLE contacts ADD COLUMN lead_status TEXT CHECK(lead_status IN ('new','called','won','not_fit'));
ALTER TABLE contacts ADD COLUMN lead_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE contacts ADD COLUMN lead_summary TEXT NOT NULL DEFAULT '';
ALTER TABLE contacts ADD COLUMN lead_created_at TEXT;
ALTER TABLE contacts ADD COLUMN lead_status_at TEXT;
ALTER TABLE contacts ADD COLUMN agent_id TEXT;
ALTER TABLE contacts ADD COLUMN platform TEXT;
CREATE INDEX IF NOT EXISTS idx_contacts_lead ON contacts(lead_status, lead_created_at);

-- Backfill (safe to re-run: only rows without a status). Older than 7 days counts as already called.
UPDATE contacts SET
  lead_status = CASE WHEN created_at < datetime('now', '-7 day') THEN 'called' ELSE 'new' END,
  lead_created_at = created_at,
  lead_status_at = created_at,
  agent_id = (SELECT cv.agent_id FROM conversations cv WHERE cv.contact_id = contacts.id AND cv.connection_id NOT IN ('preview','eval') ORDER BY cv.last_activity_at DESC LIMIT 1),
  platform = (SELECT COALESCE(json_extract(cn.config_json, '$.platform'), cn.type) FROM conversations cv JOIN connections cn ON cn.id = cv.connection_id WHERE cv.contact_id = contacts.id ORDER BY cv.last_activity_at DESC LIMIT 1)
WHERE lead_status IS NULL
  AND erased_at IS NULL
  AND (phone IS NOT NULL OR email IS NOT NULL)
  AND EXISTS (SELECT 1 FROM conversations cv WHERE cv.contact_id = contacts.id AND cv.connection_id NOT IN ('preview','eval'));
