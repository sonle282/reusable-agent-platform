-- When a customer's personal data was erased (PDPA / Vietnam PDP law). The row stays so counts and audit still add up.
ALTER TABLE contacts ADD COLUMN erased_at TEXT;
