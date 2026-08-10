import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MENU_DISHES, MENU_VERSION } from '../menu.js';
import {
  SEED_AMMAS,
  isPlaceholderCook,
  aggregateAmmaEarnings,
  weekBoundsIst,
} from '../ammas.js';
import { getOrderLines } from '../orders/cart.js';
import { maxSeqFromRefs, formatOrderRef, mealPrefix, serviceStamp } from '../orders/refs.js';
import {
  META_KEY_OFFERS,
  defaultOffers,
  normalizeOffersList,
  META_KEY_DELIVERY,
  defaultDeliverySettings,
  normalizeDeliverySettings,
  effectiveDeliverySettings,
} from '../offers.js';
import {
  META_KEY_OPS,
  defaultOpsSettings,
  normalizeOpsSettings,
  effectiveMinOrderPaise,
  setLaunchIsoCache,
} from '../ops-settings.js';

const KNOWN_ORDER_COLS = new Set([
  'id',
  'order_ref',
  'phone',
  'customer_name',
  'meal',
  'service_date',
  'service_label',
  'items',
  'dish_code',
  'dish_name',
  'category',
  'qty',
  'unit_price_paise',
  'food_paise',
  'delivery_zone',
  'delivery_fee_paise',
  'total_paise',
  'address',
  'status',
  'source',
  'paid_at',
  'delivered_at',
  'feedback_requested_at',
  'feedback_nudge_sent',
  'feedback_nudge_at',
  'meta',
  'created_at',
  'updated_at',
]);

function iso(v) {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function mapDish(row) {
  if (!row) return null;
  return {
    code: row.code,
    name: row.name,
    category: row.category,
    meal: row.meal,
    price_paise: Number(row.price_paise),
    cook_name: row.cook_name,
    amma_id: row.amma_id || null,
    max_portions: Number(row.max_portions),
    portions_sold: Number(row.portions_sold),
    active: Boolean(row.active),
    note: row.note || undefined,
    advance_only: Boolean(row.advance_only) || undefined,
  };
}

function mapAmma(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    phone: row.phone || null,
    active: row.active !== false && row.active !== 0,
    payout_share_bps: Number(row.payout_share_bps) || 7000,
    upi_id: row.upi_id || null,
    notes: row.notes || null,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

function mapOrder(row) {
  if (!row) return null;
  const meta = row.meta && typeof row.meta === 'object' ? row.meta : {};
  const out = {
    id: row.id,
    order_ref: row.order_ref,
    phone: row.phone,
    customer_name: row.customer_name,
    meal: row.meal,
    service_date: row.service_date
      ? String(row.service_date).slice(0, 10)
      : null,
    service_label: row.service_label,
    items: Array.isArray(row.items) ? row.items : row.items || [],
    dish_code: row.dish_code,
    dish_name: row.dish_name,
    category: row.category,
    qty: row.qty,
    unit_price_paise: row.unit_price_paise,
    food_paise: row.food_paise,
    delivery_zone: row.delivery_zone,
    delivery_fee_paise: row.delivery_fee_paise ?? 0,
    total_paise: row.total_paise,
    address: row.address,
    status: row.status,
    source: row.source,
    paid_at: iso(row.paid_at),
    delivered_at: iso(row.delivered_at),
    feedback_requested_at: iso(row.feedback_requested_at),
    feedback_nudge_sent: Boolean(row.feedback_nudge_sent),
    feedback_nudge_at: iso(row.feedback_nudge_at),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    ...meta,
  };
  return out;
}

function mapFeedback(row) {
  if (!row) return null;
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
  return {
    id: row.id,
    order_ref: row.order_ref,
    phone: row.phone,
    average_rating: row.average_rating != null ? Number(row.average_rating) : null,
    created_at: iso(row.created_at),
    ...payload,
  };
}

function mapTicket(row) {
  if (!row) return null;
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
  return {
    id: row.id,
    phone: row.phone,
    topic: row.topic,
    message: row.message,
    order_ref: row.order_ref,
    order_status: row.order_status,
    created_at: iso(row.created_at),
    ...payload,
  };
}

const DEFAULT_SESSION = {
  state: 'idle',
  meal: null,
  category: null,
  dish_code: null,
  qty: null,
  address: null,
  delivery_zone: null,
  cart: [],
};

/**
 * @param {string} databaseUrl
 */
export async function createPgStore(databaseUrl) {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
  });

  async function q(text, params = []) {
    const res = await pool.query(text, params);
    return res;
  }

  async function ensureAmmas() {
    // Table may not exist on old deploys until migrate; create-is-if-not from schema is preferred
    try {
      await q(`SELECT 1 FROM ammas LIMIT 1`);
    } catch {
      console.warn('[pg] ammas table missing — run npm run db:migrate');
      return;
    }
    for (const a of SEED_AMMAS) {
      await q(
        `INSERT INTO ammas (id, name, phone, active, payout_share_bps, upi_id, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO NOTHING`,
        [
          a.id,
          a.name,
          a.phone,
          a.active !== false,
          a.payout_share_bps ?? 7000,
          a.upi_id,
          a.notes || null,
        ],
      );
    }
  }

  async function backfillCookNamesFromSeed() {
    let n = 0;
    for (const d of MENU_DISHES) {
      if (!d.cook_name || isPlaceholderCook(d.cook_name)) continue;
      const res = await q(
        `UPDATE dishes
         SET cook_name = $2,
             amma_id = COALESCE(amma_id, $3)
         WHERE code = $1
           AND (
             cook_name IS NULL
             OR trim(cook_name) = ''
             OR lower(trim(cook_name)) = 'amma kitchen'
           )
         RETURNING code`,
        [d.code, d.cook_name, d.amma_id || null],
      );
      if (res.rowCount) n += 1;
    }
    if (n) console.log(`Backfilled Amma names on ${n} dish(es) [pg]`);
  }

  async function ensureMenu() {
    const count = await q(`SELECT COUNT(*)::int AS n FROM dishes`);
    const n = count.rows[0].n || 0;
    if (n === 0) {
      await q(`BEGIN`);
      try {
        for (const d of MENU_DISHES) {
          await q(
            `INSERT INTO dishes (
              code, name, category, meal, price_paise, cook_name, amma_id,
              max_portions, portions_sold, active, note, advance_only
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
            [
              d.code,
              d.name,
              d.category,
              d.meal,
              d.price_paise,
              d.cook_name || null,
              d.amma_id || null,
              d.max_portions ?? 20,
              0,
              d.active !== false,
              d.note || null,
              Boolean(d.advance_only),
            ],
          );
        }
        await q(
          `INSERT INTO meta (key, value) VALUES ('menu_version', $1)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
          [String(MENU_VERSION)],
        );
        await q(`COMMIT`);
      } catch (err) {
        await q(`ROLLBACK`);
        throw err;
      }
      console.log(`Menu seeded version ${MENU_VERSION} (${MENU_DISHES.length} dishes) [pg]`);
      return;
    }

    // Add any new seed codes without overwriting admin-edited rows
    const existing = await q(`SELECT code FROM dishes`);
    const have = new Set(existing.rows.map((r) => r.code));
    let added = 0;
    for (const d of MENU_DISHES) {
      if (have.has(d.code)) continue;
      await q(
        `INSERT INTO dishes (
          code, name, category, meal, price_paise, cook_name, amma_id,
          max_portions, portions_sold, active, note, advance_only
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10,$11)
        ON CONFLICT (code) DO NOTHING`,
        [
          d.code,
          d.name,
          d.category,
          d.meal,
          d.price_paise,
          d.cook_name || null,
          d.amma_id || null,
          d.max_portions ?? 20,
          d.active !== false,
          d.note || null,
          Boolean(d.advance_only),
        ],
      );
      added += 1;
    }
    await backfillCookNamesFromSeed();
    await q(
      `INSERT INTO meta (key, value) VALUES ('menu_version', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [String(MENU_VERSION)],
    );
    if (added) console.log(`Menu added ${added} new dish code(s) from seed [pg]`);
  }

  const api = {
    driver: 'pg',
    pool,
    async ready() {
      await ensureAmmas();
      await ensureMenu();
      try {
        await this.getOpsSettings();
      } catch {
        /* launch date stays default until first admin load */
      }
    },
    async getMeta(key) {
      const res = await q(`SELECT value FROM meta WHERE key = $1`, [String(key)]);
      return res.rows[0]?.value != null ? String(res.rows[0].value) : null;
    },
    async setMeta(key, value) {
      await q(
        `INSERT INTO meta (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [String(key), value == null ? '' : String(value)],
      );
    },
    async listOffers() {
      const raw = await this.getMeta(META_KEY_OFFERS);
      if (!raw) {
        const defaults = defaultOffers();
        await this.saveOffers(defaults);
        return defaults;
      }
      try {
        return normalizeOffersList(JSON.parse(raw));
      } catch {
        const defaults = defaultOffers();
        await this.saveOffers(defaults);
        return defaults;
      }
    },
    async saveOffers(offers) {
      const list = normalizeOffersList(offers);
      await this.setMeta(META_KEY_OFFERS, JSON.stringify(list));
      return list;
    },
    async getDeliverySettings() {
      const raw = await this.getMeta(META_KEY_DELIVERY);
      if (!raw) {
        const defaults = defaultDeliverySettings();
        await this.saveDeliverySettings(defaults);
        return defaults;
      }
      try {
        return normalizeDeliverySettings(JSON.parse(raw));
      } catch {
        const defaults = defaultDeliverySettings();
        await this.saveDeliverySettings(defaults);
        return defaults;
      }
    },
    async saveDeliverySettings(settings) {
      const next = normalizeDeliverySettings(settings);
      await this.setMeta(META_KEY_DELIVERY, JSON.stringify(next));
      return next;
    },
    async getEffectiveDeliverySettings(dayIso) {
      const s = await this.getDeliverySettings();
      return effectiveDeliverySettings(s, dayIso);
    },
    async getOpsSettings() {
      const raw = await this.getMeta(META_KEY_OPS);
      if (!raw) {
        const defaults = defaultOpsSettings();
        await this.saveOpsSettings(defaults);
        return defaults;
      }
      try {
        return normalizeOpsSettings(JSON.parse(raw));
      } catch {
        const defaults = defaultOpsSettings();
        await this.saveOpsSettings(defaults);
        return defaults;
      }
    },
    async saveOpsSettings(settings) {
      const next = normalizeOpsSettings(settings);
      setLaunchIsoCache(next.launch_iso);
      await this.setMeta(META_KEY_OPS, JSON.stringify(next));
      return next;
    },
    async getMinOrderPaise(dayIso) {
      const ops = await this.getOpsSettings();
      return effectiveMinOrderPaise(ops, dayIso);
    },
    async close() {
      await pool.end();
    },
    async listDishes(meal, category) {
      const clauses = ['active = TRUE'];
      const params = [];
      if (meal) {
        params.push(meal);
        clauses.push(`(meal = $${params.length} OR meal = 'both')`);
      }
      if (category) {
        params.push(category);
        clauses.push(`category = $${params.length}`);
      }
      const res = await q(
        `SELECT * FROM dishes WHERE ${clauses.join(' AND ')} ORDER BY code`,
        params,
      );
      return res.rows.map(mapDish);
    },
    async listAllDishes() {
      const res = await q(`SELECT * FROM dishes ORDER BY code`);
      return res.rows.map(mapDish);
    },
    async getDish(code) {
      const res = await q(`SELECT * FROM dishes WHERE code = $1`, [
        String(code || '').toUpperCase(),
      ]);
      return mapDish(res.rows[0]);
    },
    async setDishStock(code, maxPortions) {
      const res = await q(
        `UPDATE dishes SET max_portions = $2 WHERE code = $1 RETURNING *`,
        [String(code).toUpperCase(), Math.max(0, Number(maxPortions) || 0)],
      );
      return mapDish(res.rows[0]);
    },
    async setDishActive(code, active) {
      const res = await q(
        `UPDATE dishes SET active = $2 WHERE code = $1 RETURNING *`,
        [String(code).toUpperCase(), Boolean(active)],
      );
      return mapDish(res.rows[0]);
    },
    async upsertDish(input) {
      const code = String(input.code || '').trim().toUpperCase();
      if (!code) return null;
      const name = String(input.name || code).trim().slice(0, 80);
      const category = String(input.category || 'veg').trim();
      const meal = ['lunch', 'dinner', 'both'].includes(input.meal) ? input.meal : 'both';
      const price_paise = Math.max(0, Math.round(Number(input.price_paise) || 0));
      const cook_name = String(input.cook_name || 'Amma Kitchen').slice(0, 60);
      const amma_id = input.amma_id
        ? String(input.amma_id).trim().slice(0, 40)
        : null;
      const max_portions = Math.max(0, Number(input.max_portions) || 0);
      const active = input.active === undefined ? true : Boolean(input.active);
      const note = input.note != null ? String(input.note).slice(0, 120) : null;
      const advance_only = Boolean(input.advance_only);
      const res = await q(
        `INSERT INTO dishes (
           code, name, category, meal, price_paise, cook_name, amma_id,
           max_portions, portions_sold, active, note, advance_only
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10,$11)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           category = EXCLUDED.category,
           meal = EXCLUDED.meal,
           price_paise = EXCLUDED.price_paise,
           cook_name = EXCLUDED.cook_name,
           amma_id = EXCLUDED.amma_id,
           max_portions = EXCLUDED.max_portions,
           active = EXCLUDED.active,
           note = EXCLUDED.note,
           advance_only = EXCLUDED.advance_only
         RETURNING *`,
        [
          code,
          name,
          category,
          meal,
          price_paise,
          cook_name,
          amma_id,
          max_portions,
          active,
          note,
          advance_only,
        ],
      );
      return mapDish(res.rows[0]);
    },

    async listAmmas() {
      const res = await q(`SELECT * FROM ammas ORDER BY name`);
      return res.rows.map(mapAmma);
    },

    async getAmma(id) {
      const res = await q(`SELECT * FROM ammas WHERE id = $1`, [String(id || '')]);
      return mapAmma(res.rows[0]);
    },

    async upsertAmma(input) {
      let id = String(input.id || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
      if (!id) {
        id = String(input.name || 'amma')
          .toLowerCase()
          .replace(/\bamma\b/gi, '')
          .replace(/[^a-z0-9]+/g, '')
          .slice(0, 32) || `a${Date.now().toString(36)}`;
      }
      const name = String(input.name || '').trim().slice(0, 60);
      if (name.length < 2) return null;
      const phone = input.phone != null ? String(input.phone).replace(/\D/g, '').slice(0, 15) || null : null;
      const active = input.active === undefined ? true : Boolean(input.active);
      let share = Number(input.payout_share_bps);
      if (!Number.isFinite(share)) share = 7000;
      share = Math.min(10000, Math.max(0, Math.round(share)));
      const upi_id = input.upi_id != null ? String(input.upi_id).trim().slice(0, 80) || null : null;
      const notes = input.notes != null ? String(input.notes).trim().slice(0, 200) || null : null;
      const res = await q(
        `INSERT INTO ammas (id, name, phone, active, payout_share_bps, upi_id, notes, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           phone = EXCLUDED.phone,
           active = EXCLUDED.active,
           payout_share_bps = EXCLUDED.payout_share_bps,
           upi_id = EXCLUDED.upi_id,
           notes = EXCLUDED.notes,
           updated_at = NOW()
         RETURNING *`,
        [id, name, phone, active, share, upi_id, notes],
      );
      // Keep dish cook_name aligned when name changes
      await q(
        `UPDATE dishes SET cook_name = $2 WHERE amma_id = $1`,
        [id, name],
      );
      return mapAmma(res.rows[0]);
    },

    async listAmmasWithDishes() {
      const ammas = await this.listAmmas();
      const dishes = await this.listAllDishes();
      return ammas.map((a) => ({
        ...a,
        dishes: dishes.filter((d) => d.amma_id === a.id || d.cook_name === a.name),
        dish_count: dishes.filter((d) => d.amma_id === a.id || d.cook_name === a.name).length,
      }));
    },

    /**
     * Preview weekly earnings from paid+ kitchen statuses (food gross × share_bps).
     * @param {{ weekStart?: string, weekEnd?: string }} range
     */
    async previewAmmaEarnings(range = {}) {
      const bounds = weekBoundsIst();
      const weekStart = range.weekStart || bounds.weekStart;
      const weekEnd = range.weekEnd || bounds.weekEnd;
      const paidLike = ['paid', 'preparing', 'out_for_delivery', 'delivered'];
      const res = await q(
        `SELECT * FROM orders
         WHERE status = ANY($1::text[])
           AND COALESCE(service_date, (created_at AT TIME ZONE 'Asia/Kolkata')::date)
               BETWEEN $2::date AND $3::date
         ORDER BY id`,
        [paidLike, weekStart, weekEnd],
      );
      const lines = [];
      for (const row of res.rows) {
        const order = mapOrder(row);
        for (const line of getOrderLines(order)) {
          lines.push(line);
        }
      }
      const ammas = await this.listAmmas();
      const dishMap = new Map((await this.listAllDishes()).map((d) => [d.code, d]));
      const rows = aggregateAmmaEarnings(ammas, lines, dishMap);
      const totalShare = rows.reduce((s, r) => s + r.share_paise, 0);
      const totalGross = rows.reduce((s, r) => s + r.gross_food_paise, 0);
      return {
        week_start: weekStart,
        week_end: weekEnd,
        order_count: res.rows.length,
        total_gross_food_paise: totalGross,
        total_share_paise: totalShare,
        rows,
      };
    },
    async listCustomers(limit = 200) {
      const res = await q(
        `SELECT phone, name, order_count, last_order_at, last_address, created_at
         FROM customers
         ORDER BY COALESCE(last_order_at, created_at) DESC NULLS LAST
         LIMIT $1`,
        [Math.max(1, Number(limit) || 200)],
      );
      return res.rows.map((r) => ({
        phone: r.phone,
        name: r.name || null,
        order_count: Number(r.order_count) || 0,
        last_order_at: r.last_order_at || null,
        last_address: r.last_address || null,
        created_at: r.created_at || null,
      }));
    },
    async getSession(phone) {
      const p = String(phone || '');
      const res = await q(`SELECT data FROM sessions WHERE phone = $1`, [p]);
      if (!res.rows[0]) {
        const data = { phone: p, ...DEFAULT_SESSION };
        await q(
          `INSERT INTO sessions (phone, data, updated_at) VALUES ($1, $2::jsonb, NOW())
           ON CONFLICT (phone) DO NOTHING`,
          [p, JSON.stringify(data)],
        );
        return { ...data };
      }
      const data = res.rows[0].data || {};
      return { ...DEFAULT_SESSION, ...data, phone: p };
    },
    async setSession(phone, patch) {
      const p = String(phone || '');
      const cur = await this.getSession(p);
      const next = { ...cur, ...patch, phone: p };
      await q(
        `INSERT INTO sessions (phone, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (phone) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [p, JSON.stringify(next)],
      );
    },
    async getCustomer(phone) {
      const p = String(phone || '');
      const res = await q(`SELECT * FROM customers WHERE phone = $1`, [p]);
      if (!res.rows[0]) return null;
      const raw = res.rows[0];
      let addresses = Array.isArray(raw.addresses) ? raw.addresses : [];
      if (!addresses.length && raw.last_address) {
        addresses = [
          {
            id: 'a1',
            text: raw.last_address,
            zone: raw.default_zone || null,
            last_used_at: iso(raw.updated_at || raw.created_at),
          },
        ];
      }
      return {
        phone: p,
        name: raw.name || null,
        addresses,
        default_zone: raw.default_zone || null,
        order_count: Number(raw.order_count) || 0,
        last_order_at: iso(raw.last_order_at),
        created_at: iso(raw.created_at),
        updated_at: iso(raw.updated_at),
      };
    },
    async setCustomerName(phone, name) {
      const p = String(phone || '');
      const cleaned = String(name || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 40);
      if (cleaned.length < 2) return null;
      await q(
        `INSERT INTO customers (phone, name, addresses, created_at, updated_at)
         VALUES ($1, $2, '[]'::jsonb, NOW(), NOW())
         ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()`,
        [p, cleaned],
      );
      return this.getCustomer(p);
    },
    async saveCustomerAddress(phone, addr) {
      const p = String(phone || '');
      const text = String(addr?.text || '').trim();
      if (text.length < 8) return null;

      const cur = (await this.getCustomer(p)) || {
        phone: p,
        addresses: [],
        default_zone: null,
        name: null,
      };
      let addresses = Array.isArray(cur.addresses) ? [...cur.addresses] : [];
      const norm = text.toLowerCase();
      let hit = addresses.find((a) => String(a.text).trim().toLowerCase() === norm);
      const now = new Date().toISOString();
      if (hit) {
        hit.last_used_at = now;
        if (addr.zone) hit.zone = addr.zone;
      } else {
        if (addresses.length >= 5) {
          addresses.sort((a, b) =>
            String(a.last_used_at || '').localeCompare(String(b.last_used_at || '')),
          );
          addresses.shift();
        }
        hit = {
          id: `a${Date.now().toString(36)}`,
          text: text.slice(0, 200),
          zone: addr.zone || null,
          last_used_at: now,
        };
        addresses.push(hit);
      }
      const defaultZone = addr.zone || hit.zone || cur.default_zone || null;
      await q(
        `INSERT INTO customers (phone, name, last_address, default_zone, addresses, order_count, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW(), NOW())
         ON CONFLICT (phone) DO UPDATE SET
           last_address = EXCLUDED.last_address,
           default_zone = EXCLUDED.default_zone,
           addresses = EXCLUDED.addresses,
           updated_at = NOW()`,
        [
          p,
          cur.name || null,
          hit.text,
          defaultZone,
          JSON.stringify(addresses),
          cur.order_count || 0,
        ],
      );
      return this.getCustomer(p);
    },
    async upsertCustomer(phone, address) {
      return this.saveCustomerAddress(phone, { text: address });
    },
    async noteCustomerOrder(phone) {
      const p = String(phone || '');
      await q(
        `INSERT INTO customers (phone, order_count, last_order_at, addresses, created_at, updated_at)
         VALUES ($1, 1, NOW(), '[]'::jsonb, NOW(), NOW())
         ON CONFLICT (phone) DO UPDATE SET
           order_count = customers.order_count + 1,
           last_order_at = NOW(),
           updated_at = NOW()`,
        [p],
      );
    },
    async createOrder(order) {
      const items = Array.isArray(order.items) ? order.items : [];
      const meta =
        order.meta && typeof order.meta === 'object'
          ? order.meta
          : {
              ...(order.discount_paise != null ? { discount_paise: order.discount_paise } : {}),
              ...(order.offers_applied ? { offers_applied: order.offers_applied } : {}),
              ...(order.free_delivery != null ? { free_delivery: order.free_delivery } : {}),
            };
      const res = await q(
        `INSERT INTO orders (
          order_ref, phone, customer_name, meal, service_date, service_label,
          items, dish_code, dish_name, category, qty, unit_price_paise,
          food_paise, delivery_zone, delivery_fee_paise, total_paise,
          address, status, source, meta, created_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,
          $7::jsonb,$8,$9,$10,$11,$12,
          $13,$14,$15,$16,
          $17,$18,$19,$20::jsonb,NOW()
        ) RETURNING *`,
        [
          order.order_ref,
          order.phone,
          order.customer_name || null,
          order.meal,
          order.service_date || null,
          order.service_label || null,
          JSON.stringify(items),
          order.dish_code || null,
          order.dish_name || null,
          order.category || null,
          order.qty ?? null,
          order.unit_price_paise ?? null,
          order.food_paise ?? null,
          order.delivery_zone || null,
          order.delivery_fee_paise ?? 0,
          order.total_paise,
          order.address,
          order.status || 'pending_payment',
          order.source || 'whatsapp',
          JSON.stringify(meta),
        ],
      );
      return mapOrder(res.rows[0]);
    },
    async adjustStock(code, deltaQty) {
      if (!code || !deltaQty) return null;
      const res = await q(
        `UPDATE dishes
         SET portions_sold = GREATEST(0, portions_sold + $2)
         WHERE code = $1
         RETURNING *`,
        [String(code).toUpperCase(), Number(deltaQty)],
      );
      return mapDish(res.rows[0]);
    },
    async listOrders(limit = 50) {
      const res = await q(
        `SELECT * FROM orders ORDER BY id DESC LIMIT $1`,
        [Math.max(1, Number(limit) || 50)],
      );
      return res.rows.map(mapOrder);
    },
    async listOrdersForMeal(meal, statuses = ['paid', 'preparing', 'out_for_delivery']) {
      const res = await q(
        `SELECT * FROM orders
         WHERE meal = $1 AND status = ANY($2::text[])
         ORDER BY id DESC`,
        [meal, statuses],
      );
      return res.rows.map(mapOrder);
    },
    async findOrderByRef(orderRef) {
      const ref = String(orderRef || '').trim().toUpperCase();
      const res = await q(`SELECT * FROM orders WHERE UPPER(order_ref) = $1`, [ref]);
      return mapOrder(res.rows[0]);
    },
    async nextOrderRef(meal, serviceIso) {
      const m = meal === 'dinner' ? 'dinner' : 'lunch';
      const day = String(serviceIso || '').slice(0, 10);
      const prefix = mealPrefix(m);
      const stamp = serviceStamp(day);
      const like = `${prefix}${stamp}-%`;
      const res = await q(
        `SELECT order_ref FROM orders
         WHERE UPPER(order_ref) LIKE UPPER($1)
            OR (service_date = $2 AND meal = $3)`,
        [like, day, m],
      );
      const refs = res.rows.map((r) => r.order_ref);
      const seq = maxSeqFromRefs(refs, m, day) + 1;
      return formatOrderRef(m, day, seq);
    },
    async findLatestOrder(phone) {
      const res = await q(
        `SELECT * FROM orders WHERE phone = $1 ORDER BY id DESC LIMIT 1`,
        [phone],
      );
      return mapOrder(res.rows[0]);
    },
    async findLatestPendingOrder(phone) {
      const res = await q(
        `SELECT * FROM orders
         WHERE phone = $1 AND status = 'pending_payment'
         ORDER BY id DESC LIMIT 1`,
        [phone],
      );
      return mapOrder(res.rows[0]);
    },
    async findLatestDeliveredWithoutFeedback(phone) {
      const res = await q(
        `SELECT o.* FROM orders o
         LEFT JOIN feedbacks f ON UPPER(f.order_ref) = UPPER(o.order_ref)
         WHERE o.phone = $1 AND o.status = 'delivered' AND f.id IS NULL
         ORDER BY o.id DESC LIMIT 1`,
        [phone],
      );
      return mapOrder(res.rows[0]);
    },
    async updateOrderStatus(orderRef, status, extra = {}) {
      const ref = String(orderRef || '').trim().toUpperCase();
      const curRes = await q(`SELECT * FROM orders WHERE UPPER(order_ref) = $1`, [ref]);
      if (!curRes.rows[0]) return null;

      const known = {
        paid_at: extra.paid_at,
        delivered_at: extra.delivered_at,
        feedback_requested_at: extra.feedback_requested_at,
        feedback_nudge_sent: extra.feedback_nudge_sent,
        feedback_nudge_at: extra.feedback_nudge_at,
      };
      const metaExtra = {};
      for (const [k, v] of Object.entries(extra)) {
        if (k in known || KNOWN_ORDER_COLS.has(k)) {
          if (k === 'status') continue;
          if (k in known) continue;
        }
        if (!(k in known) && !['paid_at', 'delivered_at', 'feedback_requested_at', 'feedback_nudge_sent', 'feedback_nudge_at'].includes(k)) {
          metaExtra[k] = v;
        }
      }

      const prevMeta =
        curRes.rows[0].meta && typeof curRes.rows[0].meta === 'object' ? curRes.rows[0].meta : {};
      const meta = { ...prevMeta, ...metaExtra };

      const res = await q(
        `UPDATE orders SET
           status = $2,
           paid_at = COALESCE($3::timestamptz, paid_at),
           delivered_at = COALESCE($4::timestamptz, delivered_at),
           feedback_requested_at = COALESCE($5::timestamptz, feedback_requested_at),
           feedback_nudge_sent = COALESCE($6, feedback_nudge_sent),
           feedback_nudge_at = COALESCE($7::timestamptz, feedback_nudge_at),
           meta = $8::jsonb,
           updated_at = NOW()
         WHERE UPPER(order_ref) = $1
         RETURNING *`,
        [
          ref,
          status,
          known.paid_at || null,
          known.delivered_at || null,
          known.feedback_requested_at || null,
          known.feedback_nudge_sent === undefined ? null : Boolean(known.feedback_nudge_sent),
          known.feedback_nudge_at || null,
          JSON.stringify(meta),
        ],
      );
      return mapOrder(res.rows[0]);
    },
    async saveFeedback(entry) {
      const { order_ref, phone, average_rating, ...rest } = entry;
      const res = await q(
        `INSERT INTO feedbacks (order_ref, phone, average_rating, payload, created_at)
         VALUES ($1, $2, $3, $4::jsonb, NOW())
         ON CONFLICT (order_ref) DO UPDATE SET
           phone = EXCLUDED.phone,
           average_rating = EXCLUDED.average_rating,
           payload = EXCLUDED.payload
         RETURNING *`,
        [
          order_ref,
          phone || null,
          average_rating ?? null,
          JSON.stringify(rest),
        ],
      );
      return mapFeedback(res.rows[0]);
    },
    async getFeedbackByOrder(orderRef) {
      const ref = String(orderRef || '').toUpperCase();
      const res = await q(`SELECT * FROM feedbacks WHERE UPPER(order_ref) = $1`, [ref]);
      return mapFeedback(res.rows[0]);
    },
    async listFeedbacks(limit = 30) {
      const res = await q(
        `SELECT * FROM feedbacks ORDER BY id DESC LIMIT $1`,
        [Math.max(1, Number(limit) || 30)],
      );
      return res.rows.map(mapFeedback);
    },
    async saveHelpTicket(entry) {
      const { phone, topic, message, order_ref, order_status, ...rest } = entry;
      const res = await q(
        `INSERT INTO help_tickets (phone, topic, message, order_ref, order_status, payload, created_at)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,NOW())
         RETURNING *`,
        [
          phone,
          topic || null,
          message || null,
          order_ref || null,
          order_status || null,
          JSON.stringify(rest),
        ],
      );
      return mapTicket(res.rows[0]);
    },
    async listHelpTickets(limit = 30) {
      const res = await q(
        `SELECT * FROM help_tickets ORDER BY id DESC LIMIT $1`,
        [Math.max(1, Number(limit) || 30)],
      );
      return res.rows.map(mapTicket);
    },
    async logWaMessage(entry) {
      const phone = String(entry.phone || '').replace(/\D/g, '');
      if (!phone) return null;
      const direction = entry.direction === 'out' ? 'out' : 'in';
      const kind = String(entry.kind || 'text').slice(0, 40);
      const body = entry.body != null ? String(entry.body).slice(0, 4000) : '';
      const title = entry.title != null ? String(entry.title).slice(0, 200) : null;
      const waId = entry.wa_message_id ? String(entry.wa_message_id) : null;
      const profile = entry.profile_name ? String(entry.profile_name).slice(0, 80) : null;
      const meta = entry.meta && typeof entry.meta === 'object' ? entry.meta : {};
      try {
        if (waId) {
          const existing = await q(
            `SELECT * FROM wa_messages WHERE wa_message_id = $1 LIMIT 1`,
            [waId],
          );
          if (existing.rows[0]) return mapWaMessage(existing.rows[0]);
        }
        const res = await q(
          `INSERT INTO wa_messages (
            phone, direction, kind, body, title, wa_message_id, profile_name, meta
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
          RETURNING *`,
          [phone, direction, kind, body, title, waId, profile, JSON.stringify(meta)],
        );
        return mapWaMessage(res.rows[0]);
      } catch (err) {
        if (waId) {
          try {
            const existing = await q(
              `SELECT * FROM wa_messages WHERE wa_message_id = $1 LIMIT 1`,
              [waId],
            );
            if (existing.rows[0]) return mapWaMessage(existing.rows[0]);
          } catch {
            /* ignore */
          }
        }
        console.warn('[pg] logWaMessage failed (run npm run db:migrate if table missing):', err.message);
        return null;
      }
    },
    async listConversations(limit = 100) {
      const lim = Math.max(1, Math.min(500, Number(limit) || 100));
      try {
        const res = await q(
          `SELECT DISTINCT ON (m.phone)
             m.phone,
             m.created_at AS last_at,
             m.direction AS last_direction,
             m.body AS last_body,
             m.kind AS last_kind,
             m.profile_name,
             c.name AS customer_name,
             COALESCE(c.order_count, 0) AS order_count,
             (SELECT COUNT(*)::int FROM wa_messages x WHERE x.phone = m.phone) AS message_count
           FROM wa_messages m
           LEFT JOIN customers c ON c.phone = m.phone
           ORDER BY m.phone, m.created_at DESC`,
        );
        // DISTINCT ON needs order by phone first — then sort by last_at outside
        const rows = res.rows.map((r) => ({
          phone: r.phone,
          last_at: r.last_at,
          last_direction: r.last_direction,
          last_body: r.last_body || '',
          last_kind: r.last_kind,
          profile_name: r.profile_name || null,
          customer_name: r.customer_name || r.profile_name || null,
          order_count: Number(r.order_count) || 0,
          message_count: Number(r.message_count) || 0,
        }));
        rows.sort((a, b) => String(b.last_at || '').localeCompare(String(a.last_at || '')));
        return rows.slice(0, lim);
      } catch (err) {
        console.warn('[pg] listConversations', err.message);
        return [];
      }
    },
    async listMessagesForPhone(phone, limit = 200) {
      const p = String(phone || '').replace(/\D/g, '');
      const lim = Math.max(1, Math.min(500, Number(limit) || 200));
      try {
        const res = await q(
          `SELECT * FROM (
             SELECT * FROM wa_messages WHERE phone = $1 ORDER BY created_at DESC, id DESC LIMIT $2
           ) t ORDER BY created_at ASC, id ASC`,
          [p, lim],
        );
        return res.rows.map(mapWaMessage);
      } catch (err) {
        console.warn('[pg] listMessagesForPhone', err.message);
        return [];
      }
    },
  };

  return api;
}

function mapWaMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    phone: row.phone,
    direction: row.direction,
    kind: row.kind,
    body: row.body || '',
    title: row.title || null,
    wa_message_id: row.wa_message_id || null,
    profile_name: row.profile_name || null,
    meta: row.meta || {},
    created_at: iso(row.created_at),
  };
}

export function schemaFilePath() {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
  return path.join(root, 'sql', 'schema.pg.sql');
}

export function readSchemaSql() {
  return fs.readFileSync(schemaFilePath(), 'utf8');
}
