-- Additive/idempotent: no Food DB writes.
CREATE TABLE IF NOT EXISTS marketing_suppressions (
  phone TEXT PRIMARY KEY, suppressed BOOLEAN NOT NULL DEFAULT TRUE,
  source TEXT NOT NULL DEFAULT 'whatsapp', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID PRIMARY KEY, request_hash TEXT NOT NULL, spec JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued', last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS marketing_recipients (
  campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id), phone TEXT NOT NULL,
  name TEXT, status TEXT NOT NULL DEFAULT 'queued', wamid TEXT, error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(campaign_id, phone)
);
CREATE INDEX IF NOT EXISTS idx_marketing_wamid ON marketing_recipients(wamid) WHERE wamid IS NOT NULL;
