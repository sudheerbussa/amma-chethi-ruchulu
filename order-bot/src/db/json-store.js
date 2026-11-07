import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { MENU_DISHES, MENU_VERSION, resolveDishCode, sortDishesBySeed } from '../menu.js';
import {
  SEED_AMMAS,
  isPlaceholderCook,
  aggregateAmmaEarnings,
  weekBoundsIst,
  ammaSlugFromName,
} from '../ammas.js';
import { getOrderLines } from '../orders/cart.js';
import { maxSeqFromRefs, formatOrderRef, mealPrefix, serviceStamp } from '../orders/refs.js';
import { projectRoot } from '../paths.js';
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

function dbFilePath() {
  const p = config.databasePath.replace(/\.db$/i, '.json');
  return path.isAbsolute(p) ? p : path.join(projectRoot, p);
}

function emptyStore() {
  return {
    menu_version: 0,
    meta: {},
    ammas: [],
    dishes: [],
    customers: {},
    sessions: {},
    orders: [],
    feedbacks: [],
    help_tickets: [],
    messages: [],
    cashbook_entries: [],
    nextOrderId: 1,
    nextFeedbackId: 1,
    nextHelpId: 1,
    nextMessageId: 1,
    nextCashbookId: 1,
  };
}

function istDayFromIso(isoStr) {
  if (!isoStr) return null;
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(isoStr));
  } catch {
    return String(isoStr).slice(0, 10);
  }
}

/** JSON file backend (local / fallback). All methods async for shared DB API. */
export function createJsonStore() {
  let store = null;

  function load() {
    if (store) return store;
    const file = dbFilePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file)) {
      store = JSON.parse(fs.readFileSync(file, 'utf8'));
    } else {
      store = emptyStore();
    }
    return store;
  }

  function save() {
    const file = dbFilePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(store, null, 2));
  }

  async function ensureAmmas() {
    const s = load();
    if (!Array.isArray(s.ammas)) s.ammas = [];
    const have = new Set(s.ammas.map((a) => a.id));
    let added = 0;
    for (const a of SEED_AMMAS) {
      if (have.has(a.id)) continue;
      s.ammas.push({
        ...a,
        created_at: new Date().toISOString(),
      });
      added += 1;
    }
    if (added) {
      save();
      console.log(`Seeded ${added} Amma profile(s)`);
    }
  }

  function backfillCookNamesFromSeed() {
    const s = load();
    let n = 0;
    for (const dish of s.dishes) {
      if (!isPlaceholderCook(dish.cook_name) && dish.cook_name) continue;
      const seed = MENU_DISHES.find((d) => d.code === dish.code);
      if (!seed?.cook_name || isPlaceholderCook(seed.cook_name)) continue;
      dish.cook_name = seed.cook_name;
      dish.amma_id = dish.amma_id || seed.amma_id || null;
      n += 1;
    }
    if (n) {
      save();
      console.log(`Backfilled Amma names on ${n} dish(es)`);
    }
  }

  async function ensureMenu() {
    const s = load();
    if (!Array.isArray(s.dishes)) s.dishes = [];
    if (!s.dishes.length) {
      s.dishes = MENU_DISHES.map((d) => ({ ...d, portions_sold: 0 }));
      s.menu_version = MENU_VERSION;
      save();
      console.log(`Menu seeded version ${MENU_VERSION} (${s.dishes.length} dishes)`);
      return;
    }
    const prev = Number(s.menu_version || 0);
    const byCode = new Map(s.dishes.map((d) => [d.code, d]));
    let added = 0;
    let updated = 0;
    for (const d of MENU_DISHES) {
      const existing = byCode.get(d.code);
      if (!existing) {
        s.dishes.push({ ...d, portions_sold: 0 });
        added += 1;
        continue;
      }
      if (prev === MENU_VERSION) continue;
      existing.name = d.name;
      existing.category = d.category;
      existing.meal = d.meal;
      existing.price_paise = d.price_paise;
      existing.note = d.note || null;
      existing.active = d.active !== false;
      existing.advance_only = Boolean(d.advance_only);
      updated += 1;
    }
    backfillCookNamesFromSeed();
    let purged = 0;
    if (prev !== MENU_VERSION) {
      const keep = new Set(MENU_DISHES.map((d) => d.code));
      const before = s.dishes.length;
      s.dishes = s.dishes.filter((d) => keep.has(d.code));
      purged = before - s.dishes.length;
    }
    if (added || updated || purged || s.menu_version !== MENU_VERSION) {
      s.menu_version = MENU_VERSION;
      save();
      if (added || updated || purged) {
        console.log(
          `Menu catalog v${MENU_VERSION}: added ${added}, updated ${updated}, purged ${purged} dish(es)`,
        );
      }
    }
  }

  return {
    driver: 'json',
    filePath: dbFilePath(),
    async ready() {
      await ensureAmmas();
      await ensureMenu();
      const s = load();
      if (!s.meta || typeof s.meta !== 'object') s.meta = {};
      try {
        await this.getOpsSettings();
      } catch {
        /* ignore */
      }
    },
    async getMeta(key) {
      const s = load();
      if (!s.meta || typeof s.meta !== 'object') s.meta = {};
      const v = s.meta[String(key)];
      return v == null ? null : String(v);
    },
    async setMeta(key, value) {
      const s = load();
      if (!s.meta || typeof s.meta !== 'object') s.meta = {};
      s.meta[String(key)] = value == null ? '' : String(value);
      save();
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
        // Persist new fields (cutoffs) if this meta predates them
        if (
          parsed.lunch_cutoff_hour == null ||
          parsed.dinner_cutoff_hour == null ||
          parsed.launch_iso == null
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
    async listDishes(meal, category) {
      const s = load();
      return sortDishesBySeed(
        s.dishes.filter((d) => {
          if (!d.active) return false;
          if (meal && d.meal !== meal && d.meal !== 'both') return false;
          if (category && d.category !== category) return false;
          return true;
        }),
      );
    },
    async listAllDishes() {
      return load().dishes.slice();
    },
    async getDish(code) {
      const resolved = resolveDishCode(code);
      return load().dishes.find((d) => d.code === resolved) || null;
    },
    async setDishStock(code, maxPortions) {
      const s = load();
      const dish = s.dishes.find((d) => d.code === String(code).toUpperCase());
      if (!dish) return null;
      dish.max_portions = Math.max(0, Number(maxPortions) || 0);
      save();
      return { ...dish };
    },
    async setDishActive(code, active) {
      const s = load();
      const dish = s.dishes.find((d) => d.code === String(code).toUpperCase());
      if (!dish) return null;
      dish.active = Boolean(active);
      save();
      return { ...dish };
    },
    async upsertDish(input) {
      const s = load();
      const code = String(input.code || '').trim().toUpperCase();
      if (!code) return null;
      const idx = s.dishes.findIndex((d) => d.code === code);
      const base = idx >= 0 ? s.dishes[idx] : {
        code,
        portions_sold: 0,
        cook_name: 'Amma Kitchen',
        amma_id: null,
        active: true,
        advance_only: false,
      };
      const next = {
        ...base,
        code,
        name: String(input.name || base.name || code).trim().slice(0, 80),
        category: String(input.category || base.category || 'veg').trim(),
        meal: ['lunch', 'dinner', 'both'].includes(input.meal) ? input.meal : (base.meal || 'both'),
        price_paise: Math.max(0, Math.round(Number(input.price_paise ?? base.price_paise) || 0)),
        cook_name: String(input.cook_name || base.cook_name || 'Amma Kitchen').slice(0, 60),
        amma_id: input.amma_id != null
          ? String(input.amma_id || '').trim().slice(0, 40) || null
          : (base.amma_id || null),
        max_portions: Math.max(0, Number(input.max_portions ?? base.max_portions) || 0),
        active: input.active === undefined ? base.active !== false : Boolean(input.active),
        note: input.note != null ? String(input.note).slice(0, 120) : (base.note || null),
        advance_only: input.advance_only === undefined ? Boolean(base.advance_only) : Boolean(input.advance_only),
      };
      if (idx >= 0) s.dishes[idx] = next;
      else s.dishes.push(next);
      save();
      return { ...next };
    },
    async listAmmas() {
      const s = load();
      return (s.ammas || []).map((a) => ({ ...a })).sort((x, y) => String(x.name).localeCompare(String(y.name)));
    },
    async getAmma(id) {
      return (await this.listAmmas()).find((a) => a.id === String(id || '')) || null;
    },
    async upsertAmma(input) {
      const s = load();
      if (!Array.isArray(s.ammas)) s.ammas = [];
      let id = String(input.id || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
      if (!id) id = ammaSlugFromName(input.name);
      const name = String(input.name || '').trim().slice(0, 60);
      if (name.length < 2) return null;
      const idx = s.ammas.findIndex((a) => a.id === id);
      const base = idx >= 0 ? s.ammas[idx] : { id, created_at: new Date().toISOString() };
      let share = Number(input.payout_share_bps);
      if (!Number.isFinite(share)) share = base.payout_share_bps ?? 7000;
      share = Math.min(10000, Math.max(0, Math.round(share)));
      const next = {
        ...base,
        id,
        name,
        phone: input.phone != null ? String(input.phone).replace(/\D/g, '').slice(0, 15) || null : (base.phone || null),
        active: input.active === undefined ? base.active !== false : Boolean(input.active),
        payout_share_bps: share,
        upi_id: input.upi_id != null ? String(input.upi_id).trim().slice(0, 80) || null : (base.upi_id || null),
        notes: input.notes != null ? String(input.notes).trim().slice(0, 200) || null : (base.notes || null),
        updated_at: new Date().toISOString(),
      };
      if (idx >= 0) s.ammas[idx] = next;
      else s.ammas.push(next);
      for (const d of s.dishes) {
        if (d.amma_id === id) d.cook_name = name;
      }
      save();
      return { ...next };
    },
    async listAmmasWithDishes() {
      const ammas = await this.listAmmas();
      const dishes = await this.listAllDishes();
      return ammas.map((a) => {
        const list = dishes.filter((d) => d.amma_id === a.id || d.cook_name === a.name);
        return { ...a, dishes: list, dish_count: list.length };
      });
    },
    async previewAmmaEarnings(range = {}) {
      const bounds = weekBoundsIst();
      const weekStart = range.weekStart || bounds.weekStart;
      const weekEnd = range.weekEnd || bounds.weekEnd;
      const paidLike = new Set(['paid', 'preparing', 'out_for_delivery', 'delivered']);
      const s = load();
      const orders = (s.orders || []).filter((o) => {
        if (!paidLike.has(o.status)) return false;
        const day = (o.service_date || String(o.created_at || '').slice(0, 10) || '').slice(0, 10);
        return day >= weekStart && day <= weekEnd;
      });
      const lines = [];
      for (const o of orders) {
        for (const line of getOrderLines(o)) lines.push(line);
      }
      const ammas = await this.listAmmas();
      const dishMap = new Map((await this.listAllDishes()).map((d) => [d.code, d]));
      const rows = aggregateAmmaEarnings(ammas, lines, dishMap);
      return {
        week_start: weekStart,
        week_end: weekEnd,
        order_count: orders.length,
        total_gross_food_paise: rows.reduce((x, r) => x + r.gross_food_paise, 0),
        total_share_paise: rows.reduce((x, r) => x + r.share_paise, 0),
        rows,
      };
    },
    async listCustomers(limit = 200) {
      const s = load();
      const rows = Object.values(s.customers || {})
        .map((c) => ({
          phone: c.phone,
          name: c.name || null,
          order_count: Number(c.order_count) || 0,
          last_order_at: c.last_order_at || null,
          last_address: c.last_address || null,
          created_at: c.created_at || null,
        }))
        .sort((a, b) => String(b.last_order_at || b.created_at || '').localeCompare(String(a.last_order_at || a.created_at || '')))
        .slice(0, Math.max(1, Number(limit) || 200));
      return rows;
    },
    async getSession(phone) {
      const s = load();
      if (!s.sessions[phone]) {
        s.sessions[phone] = {
          phone,
          state: 'idle',
          meal: null,
          category: null,
          dish_code: null,
          qty: null,
          address: null,
          delivery_zone: null,
          cart: [],
        };
        save();
      }
      return { ...s.sessions[phone] };
    },
    async setSession(phone, patch) {
      const s = load();
      const cur = s.sessions[phone] || {
        phone,
        state: 'idle',
        meal: null,
        category: null,
        dish_code: null,
        qty: null,
        address: null,
        delivery_zone: null,
        cart: [],
      };
      s.sessions[phone] = { ...cur, ...patch };
      save();
    },
    async getCustomer(phone) {
      const s = load();
      const p = String(phone || '');
      const raw = s.customers[p];
      if (!raw) return null;
      let addresses = Array.isArray(raw.addresses) ? raw.addresses.map((a) => ({ ...a })) : [];
      if (!addresses.length && raw.last_address) {
        addresses = [
          {
            id: 'a1',
            text: raw.last_address,
            zone: raw.default_zone || null,
            last_used_at: raw.updated_at || raw.created_at || null,
          },
        ];
      }
      return {
        phone: p,
        name: raw.name || null,
        addresses,
        default_zone: raw.default_zone || null,
        order_count: Number(raw.order_count) || 0,
        last_order_at: raw.last_order_at || null,
        created_at: raw.created_at || null,
        updated_at: raw.updated_at || null,
      };
    },
    async setCustomerName(phone, name) {
      const s = load();
      const p = String(phone || '');
      const cur = s.customers[p] || { phone: p, created_at: new Date().toISOString() };
      const cleaned = String(name || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 40);
      if (cleaned.length < 2) return null;
      s.customers[p] = {
        ...cur,
        phone: p,
        name: cleaned,
        addresses: Array.isArray(cur.addresses) ? cur.addresses : [],
        updated_at: new Date().toISOString(),
      };
      save();
      return this.getCustomer(p);
    },
    async saveCustomerAddress(phone, addr) {
      const s = load();
      const p = String(phone || '');
      const text = String(addr?.text || '').trim();
      const lat = addr?.lat != null ? Number(addr.lat) : null;
      const lng = addr?.lng != null ? Number(addr.lng) : null;
      const hasPin = Number.isFinite(lat) && Number.isFinite(lng);
      if (text.length < 8 && !hasPin) return null;
      const cur = s.customers[p] || { phone: p, created_at: new Date().toISOString() };
      let addresses = Array.isArray(cur.addresses) ? [...cur.addresses] : [];
      if (!addresses.length && cur.last_address) {
        addresses = [{ id: 'a1', text: cur.last_address, zone: cur.default_zone || null }];
      }
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
      s.customers[p] = {
        ...cur,
        phone: p,
        last_address: hit.text,
        default_zone: addr.zone || hit.zone || cur.default_zone || null,
        addresses,
        updated_at: now,
      };
      save();
      return this.getCustomer(p);
    },
    async upsertCustomer(phone, address) {
      return this.saveCustomerAddress(phone, { text: address });
    },
    async noteCustomerOrder(phone) {
      const s = load();
      const p = String(phone || '');
      const cur = s.customers[p] || { phone: p, created_at: new Date().toISOString() };
      s.customers[p] = {
        ...cur,
        phone: p,
        order_count: (Number(cur.order_count) || 0) + 1,
        last_order_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      save();
    },
    async customerHasPaidOrder(phone) {
      const p = String(phone || '');
      if (!p) return false;
      const paidLike = new Set(['paid', 'preparing', 'out_for_delivery', 'delivered']);
      return (load().orders || []).some((o) => o.phone === p && paidLike.has(o.status));
    },
    async createOrder(order) {
      const s = load();
      if (!Array.isArray(s.feedbacks)) s.feedbacks = [];
      const meta =
        order.meta && typeof order.meta === 'object'
          ? { ...order.meta }
          : {
              ...(order.discount_paise != null ? { discount_paise: order.discount_paise } : {}),
              ...(order.offers_applied ? { offers_applied: order.offers_applied } : {}),
              ...(order.free_delivery != null ? { free_delivery: order.free_delivery } : {}),
            };
      const deliverySlot = order.delivery_slot || meta.delivery_slot || null;
      if (deliverySlot && !meta.delivery_slot) meta.delivery_slot = deliverySlot;
      const row = {
        id: s.nextOrderId++,
        ...order,
        delivery_slot: deliverySlot,
        discount_paise: order.discount_paise ?? meta.discount_paise ?? 0,
        offers_applied: order.offers_applied || meta.offers_applied || [],
        free_delivery: order.free_delivery ?? meta.free_delivery ?? false,
        meta,
        created_at: new Date().toISOString(),
      };
      s.orders.push(row);
      save();
      return row;
    },
    async countOrdersByDeliverySlot(slotIds, statuses = ['pending_payment', 'paid', 'preparing', 'out_for_delivery']) {
      const ids = (Array.isArray(slotIds) ? slotIds : []).map(String).filter(Boolean);
      const out = Object.fromEntries(ids.map((id) => [id, 0]));
      if (!ids.length) return out;
      const idSet = new Set(ids);
      const statusSet = new Set(statuses);
      for (const o of load().orders || []) {
        if (!statusSet.has(o.status)) continue;
        const sid = String(o.delivery_slot || o.meta?.delivery_slot || '');
        if (sid && idSet.has(sid)) out[sid] = (out[sid] || 0) + 1;
      }
      return out;
    },
    async adjustStock(code, deltaQty) {
      if (!code || !deltaQty) return null;
      const s = load();
      const dish = s.dishes.find((d) => d.code === String(code).toUpperCase());
      if (!dish) return null;
      dish.portions_sold = Math.max(0, (dish.portions_sold || 0) + Number(deltaQty));
      save();
      return { ...dish };
    },
    /** Zero daily sold counters (max_portions kept). Used by IST day rollover. */
    async resetAllPortionsSold() {
      const s = load();
      for (const d of s.dishes || []) {
        d.portions_sold = 0;
      }
      save();
      return (s.dishes || []).length;
    },
    async listOrders(limit = 50) {
      return load().orders.slice().reverse().slice(0, limit);
    },
    async listOrdersForMeal(meal, statuses = ['paid', 'preparing', 'out_for_delivery']) {
      return load()
        .orders
        .filter((o) => o.meal === meal && statuses.includes(o.status))
        .slice()
        .reverse();
    },
    async findOrderByRef(orderRef) {
      const ref = String(orderRef || '').trim().toUpperCase();
      return load().orders.find((o) => String(o.order_ref).toUpperCase() === ref) || null;
    },
    /**
     * Next daily sequence for meal on service day (IST YYYY-MM-DD).
     * Counts refs matching L|D + YYMMDD + seq for that meal/day.
     */
    async nextOrderRef(meal, serviceIso) {
      const m = meal === 'dinner' ? 'dinner' : 'lunch';
      const day = String(serviceIso || '').slice(0, 10);
      const prefix = mealPrefix(m);
      const stamp = serviceStamp(day);
      const needle = `${prefix}${stamp}-`.toUpperCase();
      const refs = load()
        .orders.filter(
          (o) =>
            String(o.order_ref || '').toUpperCase().startsWith(needle) ||
            (o.service_date === day && o.meal === m),
        )
        .map((o) => o.order_ref);
      const seq = maxSeqFromRefs(refs, m, day) + 1;
      return formatOrderRef(m, day, seq);
    },
    async findLatestOrder(phone) {
      const rows = load().orders.filter((o) => o.phone === phone);
      return rows.length ? rows[rows.length - 1] : null;
    },
    async findLatestPendingOrder(phone) {
      const rows = load().orders.filter(
        (o) => o.phone === phone && o.status === 'pending_payment',
      );
      return rows.length ? rows[rows.length - 1] : null;
    },
    async findLatestDeliveredWithoutFeedback(phone) {
      const s = load();
      if (!Array.isArray(s.feedbacks)) s.feedbacks = [];
      const rated = new Set(s.feedbacks.map((f) => String(f.order_ref).toUpperCase()));
      const rows = s.orders.filter(
        (o) =>
          o.phone === phone &&
          o.status === 'delivered' &&
          !rated.has(String(o.order_ref).toUpperCase()),
      );
      return rows.length ? rows[rows.length - 1] : null;
    },
    async updateOrderStatus(orderRef, status, extra = {}) {
      const s = load();
      const ref = String(orderRef || '').trim().toUpperCase();
      const order = s.orders.find((o) => String(o.order_ref).toUpperCase() === ref);
      if (!order) return null;
      order.status = status;
      Object.assign(order, extra);
      order.updated_at = new Date().toISOString();
      save();
      return { ...order };
    },
    async saveFeedback(entry) {
      const s = load();
      if (!Array.isArray(s.feedbacks)) s.feedbacks = [];
      if (!s.nextFeedbackId) s.nextFeedbackId = 1;
      const row = {
        id: s.nextFeedbackId++,
        ...entry,
        created_at: new Date().toISOString(),
      };
      s.feedbacks.push(row);
      save();
      return row;
    },
    async getFeedbackByOrder(orderRef) {
      const s = load();
      if (!Array.isArray(s.feedbacks)) return null;
      const ref = String(orderRef || '').toUpperCase();
      return s.feedbacks.find((f) => String(f.order_ref).toUpperCase() === ref) || null;
    },
    async listFeedbacks(limit = 30) {
      const s = load();
      if (!Array.isArray(s.feedbacks)) return [];
      return s.feedbacks.slice().reverse().slice(0, limit);
    },
    async saveHelpTicket(entry) {
      const s = load();
      if (!Array.isArray(s.help_tickets)) s.help_tickets = [];
      if (!s.nextHelpId) s.nextHelpId = 1;
      const row = {
        id: s.nextHelpId++,
        ticket_status: entry.ticket_status || 'open',
        ...entry,
        created_at: new Date().toISOString(),
      };
      s.help_tickets.push(row);
      save();
      return row;
    },
    async listHelpTickets(limit = 30) {
      const s = load();
      if (!Array.isArray(s.help_tickets)) return [];
      return s.help_tickets.slice().reverse().slice(0, limit);
    },
    async updateHelpTicket(id, patch = {}) {
      const s = load();
      if (!Array.isArray(s.help_tickets)) return null;
      const row = s.help_tickets.find((t) => Number(t.id) === Number(id));
      if (!row) return null;
      Object.assign(row, patch, { updated_at: new Date().toISOString() });
      save();
      return { ...row };
    },
    async logWaMessage(entry) {
      const s = load();
      if (!Array.isArray(s.messages)) s.messages = [];
      if (!s.nextMessageId) s.nextMessageId = 1;
      const phone = String(entry.phone || '').replace(/\D/g, '');
      if (!phone) return null;
      const waId = entry.wa_message_id ? String(entry.wa_message_id) : null;
      if (waId && s.messages.some((m) => m.wa_message_id === waId)) {
        const hit = s.messages.find((m) => m.wa_message_id === waId);
        return { ...hit, _duplicate: true };
      }
      const row = {
        id: s.nextMessageId++,
        phone,
        direction: entry.direction === 'out' ? 'out' : 'in',
        kind: String(entry.kind || 'text').slice(0, 40),
        body: entry.body != null ? String(entry.body).slice(0, 4000) : '',
        title: entry.title != null ? String(entry.title).slice(0, 200) : null,
        wa_message_id: waId,
        profile_name: entry.profile_name ? String(entry.profile_name).slice(0, 80) : null,
        meta: entry.meta && typeof entry.meta === 'object' ? entry.meta : {},
        created_at: entry.created_at || new Date().toISOString(),
      };
      s.messages.push(row);
      if (s.messages.length > 25000) s.messages = s.messages.slice(-20000);
      save();
      return { ...row };
    },
    async listConversations(limit = 100) {
      const s = load();
      const msgs = Array.isArray(s.messages) ? s.messages : [];
      const byPhone = new Map();
      for (const m of msgs) {
        const p = m.phone;
        if (!p) continue;
        const prev = byPhone.get(p);
        if (!prev || String(m.created_at) > String(prev.last_at)) {
          byPhone.set(p, {
            phone: p,
            last_at: m.created_at,
            last_direction: m.direction,
            last_body: m.body || '',
            last_kind: m.kind,
            message_count: (prev?.message_count || 0) + 1,
            profile_name: m.profile_name || prev?.profile_name || null,
          });
        } else if (prev) {
          prev.message_count += 1;
          if (!prev.profile_name && m.profile_name) prev.profile_name = m.profile_name;
        }
      }
      const customers = s.customers || {};
      const rows = [...byPhone.values()].map((c) => {
        const cust = customers[c.phone];
        return {
          ...c,
          customer_name: cust?.name || c.profile_name || null,
          order_count: Number(cust?.order_count) || 0,
        };
      });
      rows.sort((a, b) => {
        const tb = Date.parse(b.last_at || '') || 0;
        const ta = Date.parse(a.last_at || '') || 0;
        return tb - ta;
      });
      return rows.slice(0, Math.max(1, Number(limit) || 100));
    },
    async listMessagesForPhone(phone, limit = 200) {
      const p = String(phone || '').replace(/\D/g, '');
      const s = load();
      const msgs = (Array.isArray(s.messages) ? s.messages : [])
        .filter((m) => m.phone === p)
        .slice()
        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || a.id - b.id);
      const lim = Math.max(1, Math.min(500, Number(limit) || 200));
      return msgs.slice(-lim);
    },
    async getLastInboundAt(phone) {
      const p = String(phone || '').replace(/\D/g, '');
      if (!p) return null;
      const s = load();
      let best = null;
      for (const m of Array.isArray(s.messages) ? s.messages : []) {
        if (m.phone !== p || m.direction !== 'in') continue;
        if (!best || String(m.created_at) > String(best)) best = m.created_at;
      }
      return best;
    },

    async listRiders({ activeOnly = false } = {}) {
      const s = load();
      let rows = Array.isArray(s.riders) ? s.riders.slice() : [];
      if (activeOnly) rows = rows.filter((r) => r.active !== false);
      rows.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        active: r.active !== false,
        notes: r.notes || null,
        created_at: r.created_at || null,
        updated_at: r.updated_at || null,
      }));
    },

    async findRiderById(id) {
      const s = load();
      const r = (s.riders || []).find((x) => x.id === String(id || ''));
      return r ? { ...r } : null;
    },

    async findRiderByPhone(phone) {
      const p = String(phone || '').replace(/\D/g, '');
      if (p.length < 10) return null;
      const s = load();
      const r = (s.riders || []).find((row) => {
        const rp = String(row.phone || '').replace(/\D/g, '');
        return rp === p || rp.endsWith(p) || p.endsWith(rp);
      });
      return r ? { ...r } : null;
    },

    async upsertRider(rider) {
      const s = load();
      if (!Array.isArray(s.riders)) s.riders = [];
      const id = String(rider.id || '').trim();
      const name = String(rider.name || '').trim();
      const phone = String(rider.phone || '').replace(/\D/g, '');
      if (!id || !name || phone.length < 10) throw new Error('Rider id, name, phone required');
      const idx = s.riders.findIndex((x) => x.id === id);
      const prev = idx >= 0 ? s.riders[idx] : {};
      const next = {
        ...prev,
        id,
        name,
        phone,
        pin_hash: rider.pin_hash != null ? rider.pin_hash : prev.pin_hash || '',
        active: rider.active !== false,
        notes: rider.notes != null ? rider.notes : prev.notes || null,
        created_at: prev.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (idx >= 0) s.riders[idx] = next;
      else s.riders.push(next);
      save();
      return { ...next };
    },

    async listOrdersForRider(riderId, { statuses = null, limit = 80 } = {}) {
      const rid = String(riderId || '');
      const s = load();
      let rows = (s.orders || []).filter((o) => o.rider_id === rid || o.meta?.rider_id === rid);
      if (Array.isArray(statuses) && statuses.length) {
        const set = new Set(statuses);
        rows = rows.filter((o) => set.has(o.status));
      }
      rows.sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')));
      return rows.slice(0, Math.min(Math.max(Number(limit) || 80, 1), 200)).map((o) => ({ ...o }));
    },

    async insertCashbookEntry(entry) {
      const s = load();
      if (!Array.isArray(s.cashbook_entries)) s.cashbook_entries = [];
      if (!s.nextCashbookId) s.nextCashbookId = 1;
      const row = {
        id: s.nextCashbookId++,
        entry_date: String(entry.entry_date).slice(0, 10),
        kind: entry.kind,
        amount_paise: Math.round(Number(entry.amount_paise) || 0),
        note: entry.note || null,
        order_ref: entry.order_ref || null,
        created_by: entry.created_by || 'admin',
        created_at: new Date().toISOString(),
      };
      s.cashbook_entries.push(row);
      save();
      return { ...row };
    },

    async listCashbookEntries(entryDate) {
      const day = String(entryDate || '').slice(0, 10);
      const s = load();
      return (s.cashbook_entries || [])
        .filter((e) => String(e.entry_date).slice(0, 10) === day)
        .slice()
        .reverse()
        .map((e) => ({ ...e }));
    },

    async listCashbookEntriesRange(fromDate, toDate) {
      const from = String(fromDate || '').slice(0, 10);
      const to = String(toDate || from).slice(0, 10);
      const s = load();
      return (s.cashbook_entries || [])
        .filter((e) => {
          const d = String(e.entry_date).slice(0, 10);
          return d >= from && d <= to;
        })
        .slice()
        .sort((a, b) => {
          const da = String(b.entry_date).localeCompare(String(a.entry_date));
          if (da) return da;
          return (b.id || 0) - (a.id || 0);
        })
        .map((e) => ({ ...e }));
    },

    async deleteCashbookEntry(id) {
      const s = load();
      const n = Math.round(Number(id) || 0);
      if (!n || !Array.isArray(s.cashbook_entries)) return false;
      const before = s.cashbook_entries.length;
      s.cashbook_entries = s.cashbook_entries.filter((e) => e.id !== n);
      if (s.cashbook_entries.length === before) return false;
      save();
      return true;
    },

    async listOrdersForCashbookDay(entryDate) {
      const day = String(entryDate || '').slice(0, 10);
      return this.listOrdersForCashbookRange(day, day);
    },

    async listOrdersForCashbookRange(fromDate, toDate) {
      const from = String(fromDate || '').slice(0, 10);
      const to = String(toDate || from).slice(0, 10);
      const s = load();
      const istDay = (iso) => {
        if (!iso) return null;
        try {
          return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(new Date(iso));
        } catch {
          return String(iso).slice(0, 10);
        }
      };
      return (s.orders || [])
        .filter((o) => {
          const service = String(o.service_date || '').slice(0, 10);
          const paid = istDay(o.paid_at);
          const cash = istDay(o.cash_confirmed_at || o.meta?.cash_confirmed_at);
          return (
            (service && service >= from && service <= to) ||
            (paid && paid >= from && paid <= to) ||
            (cash && cash >= from && cash <= to)
          );
        })
        .slice(0, 2000)
        .map((o) => ({ ...o }));
    },
  };
}
