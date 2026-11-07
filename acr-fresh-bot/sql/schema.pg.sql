-- Amma Chethi Ruchulu — Postgres schema (production)
-- Apply: npm run db:migrate
-- Safe to re-run (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Home cooks (USP). See AMMAS.md
CREATE TABLE IF NOT EXISTS ammas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  payout_share_bps INTEGER NOT NULL DEFAULT 7000,
  upi_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS dishes (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'veg',
  meal TEXT NOT NULL CHECK (meal IN ('lunch', 'dinner', 'both', 'fresh')),
  price_paise INTEGER NOT NULL,
  cook_name TEXT,
  amma_id TEXT REFERENCES ammas (id) ON DELETE SET NULL,
  max_portions INTEGER NOT NULL DEFAULT 20,
  portions_sold INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  note TEXT,
  advance_only BOOLEAN NOT NULL DEFAULT FALSE
);

-- Existing DBs may lack amma_id
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS amma_id TEXT REFERENCES ammas (id) ON DELETE SET NULL;
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS name_te TEXT;

CREATE TABLE IF NOT EXISTS customers (
  phone TEXT PRIMARY KEY,
  name TEXT,
  last_address TEXT,
  default_zone TEXT,
  addresses JSONB NOT NULL DEFAULT '[]'::jsonb,
  order_count INTEGER NOT NULL DEFAULT 0,
  last_order_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sessions (
  phone TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_ref TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  customer_name TEXT,
  meal TEXT NOT NULL,
  service_date DATE,
  service_label TEXT,
  delivery_slot TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  dish_code TEXT,
  dish_name TEXT,
  category TEXT,
  qty INTEGER,
  unit_price_paise INTEGER,
  food_paise INTEGER,
  delivery_zone TEXT,
  delivery_fee_paise INTEGER NOT NULL DEFAULT 0,
  total_paise INTEGER NOT NULL,
  address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_payment',
  source TEXT NOT NULL DEFAULT 'whatsapp',
  paid_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  feedback_requested_at TIMESTAMPTZ,
  feedback_nudge_sent BOOLEAN NOT NULL DEFAULT FALSE,
  feedback_nudge_at TIMESTAMPTZ,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders (phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_meal_status ON orders (meal, status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_service_date ON orders (service_date);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_slot ON orders (delivery_slot);
CREATE INDEX IF NOT EXISTS idx_dishes_amma ON dishes (amma_id);

-- Existing DBs: widen meal CHECK + optional hourly slot column
ALTER TABLE dishes DROP CONSTRAINT IF EXISTS dishes_meal_check;
ALTER TABLE dishes ADD CONSTRAINT dishes_meal_check
  CHECK (meal IN ('lunch', 'dinner', 'both', 'fresh'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_slot TEXT;

CREATE TABLE IF NOT EXISTS feedbacks (
  id SERIAL PRIMARY KEY,
  order_ref TEXT NOT NULL UNIQUE,
  phone TEXT,
  average_rating NUMERIC,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedbacks_phone ON feedbacks (phone);

CREATE TABLE IF NOT EXISTS help_tickets (
  id SERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  topic TEXT,
  message TEXT,
  order_ref TEXT,
  order_status TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_helps_phone ON help_tickets (phone);
CREATE INDEX IF NOT EXISTS idx_helps_created ON help_tickets (created_at DESC);

-- WhatsApp message log (inbound + outbound) for admin Conversations
CREATE TABLE IF NOT EXISTS wa_messages (
  id SERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  kind TEXT NOT NULL DEFAULT 'text',
  body TEXT,
  title TEXT,
  wa_message_id TEXT,
  profile_name TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_messages_phone_created ON wa_messages (phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_messages_created ON wa_messages (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_messages_wa_id
  ON wa_messages (wa_message_id)
  WHERE wa_message_id IS NOT NULL AND wa_message_id <> '';

-- Future: weekly Amma payouts (ledger). Admin earnings preview works without rows for now.
CREATE TABLE IF NOT EXISTS amma_payout_weeks (
  id SERIAL PRIMARY KEY,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  UNIQUE (week_start, week_end)
);

CREATE TABLE IF NOT EXISTS amma_payout_lines (
  id SERIAL PRIMARY KEY,
  week_id INTEGER NOT NULL REFERENCES amma_payout_weeks (id) ON DELETE CASCADE,
  amma_id TEXT NOT NULL,
  amma_name TEXT NOT NULL,
  portions INTEGER NOT NULL DEFAULT 0,
  gross_food_paise INTEGER NOT NULL DEFAULT 0,
  share_bps INTEGER NOT NULL DEFAULT 7000,
  share_paise INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  notes TEXT,
  UNIQUE (week_id, amma_id)
);

CREATE INDEX IF NOT EXISTS idx_payout_lines_week ON amma_payout_lines (week_id);

-- Delivery riders (synced with Food)
CREATE TABLE IF NOT EXISTS riders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  pin_hash TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_riders_phone ON riders (phone);
CREATE INDEX IF NOT EXISTS idx_riders_active ON riders (active);
CREATE INDEX IF NOT EXISTS idx_orders_rider ON orders ((meta->>'rider_id'));

-- Daily cashbook (expenses, manual cash, opening backlog)
CREATE TABLE IF NOT EXISTS cashbook_entries (
  id SERIAL PRIMARY KEY,
  entry_date DATE NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN (
    'opening_balance',
    'expense',
    'manual_cash_in',
    'adjustment'
  )),
  amount_paise INTEGER NOT NULL,
  note TEXT,
  order_ref TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cashbook_date ON cashbook_entries (entry_date);
CREATE INDEX IF NOT EXISTS idx_cashbook_kind ON cashbook_entries (kind);

-- Daily competitor / mandi price board (Fresh admin Pricing tab)
CREATE TABLE IF NOT EXISTS price_board (
  id SERIAL PRIMARY KEY,
  observed_on DATE NOT NULL,
  item_key TEXT NOT NULL,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('vegetables', 'fruits')),
  uom TEXT NOT NULL DEFAULT '1 Kg',
  dish_code TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  local_paise INTEGER,
  blinkit_paise INTEGER,
  instamart_paise INTEGER,
  raithu_paise INTEGER,
  suggested_acr_paise INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (observed_on, item_key)
);
CREATE INDEX IF NOT EXISTS idx_price_board_day ON price_board (observed_on);
CREATE INDEX IF NOT EXISTS idx_price_board_dish ON price_board (dish_code);


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
