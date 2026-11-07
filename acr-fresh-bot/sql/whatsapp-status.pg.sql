-- Additive/idempotent delivery audit. Contains no credentials or Food DB changes.
CREATE TABLE IF NOT EXISTS whatsapp_message_statuses (
  id BIGSERIAL PRIMARY KEY, wamid TEXT NOT NULL, recipient TEXT, status TEXT NOT NULL,
  error_code TEXT, error_title TEXT, error_detail TEXT, raw JSONB NOT NULL,
  ts TIMESTAMPTZ NOT NULL, received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(wamid,status,ts)
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_status_wamid ON whatsapp_message_statuses(wamid);
ALTER TABLE marketing_recipients ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE marketing_recipients ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE marketing_recipients ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE marketing_recipients ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;
ALTER TABLE marketing_recipients ADD COLUMN IF NOT EXISTS error_code TEXT;
ALTER TABLE marketing_recipients ADD COLUMN IF NOT EXISTS error_message TEXT;
