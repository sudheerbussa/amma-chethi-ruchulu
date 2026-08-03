-- Amma Chethi Ruchulu — local order schema (SQLite)
-- Later migrate to Postgres / Supabase with same table names

CREATE TABLE IF NOT EXISTS dishes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  meal TEXT NOT NULL CHECK (meal IN ('lunch', 'dinner', 'both')),
  price_paise INTEGER NOT NULL,
  cook_name TEXT,
  max_portions INTEGER NOT NULL DEFAULT 20,
  portions_sold INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS customers (
  phone TEXT PRIMARY KEY,
  name TEXT,
  last_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  phone TEXT PRIMARY KEY,
  state TEXT NOT NULL DEFAULT 'idle',
  meal TEXT,
  dish_code TEXT,
  qty INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_ref TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  meal TEXT NOT NULL,
  dish_code TEXT NOT NULL,
  dish_name TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price_paise INTEGER NOT NULL,
  total_paise INTEGER NOT NULL,
  address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_payment',
  source TEXT NOT NULL DEFAULT 'whatsapp',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone);
