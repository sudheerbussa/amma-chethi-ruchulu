import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MENU_DISHES, MENU_VERSION, VEG_PACK_KG, sortDishesBySeed } from '../menu.js';
import {
  SEED_AMMAS,
  isPlaceholderCook,
  aggregateAmmaEarnings,
  weekBoundsIst,
} from '../ammas.js';
import { getOrderLines } from '../orders/cart.js';
import { maxSeqFromRefs, formatOrderRef, mealPrefix, serviceStamp } from '../orders/refs.js';
import { SLOT_OCCUPYING_STATUSES, nowIst } from '../cutoffs.js';
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
} from '../ops-settings.js';
import { locationsNear } from '../geo.js';
import {
  PRICE_BOARD_SEED_20260906,
  seedRowsToDbRows,
  enrichPriceBoardRow,
  costSourceForCategory,
  unitFromUom,
  uomLabelFromDish,
  suggestDishCode,
  normalizeItemKey,
} from '../price-board.js';

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

/** Calendar YYYY-MM-DD for PG DATE (node-pg Date ≠ String().slice(0,10)). */
function dateOnlyIso(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'string') {
    const m = v.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(v);
  }
  const m = String(v).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function mapDish(row) {
  if (!row) return null;
  const seed = MENU_DISHES.find((d) => d.code === row.code);
  const dish = {
    code: row.code,
    name: row.name,
    name_te: row.name_te || seed?.name_te || undefined,
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
  if (seed) {
    if (seed.unit) dish.unit = seed.unit;
    // Seed wins: pc/pack items must not keep stale kg pack sizes from older versions.
    if (Array.isArray(seed.sizes_kg) && seed.sizes_kg.length && seed.unit === 'kg')
      dish.sizes_kg = seed.sizes_kg;
    if (seed.emergency) dish.emergency = true;
  } else if (row.note) {
    // Board-created SKUs: recover unit from UOM note when not in menu.js seed.
    const n = String(row.note).toLowerCase();
    if (n.includes('bunch') || n.includes('pc') || n.includes('piece')) dish.unit = 'pc';
    else if (n.includes('pack')) dish.unit = 'pack';
    else if (/\bl\b|litre|liter/.test(n)) dish.unit = 'L';
    else dish.unit = 'kg';
  } else if (row.category === 'vegetables' || row.category === 'fruits') {
    dish.unit = 'kg';
  }
  // Admin-added kg produce: default 250 g / 500 g / 750 g / 1 kg packs (same as most veg).
  if (
    dish.unit === 'kg' &&
    (row.category === 'vegetables' || row.category === 'fruits') &&
    !(Array.isArray(dish.sizes_kg) && dish.sizes_kg.length)
  ) {
    dish.sizes_kg = [...VEG_PACK_KG];
  }
  return dish;
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
    service_date: dateOnlyIso(row.service_date),
    service_label: row.service_label,
    delivery_slot: row.delivery_slot || meta.delivery_slot || null,
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
  if (!out.delivery_slot) out.delivery_slot = row.delivery_slot || meta.delivery_slot || null;
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
              code, name, name_te, category, meal, price_paise, cook_name, amma_id,
              max_portions, portions_sold, active, note, advance_only
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
            [
              d.code,
              d.name,
              d.name_te || null,
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

    const verRes = await q(`SELECT value FROM meta WHERE key = 'menu_version'`);
    const prev = Number(verRes.rows[0]?.value || 0);
    const existing = await q(`SELECT code FROM dishes`);
    const have = new Set(existing.rows.map((r) => r.code));
    let added = 0;
    let updated = 0;

    for (const d of MENU_DISHES) {
      if (!have.has(d.code)) {
        await q(
          `INSERT INTO dishes (
            code, name, name_te, category, meal, price_paise, cook_name, amma_id,
            max_portions, portions_sold, active, note, advance_only
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10,$11,$12)
          ON CONFLICT (code) DO NOTHING`,
          [
            d.code,
            d.name,
            d.name_te || null,
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
        continue;
      }
      if (prev === MENU_VERSION) continue;
      // Version bump: refresh catalog fields. Keep live admin prices (do not overwrite price_paise).
      const res = await q(
        `UPDATE dishes SET
           name = $2,
           name_te = $3,
           category = $4,
           meal = $5,
           note = $6,
           active = $7,
           advance_only = $8
         WHERE code = $1`,
        [
          d.code,
          d.name,
          d.name_te || null,
          d.category,
          d.meal,
          d.note || null,
          d.active !== false,
          Boolean(d.advance_only),
        ],
      );
      if (res.rowCount) updated += 1;
    }

    // Remove Food leftovers (party/family packs, meals, veg/nonveg…) — never Fresh catalog.
    const seedCodes = new Set(MENU_DISHES.map((d) => d.code));
    let retired = 0;
    if (prev !== MENU_VERSION) {
      const FOOD_LEFTOVER_CATS = ['family', 'packs', 'meals', 'veg', 'nonveg', 'extras', 'biryani'];
      const del = await q(
        `DELETE FROM dishes
         WHERE (
           category = ANY($1::text[])
           OR code ~ '^[Ee][0-9]{2}$'
           OR name ILIKE '%party pack%'
           OR name ILIKE '%family pack%'
         )
           AND NOT (code = ANY($2::text[]))
         RETURNING code`,
        [FOOD_LEFTOVER_CATS, [...seedCodes]],
      );
      retired = del.rowCount || 0;
      // Any other non-seed rows: keep active (Pricing board may create SKUs not in menu.js seed).
      // Only soft-disable leftover Food categories already deleted above.
    }

    await backfillCookNamesFromSeed();
    await q(
      `INSERT INTO meta (key, value) VALUES ('menu_version', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [String(MENU_VERSION)],
    );
    if (added || updated || retired) {
      console.log(
        `Menu catalog v${MENU_VERSION}: added ${added}, updated ${updated}, removed/retired ${retired} leftover dish(es) [pg]`,
      );
    }
  }

  async function ensurePriceBoard() {
    await q(`
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
        cost_paise INTEGER,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (observed_on, item_key)
      )`);
    await q(`ALTER TABLE price_board ADD COLUMN IF NOT EXISTS cost_paise INTEGER`);
    await q(`CREATE INDEX IF NOT EXISTS idx_price_board_day ON price_board (observed_on)`);
    await q(`CREATE INDEX IF NOT EXISTS idx_price_board_dish ON price_board (dish_code)`);

    // Seed research sheet for 2026-09-06 once (idempotent upsert)
    const day = '2026-09-06';
    const existing = await q(`SELECT COUNT(*)::int AS n FROM price_board WHERE observed_on = $1::date`, [day]);
    if ((existing.rows[0]?.n || 0) > 0) return;
    const rows = seedRowsToDbRows(day, PRICE_BOARD_SEED_20260906);
    for (const r of rows) {
      await q(
        `INSERT INTO price_board (
           observed_on, item_key, item_name, category, uom, dish_code, sort_order,
           local_paise, blinkit_paise, instamart_paise, raithu_paise, suggested_acr_paise, updated_at
         ) VALUES ($1::date,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
         ON CONFLICT (observed_on, item_key) DO NOTHING`,
        [
          r.observed_on,
          r.item_key,
          r.item_name,
          r.category,
          r.uom,
          r.dish_code,
          r.sort_order,
          r.local_paise,
          r.blinkit_paise,
          r.instamart_paise,
          r.raithu_paise,
          r.suggested_acr_paise,
        ],
      );
    }
    console.log(`[pg] price_board seeded ${rows.length} rows for ${day}`);
  }

  function mapPriceBoardRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      observed_on: row.observed_on
        ? new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(row.observed_on instanceof Date ? row.observed_on : new Date(row.observed_on))
        : null,
      item_key: row.item_key,
      item_name: row.item_name,
      category: row.category,
      uom: row.uom || '1 Kg',
      dish_code: row.dish_code || null,
      sort_order: Number(row.sort_order) || 0,
      local_paise: row.local_paise != null ? Number(row.local_paise) : null,
      blinkit_paise: row.blinkit_paise != null ? Number(row.blinkit_paise) : null,
      instamart_paise: row.instamart_paise != null ? Number(row.instamart_paise) : null,
      raithu_paise: row.raithu_paise != null ? Number(row.raithu_paise) : null,
      suggested_acr_paise: row.suggested_acr_paise != null ? Number(row.suggested_acr_paise) : null,
      cost_paise: row.cost_paise != null ? Number(row.cost_paise) : null,
      updated_at: iso(row.updated_at),
    };
  }

  const api = {
    driver: 'pg',
    pool,
    async ready() {
      await ensureAmmas();
      await ensureMenu();
      await ensurePriceBoard();
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
        const parsed = JSON.parse(raw);
        const next = normalizeOpsSettings(parsed);
        if (
          parsed.lunch_cutoff_hour == null ||
          parsed.dinner_cutoff_hour == null ||
          parsed.launch_iso == null ||
          parsed.slot_capacity == null ||
          parsed.slot_open_hour == null ||
          parsed.slot_close_hour == null ||
          parsed.slot_lead_minutes == null
        ) {
          await this.setMeta(META_KEY_OPS, JSON.stringify(next));
        }
        return next;
      } catch {
        const defaults = defaultOpsSettings();
        await this.saveOpsSettings(defaults);
        return defaults;
      }
    },
    async saveOpsSettings(settings) {
      const next = normalizeOpsSettings(settings);
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
      return sortDishesBySeed(res.rows.map(mapDish));
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
      const name_te = input.name_te != null ? String(input.name_te).trim().slice(0, 80) || null : null;
      const category = String(input.category || 'veg').trim();
      const meal = ['lunch', 'dinner', 'both', 'fresh'].includes(input.meal) ? input.meal : 'both';
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
           code, name, name_te, category, meal, price_paise, cook_name, amma_id,
           max_portions, portions_sold, active, note, advance_only
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10,$11,$12)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           name_te = EXCLUDED.name_te,
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
          name_te,
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
      const dish = mapDish(res.rows[0]);
      try {
        await this.syncDishPriceToPriceBoard(code, price_paise);
      } catch (err) {
        console.warn('[pg] syncDishPriceToPriceBoard', err.message || err);
      }
      return dish;
    },

    /** Keep today's (or latest) price-board ACR Sell in sync with Menu / live dish price. */
    async syncDishPriceToPriceBoard(code, pricePaise) {
      const dishCode = String(code || '').trim().toUpperCase();
      const price = Math.max(0, Math.round(Number(pricePaise) || 0));
      if (!dishCode || price <= 0) return;
      const day = nowIst().isoDate;
      // Ensure the day has a full item list (auto-carry), then update linked sell.
      await this.listPriceBoard(day);
      await q(
        `UPDATE price_board
         SET suggested_acr_paise = $1, updated_at = NOW()
         WHERE observed_on = $2::date AND UPPER(COALESCE(dish_code, '')) = $3`,
        [price, day, dishCode],
      );
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
      const lat = addr?.lat != null ? Number(addr.lat) : null;
      const lng = addr?.lng != null ? Number(addr.lng) : null;
      const hasPin = Number.isFinite(lat) && Number.isFinite(lng);
      if (text.length < 8 && !hasPin) return null;

      const cur = (await this.getCustomer(p)) || {
        phone: p,
        addresses: [],
        default_zone: null,
        name: null,
      };
      let addresses = Array.isArray(cur.addresses) ? [...cur.addresses] : [];
      const norm = text.toLowerCase();
      let hit = null;
      if (hasPin) {
        hit = addresses.find(
          (a) =>
            a.lat != null &&
            a.lng != null &&
            locationsNear(Number(a.lat), Number(a.lng), lat, lng),
        );
      }
      if (!hit && text.length >= 8) {
        hit = addresses.find((a) => String(a.text).trim().toLowerCase() === norm);
      }
      const now = new Date().toISOString();
      if (hit) {
        hit.last_used_at = now;
        if (addr.zone) hit.zone = addr.zone;
        if (hasPin) {
          hit.lat = lat;
          hit.lng = lng;
          if (addr.location_name) hit.location_name = addr.location_name;
          if (text.length >= 8) hit.text = text.slice(0, 200);
        }
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
        if (hasPin) {
          hit.lat = lat;
          hit.lng = lng;
          if (addr.location_name) hit.location_name = String(addr.location_name).slice(0, 80);
        }
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
      const deliverySlot =
        order.delivery_slot || meta.delivery_slot || null;
      if (deliverySlot && !meta.delivery_slot) meta.delivery_slot = deliverySlot;
      const res = await q(
        `INSERT INTO orders (
          order_ref, phone, customer_name, meal, service_date, service_label,
          delivery_slot,
          items, dish_code, dish_name, category, qty, unit_price_paise,
          food_paise, delivery_zone, delivery_fee_paise, total_paise,
          address, status, source, meta, created_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,
          $7,
          $8::jsonb,$9,$10,$11,$12,$13,
          $14,$15,$16,$17,
          $18,$19,$20,$21::jsonb,NOW()
        ) RETURNING *`,
        [
          order.order_ref,
          order.phone,
          order.customer_name || null,
          order.meal,
          order.service_date || null,
          order.service_label || null,
          deliverySlot,
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
    /** Zero daily sold counters (max_portions kept). Used by IST day rollover. */
    async resetAllPortionsSold() {
      const res = await q(
        `UPDATE dishes SET portions_sold = 0 WHERE portions_sold <> 0`,
      );
      return res.rowCount || 0;
    },
    async listOrders(limit = 50) {
      const res = await q(
        `SELECT * FROM orders ORDER BY id DESC LIMIT $1`,
        [Math.max(1, Number(limit) || 50)],
      );
      return res.rows.map(mapOrder);
    },
    async listOrdersForServiceDate(isoDate, statuses = ['paid', 'preparing', 'out_for_delivery']) {
      const res = await q(
        `SELECT * FROM orders WHERE service_date = $1::date AND status = ANY($2::text[]) ORDER BY id`,
        [String(isoDate).slice(0, 10), statuses],
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
    async nextOrderRef(_meal, serviceIso) {
      const m = 'fresh';
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
    /**
     * Count occupying orders per hourly delivery slot id.
     * @returns {Record<string, number>}
     */
    async countOrdersByDeliverySlot(slotIds, statuses = SLOT_OCCUPYING_STATUSES) {
      const ids = (Array.isArray(slotIds) ? slotIds : []).map(String).filter(Boolean);
      const out = Object.fromEntries(ids.map((id) => [id, 0]));
      if (!ids.length) return out;
      const res = await q(
        `SELECT COALESCE(delivery_slot, meta->>'delivery_slot') AS slot_id,
                COUNT(*)::int AS n
         FROM orders
         WHERE status = ANY($1::text[])
           AND COALESCE(delivery_slot, meta->>'delivery_slot') = ANY($2::text[])
         GROUP BY 1`,
        [statuses || SLOT_OCCUPYING_STATUSES, ids],
      );
      for (const row of res.rows) {
        if (row.slot_id) out[String(row.slot_id)] = Number(row.n) || 0;
      }
      return out;
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
    /**
     * Persist short-supply / revised bill: rewrite items + money columns + merge meta.
     */
    async patchOrderRevision(orderRef, patch = {}) {
      const ref = String(orderRef || '').trim().toUpperCase();
      const curRes = await q(`SELECT * FROM orders WHERE UPPER(order_ref) = $1`, [ref]);
      if (!curRes.rows[0]) return null;
      const prev = curRes.rows[0];
      const prevMeta = prev.meta && typeof prev.meta === 'object' ? prev.meta : {};
      const metaIn = patch.meta && typeof patch.meta === 'object' ? patch.meta : {};
      const meta = { ...prevMeta, ...metaIn };

      const items = Array.isArray(patch.items) ? patch.items : prev.items;
      const res = await q(
        `UPDATE orders SET
           items = $2::jsonb,
           dish_code = $3,
           dish_name = $4,
           category = $5,
           qty = $6,
           unit_price_paise = $7,
           food_paise = $8,
           delivery_fee_paise = $9,
           total_paise = $10,
           meta = $11::jsonb,
           updated_at = NOW()
         WHERE UPPER(order_ref) = $1
         RETURNING *`,
        [
          ref,
          JSON.stringify(items),
          patch.dish_code != null ? patch.dish_code : prev.dish_code,
          patch.dish_name != null ? patch.dish_name : prev.dish_name,
          patch.category != null ? patch.category : prev.category,
          patch.qty != null ? patch.qty : prev.qty,
          patch.unit_price_paise != null ? patch.unit_price_paise : prev.unit_price_paise,
          patch.food_paise != null ? patch.food_paise : prev.food_paise,
          patch.delivery_fee_paise != null ? patch.delivery_fee_paise : prev.delivery_fee_paise,
          patch.total_paise != null ? patch.total_paise : prev.total_paise,
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
      const payload = {
        ticket_status: rest.ticket_status || 'open',
        ...rest,
      };
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
          JSON.stringify(payload),
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
    async updateHelpTicket(id, patch = {}) {
      const cur = await q(`SELECT * FROM help_tickets WHERE id = $1`, [Number(id)]);
      if (!cur.rows[0]) return null;
      const prev =
        cur.rows[0].payload && typeof cur.rows[0].payload === 'object' ? cur.rows[0].payload : {};
      const payload = {
        ...prev,
        ...patch,
        updated_at: new Date().toISOString(),
      };
      const res = await q(
        `UPDATE help_tickets SET payload = $2::jsonb WHERE id = $1 RETURNING *`,
        [Number(id), JSON.stringify(payload)],
      );
      return mapTicket(res.rows[0]);
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
          if (existing.rows[0]) {
            return { ...mapWaMessage(existing.rows[0]), _duplicate: true };
          }
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
            if (existing.rows[0]) {
            return { ...mapWaMessage(existing.rows[0]), _duplicate: true };
          }
          } catch {
            /* ignore */
          }
        }
        console.warn('[pg] logWaMessage failed (run npm run db:migrate if table missing):', err.message);
        return null;
      }
    },
    async listConversations(limit = 100) {
      const lim = Math.max(1, Math.min(5000, Number(limit) || 100));
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
          last_at: iso(r.last_at),
          last_direction: r.last_direction,
          last_body: r.last_body || '',
          last_kind: r.last_kind,
          profile_name: r.profile_name || null,
          customer_name: r.customer_name || r.profile_name || null,
          order_count: Number(r.order_count) || 0,
          message_count: Number(r.message_count) || 0,
        }));
        rows.sort((a, b) => {
          const tb = Date.parse(b.last_at || '') || 0;
          const ta = Date.parse(a.last_at || '') || 0;
          return tb - ta;
        });
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
    async getLastInboundAt(phone) {
      const p = String(phone || '').replace(/\D/g, '');
      if (!p) return null;
      try {
        const res = await q(
          `SELECT created_at FROM wa_messages
           WHERE phone = $1 AND direction = 'in'
           ORDER BY created_at DESC LIMIT 1`,
          [p],
        );
        return res.rows[0] ? iso(res.rows[0].created_at) : null;
      } catch (err) {
        console.warn('[pg] getLastInboundAt', err.message);
        return null;
      }
    },

    async listRiders({ activeOnly = false } = {}) {
      try {
        const res = await q(
          activeOnly
            ? `SELECT id, name, phone, active, notes, created_at, updated_at FROM riders WHERE active = TRUE ORDER BY name`
            : `SELECT id, name, phone, active, notes, created_at, updated_at FROM riders ORDER BY active DESC, name`,
        );
        return res.rows.map((r) => ({
          id: r.id,
          name: r.name,
          phone: r.phone,
          active: r.active !== false,
          notes: r.notes || null,
          created_at: iso(r.created_at),
          updated_at: iso(r.updated_at),
        }));
      } catch (err) {
        console.warn('[pg] listRiders — run db:migrate?', err.message);
        return [];
      }
    },

    async findRiderById(id) {
      try {
        const res = await q(`SELECT * FROM riders WHERE id = $1`, [String(id || '')]);
        const r = res.rows[0];
        if (!r) return null;
        return {
          id: r.id,
          name: r.name,
          phone: r.phone,
          pin_hash: r.pin_hash,
          active: r.active !== false,
          notes: r.notes || null,
          created_at: iso(r.created_at),
          updated_at: iso(r.updated_at),
        };
      } catch (err) {
        console.warn('[pg] findRiderById', err.message);
        return null;
      }
    },

    async findRiderByPhone(phone) {
      const p = String(phone || '').replace(/\D/g, '');
      if (p.length < 10) return null;
      try {
        const res = await q(
          `SELECT * FROM riders WHERE regexp_replace(phone, '\\D', '', 'g') = $1
             OR phone LIKE '%' || $1 OR $1 LIKE '%' || regexp_replace(phone, '\\D', '', 'g')
           LIMIT 1`,
          [p],
        );
        let r = res.rows[0];
        if (!r) {
          const all = await q(`SELECT * FROM riders`);
          r = all.rows.find((row) => {
            const rp = String(row.phone || '').replace(/\D/g, '');
            return rp === p || rp.endsWith(p) || p.endsWith(rp);
          });
        }
        if (!r) return null;
        return {
          id: r.id,
          name: r.name,
          phone: r.phone,
          pin_hash: r.pin_hash,
          active: r.active !== false,
          notes: r.notes || null,
        };
      } catch (err) {
        console.warn('[pg] findRiderByPhone', err.message);
        return null;
      }
    },

    async upsertRider(rider) {
      const id = String(rider.id || '').trim();
      const name = String(rider.name || '').trim();
      const phone = String(rider.phone || '').replace(/\D/g, '');
      if (!id || !name || phone.length < 10) throw new Error('Rider id, name, phone required');
      const active = rider.active !== false;
      const notes = rider.notes != null ? String(rider.notes) : null;
      if (rider.pin_hash) {
        await q(
          `INSERT INTO riders (id, name, phone, pin_hash, active, notes, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             phone = EXCLUDED.phone,
             pin_hash = EXCLUDED.pin_hash,
             active = EXCLUDED.active,
             notes = EXCLUDED.notes,
             updated_at = NOW()`,
          [id, name, phone, rider.pin_hash, active, notes],
        );
      } else {
        await q(
          `INSERT INTO riders (id, name, phone, pin_hash, active, notes, created_at, updated_at)
           VALUES ($1,$2,$3,'', $4,$5,NOW(),NOW())
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             phone = EXCLUDED.phone,
             active = EXCLUDED.active,
             notes = EXCLUDED.notes,
             updated_at = NOW()`,
          [id, name, phone, active, notes],
        );
      }
      return this.findRiderById(id);
    },

    async listOrdersForRider(riderId, { statuses = null, limit = 80 } = {}) {
      const rid = String(riderId || '');
      if (!rid) return [];
      const lim = Math.min(Math.max(Number(limit) || 80, 1), 200);
      try {
        let sql = `SELECT * FROM orders WHERE meta->>'rider_id' = $1`;
        const params = [rid];
        if (Array.isArray(statuses) && statuses.length) {
          sql += ` AND status = ANY($2::text[])`;
          params.push(statuses);
          sql += ` ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT $3`;
          params.push(lim);
        } else {
          sql += ` ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT $2`;
          params.push(lim);
        }
        const res = await q(sql, params);
        return res.rows.map(mapOrder);
      } catch (err) {
        console.warn('[pg] listOrdersForRider', err.message);
        return [];
      }
    },

    async listPriceBoard(observedOn) {
      const day = String(observedOn || nowIst().isoDate).slice(0, 10);
      let res = await q(
        `SELECT * FROM price_board WHERE observed_on = $1::date
         ORDER BY category ASC, sort_order ASC, item_name ASC`,
        [day],
      );

      // Always show the full item list: carry forward previous day, or seed + live menu prices.
      if (res.rows.length === 0) {
        const prev = await q(
          `SELECT observed_on::text AS d FROM price_board
           WHERE observed_on < $1::date
           ORDER BY observed_on DESC LIMIT 1`,
          [day],
        );
        const fromDay = prev.rows[0]?.d ? String(prev.rows[0].d).slice(0, 10) : null;
        if (fromDay) {
          await this.copyPriceBoardDay(fromDay, day);
        } else {
          await this.materializePriceBoardFromSeed(day);
        }
        res = await q(
          `SELECT * FROM price_board WHERE observed_on = $1::date
           ORDER BY category ASC, sort_order ASC, item_name ASC`,
          [day],
        );
      }

      // Menu dishes missing from board (e.g. Gongura) — append so admin Pricing always shows them.
      await this.ensurePriceBoardHasMenuDishes(day, res.rows);
      res = await q(
        `SELECT * FROM price_board WHERE observed_on = $1::date
         ORDER BY category ASC, sort_order ASC, item_name ASC`,
        [day],
      );

      const dishes = await this.listAllDishes();
      const byCode = new Map((dishes || []).map((d) => [String(d.code).toUpperCase(), d]));
      const rows = res.rows.map((r) => enrichPriceBoardRow(mapPriceBoardRow(r), byCode));
      return {
        observed_on: day,
        cost_rules: {
          vegetables: costSourceForCategory('vegetables'),
          fruits: costSourceForCategory('fruits'),
        },
        rows,
        carried_forward: Boolean(res.rows.length),
      };
    },

    /**
     * Insert board rows for veg/fruit menu dishes that have no linked price-board line yet.
     */
    async ensurePriceBoardHasMenuDishes(observedOn, existingRows = null) {
      const day = String(observedOn || nowIst().isoDate).slice(0, 10);
      let rows = existingRows;
      if (!rows) {
        const res = await q(
          `SELECT * FROM price_board WHERE observed_on = $1::date`,
          [day],
        );
        rows = res.rows;
      }
      const linked = new Set(
        (rows || [])
          .map((r) => String(r.dish_code || '').toUpperCase())
          .filter(Boolean),
      );
      const usedKeys = new Set((rows || []).map((r) => String(r.item_key || '').toLowerCase()));
      const dishes = await this.listAllDishes();
      const missing = (dishes || []).filter(
        (d) =>
          d &&
          !d.emergency &&
          (d.category === 'vegetables' || d.category === 'fruits') &&
          !linked.has(String(d.code).toUpperCase()),
      );
      if (!missing.length) return 0;

      let maxSort = 0;
      for (const r of rows || []) {
        const s = Math.round(Number(r.sort_order) || 0);
        if (s > maxSort) maxSort = s;
      }

      const toAdd = [];
      for (const d of missing) {
        let key = normalizeItemKey(d.code);
        if (!key || usedKeys.has(key)) {
          key = normalizeItemKey(`${d.code}_${d.name}`);
        }
        if (!key || usedKeys.has(key)) {
          key = normalizeItemKey(`${d.code}_${Date.now().toString(36)}`);
        }
        usedKeys.add(key);
        const unit = String(d.unit || 'kg').toLowerCase();
        const uom = uomLabelFromDish(d) || (unit === 'pc' || unit === 'pack'
          ? unit === 'pack'
            ? '1 Pack'
            : '1 Pc'
          : '1 Kg');
        maxSort += 1;
        toAdd.push({
          item_key: key,
          item_name: d.name || d.code,
          category: d.category === 'fruits' ? 'fruits' : 'vegetables',
          uom,
          dish_code: d.code,
          sort_order: maxSort,
          suggested_acr_paise: Math.round(Number(d.price_paise) || 0) || null,
          local_paise: null,
          blinkit_paise: null,
          instamart_paise: null,
          raithu_paise: null,
          cost_paise: null,
        });
      }
      if (!toAdd.length) return 0;
      await this.upsertPriceBoardRows(day, toAdd);
      return toAdd.length;
    },

    /** First-time / empty history: full seed roster, ACR Sell from live menu when linked. */
    async materializePriceBoardFromSeed(observedOn) {
      const day = String(observedOn || nowIst().isoDate).slice(0, 10);
      const dishes = await this.listAllDishes();
      const byCode = new Map((dishes || []).map((d) => [String(d.code).toUpperCase(), d]));
      const rows = seedRowsToDbRows(day, PRICE_BOARD_SEED_20260906).map((r) => {
        const dish = r.dish_code ? byCode.get(String(r.dish_code).toUpperCase()) : null;
        const live = dish ? Math.round(Number(dish.price_paise) || 0) : 0;
        return {
          ...r,
          suggested_acr_paise:
            live > 0 ? live : r.suggested_acr_paise != null ? r.suggested_acr_paise : null,
        };
      });
      return this.upsertPriceBoardRows(day, rows);
    },

    async upsertPriceBoardRows(observedOn, rows) {
      const day = String(observedOn || nowIst().isoDate).slice(0, 10);
      const list = Array.isArray(rows) ? rows : [];
      let n = 0;
      for (const raw of list) {
        const item_key = String(raw.item_key || '')
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_]+/g, '_')
          .slice(0, 40);
        if (!item_key) continue;
        const category = raw.category === 'fruits' ? 'fruits' : 'vegetables';
        const item_name = String(raw.item_name || item_key).trim().slice(0, 80) || item_key;
        const uom = String(raw.uom || '1 Kg').trim().slice(0, 24) || '1 Kg';
        const dish_code = raw.dish_code
          ? String(raw.dish_code).trim().toUpperCase().slice(0, 12)
          : null;
        const sort_order = Math.max(0, Math.round(Number(raw.sort_order) || 0));
        const num = (v) => {
          if (v == null || v === '') return null;
          const n = Math.round(Number(v));
          return Number.isFinite(n) ? n : null;
        };
        await q(
          `INSERT INTO price_board (
             observed_on, item_key, item_name, category, uom, dish_code, sort_order,
             local_paise, blinkit_paise, instamart_paise, raithu_paise, suggested_acr_paise,
             cost_paise, updated_at
           ) VALUES ($1::date,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
           ON CONFLICT (observed_on, item_key) DO UPDATE SET
             item_name = EXCLUDED.item_name,
             category = EXCLUDED.category,
             uom = EXCLUDED.uom,
             dish_code = EXCLUDED.dish_code,
             sort_order = EXCLUDED.sort_order,
             local_paise = EXCLUDED.local_paise,
             blinkit_paise = EXCLUDED.blinkit_paise,
             instamart_paise = EXCLUDED.instamart_paise,
             raithu_paise = EXCLUDED.raithu_paise,
             suggested_acr_paise = EXCLUDED.suggested_acr_paise,
             cost_paise = EXCLUDED.cost_paise,
             updated_at = NOW()`,
          [
            day,
            item_key,
            item_name,
            category,
            uom,
            dish_code,
            sort_order,
            num(raw.local_paise),
            num(raw.blinkit_paise),
            num(raw.instamart_paise),
            num(raw.raithu_paise),
            num(raw.suggested_acr_paise),
            num(raw.cost_paise),
          ],
        );
        n += 1;
      }
      return this.listPriceBoard(day);
    },

    async copyPriceBoardDay(fromDay, toDay) {
      const from = String(fromDay || '').slice(0, 10);
      const to = String(toDay || nowIst().isoDate).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        throw new Error('Invalid dates');
      }
      await q(
        `INSERT INTO price_board (
           observed_on, item_key, item_name, category, uom, dish_code, sort_order,
           local_paise, blinkit_paise, instamart_paise, raithu_paise, suggested_acr_paise,
           cost_paise, updated_at
         )
         SELECT $2::date, item_key, item_name, category, uom, dish_code, sort_order,
                local_paise, blinkit_paise, instamart_paise, raithu_paise, suggested_acr_paise,
                cost_paise, NOW()
         FROM price_board WHERE observed_on = $1::date
         ON CONFLICT (observed_on, item_key) DO UPDATE SET
           item_name = EXCLUDED.item_name,
           category = EXCLUDED.category,
           uom = EXCLUDED.uom,
           dish_code = EXCLUDED.dish_code,
           sort_order = EXCLUDED.sort_order,
           local_paise = EXCLUDED.local_paise,
           blinkit_paise = EXCLUDED.blinkit_paise,
           instamart_paise = EXCLUDED.instamart_paise,
           raithu_paise = EXCLUDED.raithu_paise,
           suggested_acr_paise = EXCLUDED.suggested_acr_paise,
           cost_paise = EXCLUDED.cost_paise,
           updated_at = NOW()`,
        [from, to],
      );
      return this.listPriceBoard(to);
    },

    async applySuggestedAcrPrices(observedOn, { onlyLinked = true } = {}) {
      // Pricing board is catalog SOT — ensure every row is a live Menu/WA dish, then apply sell.
      const synced = await this.syncCatalogFromPriceBoard(observedOn, {
        deactivateMissing: true,
        applyPrices: true,
      });
      return {
        updated: synced.updated_prices,
        created: synced.created,
        linked: synced.linked,
        deactivated: synced.deactivated,
        board: synced.board,
      };
    },

    /**
     * Pricing tab → Menu + WhatsApp catalog.
     * Assigns dish_code when missing, upserts produce dishes, optionally applies ACR Sell,
     * and soft-disables veg/fruit dishes not on this day's board.
     */
    async syncCatalogFromPriceBoard(observedOn, { deactivateMissing = true, applyPrices = true } = {}) {
      const day = String(observedOn || nowIst().isoDate).slice(0, 10);
      let data = await this.listPriceBoard(day);
      const dishes = await this.listAllDishes();
      const usedCodes = new Set((dishes || []).map((d) => String(d.code).toUpperCase()));
      const created = [];
      const linked = [];
      const updated_prices = [];
      const boardPatch = [];

      for (const row of data.rows || []) {
        let code = row.dish_code ? String(row.dish_code).toUpperCase().slice(0, 8) : '';
        if (!code) {
          code = suggestDishCode(row.item_key, row.item_name, usedCodes);
          usedCodes.add(code);
          boardPatch.push({
            ...row,
            dish_code: code,
          });
          linked.push({ item_key: row.item_key, dish_code: code });
        } else {
          usedCodes.add(code);
        }

        const existing = await this.getDish(code);
        const sell = Number(row.suggested_acr_paise);
        const price_paise =
          applyPrices && Number.isFinite(sell) && sell > 0
            ? Math.round(sell)
            : existing
              ? Number(existing.price_paise) || 0
              : Number.isFinite(sell) && sell > 0
                ? Math.round(sell)
                : 0;
        const unit = unitFromUom(row.uom);
        const category = row.category === 'fruits' ? 'fruits' : 'vegetables';
        const dish = await this.upsertDish({
          ...(existing || {}),
          code,
          name: String(row.item_name || code).slice(0, 80),
          category,
          meal: 'both',
          price_paise: Math.max(0, price_paise),
          unit,
          // Preserve Menu On/Off — do not force active on Pricing sync.
          active: existing ? existing.active !== false : true,
          note:
            existing?.note ||
            (unit === 'pc' ? String(row.uom || '1 pc') : String(row.uom || unit || '1 Kg')),
          cook_name: existing?.cook_name || 'Amma Kitchen',
          amma_id: existing?.amma_id || null,
        });
        if (!existing) created.push({ code, item_key: row.item_key });
        if (applyPrices && Number.isFinite(sell) && sell > 0) {
          updated_prices.push({
            code,
            price_paise: dish.price_paise,
            item_key: row.item_key,
          });
        }
      }

      if (boardPatch.length) {
        // Persist auto-assigned dish codes on the board
        const byKey = new Map((data.rows || []).map((r) => [r.item_key, r]));
        for (const p of boardPatch) byKey.set(p.item_key, { ...byKey.get(p.item_key), ...p });
        data = await this.upsertPriceBoardRows(day, Array.from(byKey.values()));
      }

      const deactivated = [];
      if (deactivateMissing) {
        const keep = new Set(
          (data.rows || [])
            .map((r) => String(r.dish_code || '').toUpperCase())
            .filter(Boolean),
        );
        for (const d of dishes || []) {
          const cat = String(d.category || '');
          if (cat !== 'vegetables' && cat !== 'fruits') continue;
          const code = String(d.code || '').toUpperCase();
          if (!code || keep.has(code)) continue;
          if (d.active === false) continue;
          await this.upsertDish({ ...d, active: false });
          deactivated.push(code);
        }
      }

      return {
        observed_on: day,
        created,
        linked,
        updated_prices,
        deactivated,
        board: await this.listPriceBoard(day),
      };
    },

    /** Add one Pricing-board item (and Menu/WA dish). */
    async addPriceBoardItem(observedOn, input = {}) {
      const day = String(observedOn || nowIst().isoDate).slice(0, 10);
      const item_name = String(input.item_name || input.name || '').trim().slice(0, 80);
      if (item_name.length < 2) throw new Error('Item name required');
      const category = input.category === 'fruits' ? 'fruits' : 'vegetables';
      const unitRaw = String(input.unit || '').trim().toLowerCase();
      const sellAsPc = unitRaw === 'pc' || unitRaw === 'piece' || unitRaw === 'per_pc';
      const uom = sellAsPc
        ? '1 Pc'
        : String(input.uom || '1 Kg').trim().slice(0, 24) || '1 Kg';
      let item_key = normalizeItemKey(input.item_key || item_name);
      if (!item_key) item_key = normalizeItemKey(`item_${Date.now()}`);

      const data = await this.listPriceBoard(day);
      const existingKeys = new Set((data.rows || []).map((r) => r.item_key));
      if (existingKeys.has(item_key)) {
        let i = 2;
        while (existingKeys.has(`${item_key}_${i}`) && i < 100) i += 1;
        item_key = `${item_key}_${i}`.slice(0, 40);
      }

      const usedCodes = new Set(
        (await this.listAllDishes()).map((d) => String(d.code).toUpperCase()),
      );
      for (const r of data.rows || []) {
        if (r.dish_code) usedCodes.add(String(r.dish_code).toUpperCase());
      }
      let dish_code = input.dish_code
        ? String(input.dish_code).trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
        : '';
      if (!dish_code || usedCodes.has(dish_code)) {
        dish_code = suggestDishCode(item_key, item_name, usedCodes);
      }

      const sellRupees = input.sell_rupees != null ? Number(input.sell_rupees) : Number(input.price_rupees);
      const suggested_acr_paise =
        input.suggested_acr_paise != null
          ? Math.round(Number(input.suggested_acr_paise))
          : Number.isFinite(sellRupees)
            ? Math.round(sellRupees * 100)
            : null;
      const sort_order =
        Math.max(0, ...((data.rows || []).map((r) => Number(r.sort_order) || 0)), 0) + 1;

      const row = {
        item_key,
        item_name,
        category,
        uom,
        dish_code,
        sort_order,
        local_paise: null,
        blinkit_paise: null,
        instamart_paise: null,
        raithu_paise: null,
        cost_paise: null,
        suggested_acr_paise:
          Number.isFinite(suggested_acr_paise) && suggested_acr_paise > 0
            ? suggested_acr_paise
            : null,
      };
      await this.upsertPriceBoardRows(day, [...(data.rows || []), row]);
      // Push into Menu / WA immediately
      const synced = await this.syncCatalogFromPriceBoard(day, {
        deactivateMissing: false,
        applyPrices: true,
      });
      return {
        row,
        ...synced,
      };
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
