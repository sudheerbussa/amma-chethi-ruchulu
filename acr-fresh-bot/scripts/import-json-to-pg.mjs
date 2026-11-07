/**
 * One-time import: data/orders.json → Postgres
 * Usage: DATABASE_URL=... node scripts/import-json-to-pg.mjs [path/to/orders.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env') });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL first. Run: npm run db:migrate');
  process.exit(1);
}

const jsonPath = path.resolve(
  process.argv[2] || path.join(root, 'data', 'orders.json'),
);
if (!fs.existsSync(jsonPath)) {
  console.error('JSON file not found:', jsonPath);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const { default: pg } = await import('pg');
const client = new pg.Client({ connectionString: url });
await client.connect();

function asJson(v) {
  return JSON.stringify(v == null ? null : v);
}

try {
  await client.query('BEGIN');

  // Dishes
  if (Array.isArray(data.dishes)) {
    for (const d of data.dishes) {
      await client.query(
        `INSERT INTO dishes (
          code, name, category, meal, price_paise, cook_name,
          max_portions, portions_sold, active, note, advance_only
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (code) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          meal = EXCLUDED.meal,
          price_paise = EXCLUDED.price_paise,
          cook_name = EXCLUDED.cook_name,
          max_portions = EXCLUDED.max_portions,
          portions_sold = EXCLUDED.portions_sold,
          active = EXCLUDED.active,
          note = EXCLUDED.note,
          advance_only = EXCLUDED.advance_only`,
        [
          d.code,
          d.name,
          d.category || 'veg',
          d.meal || 'both',
          d.price_paise,
          d.cook_name || null,
          d.max_portions ?? 20,
          d.portions_sold || 0,
          d.active !== false,
          d.note || null,
          Boolean(d.advance_only),
        ],
      );
    }
    console.log('Imported dishes:', data.dishes.length);
  }

  if (data.menu_version != null) {
    await client.query(
      `INSERT INTO meta (key, value) VALUES ('menu_version', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [String(data.menu_version)],
    );
  }

  // Customers
  const customers = data.customers || {};
  let cCount = 0;
  for (const [phone, raw] of Object.entries(customers)) {
    await client.query(
      `INSERT INTO customers (
        phone, name, last_address, default_zone, addresses,
        order_count, last_order_at, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9)
      ON CONFLICT (phone) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, customers.name),
        last_address = COALESCE(EXCLUDED.last_address, customers.last_address),
        default_zone = COALESCE(EXCLUDED.default_zone, customers.default_zone),
        addresses = EXCLUDED.addresses,
        order_count = GREATEST(customers.order_count, EXCLUDED.order_count),
        last_order_at = COALESCE(EXCLUDED.last_order_at, customers.last_order_at),
        updated_at = EXCLUDED.updated_at`,
      [
        phone,
        raw.name || null,
        raw.last_address || null,
        raw.default_zone || null,
        asJson(raw.addresses || []),
        Number(raw.order_count) || 0,
        raw.last_order_at || null,
        raw.created_at || new Date().toISOString(),
        raw.updated_at || null,
      ],
    );
    cCount++;
  }
  console.log('Imported customers:', cCount);

  // Sessions
  const sessions = data.sessions || {};
  let sCount = 0;
  for (const [phone, sess] of Object.entries(sessions)) {
    await client.query(
      `INSERT INTO sessions (phone, data, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (phone) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      [phone, asJson(sess)],
    );
    sCount++;
  }
  console.log('Imported sessions:', sCount);

  // Orders
  let oCount = 0;
  for (const o of data.orders || []) {
    await client.query(
      `INSERT INTO orders (
        order_ref, phone, customer_name, meal, service_date, service_label,
        items, dish_code, dish_name, category, qty, unit_price_paise,
        food_paise, delivery_zone, delivery_fee_paise, total_paise,
        address, status, source, paid_at, delivered_at,
        feedback_requested_at, feedback_nudge_sent, feedback_nudge_at,
        meta, created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,
        $7::jsonb,$8,$9,$10,$11,$12,
        $13,$14,$15,$16,
        $17,$18,$19,$20,$21,
        $22,$23,$24,
        $25::jsonb,$26,$27
      )
      ON CONFLICT (order_ref) DO NOTHING`,
      [
        o.order_ref,
        o.phone,
        o.customer_name || null,
        o.meal,
        o.service_date || null,
        o.service_label || null,
        asJson(o.items || []),
        o.dish_code || null,
        o.dish_name || null,
        o.category || null,
        o.qty ?? null,
        o.unit_price_paise ?? null,
        o.food_paise ?? null,
        o.delivery_zone || null,
        o.delivery_fee_paise ?? 0,
        o.total_paise,
        o.address,
        o.status || 'pending_payment',
        o.source || 'whatsapp',
        o.paid_at || null,
        o.delivered_at || null,
        o.feedback_requested_at || null,
        Boolean(o.feedback_nudge_sent),
        o.feedback_nudge_at || null,
        asJson({}),
        o.created_at || new Date().toISOString(),
        o.updated_at || null,
      ],
    );
    oCount++;
  }
  console.log('Imported orders:', oCount);

  // Feedbacks
  let fCount = 0;
  for (const f of data.feedbacks || []) {
    const { id, order_ref, phone, average_rating, created_at, ...rest } = f;
    await client.query(
      `INSERT INTO feedbacks (order_ref, phone, average_rating, payload, created_at)
       VALUES ($1,$2,$3,$4::jsonb,$5)
       ON CONFLICT (order_ref) DO NOTHING`,
      [
        order_ref,
        phone || null,
        average_rating ?? null,
        asJson(rest),
        created_at || new Date().toISOString(),
      ],
    );
    fCount++;
  }
  console.log('Imported feedbacks:', fCount);

  // Help tickets
  let hCount = 0;
  for (const t of data.help_tickets || []) {
    const { id, phone, topic, message, order_ref, order_status, created_at, ...rest } = t;
    await client.query(
      `INSERT INTO help_tickets (phone, topic, message, order_ref, order_status, payload, created_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
      [
        phone,
        topic || null,
        message || null,
        order_ref || null,
        order_status || null,
        asJson(rest),
        created_at || new Date().toISOString(),
      ],
    );
    hCount++;
  }
  console.log('Imported help tickets:', hCount);

  await client.query('COMMIT');
  console.log('Import complete from', jsonPath);
} catch (err) {
  await client.query('ROLLBACK');
  console.error('Import failed:', err);
  process.exitCode = 1;
} finally {
  await client.end();
}
