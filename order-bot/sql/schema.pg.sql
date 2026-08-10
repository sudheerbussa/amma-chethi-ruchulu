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
  meal TEXT NOT NULL CHECK (meal IN ('lunch', 'dinner', 'both')),
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
CREATE INDEX IF NOT EXISTS idx_dishes_amma ON dishes (amma_id);

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
