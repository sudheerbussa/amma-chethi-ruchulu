/**
 * Home cooks ("Ammas") — USP of Amma Chethi Ruchulu.
 *
 * Architecture (MVP + payments path):
 *  - `ammas` entity: profile, payout share (bps), optional UPI, active flag
 *  - `dishes.amma_id` + denormalized `dishes.cook_name` for WhatsApp label
 *  - Cart/order lines snapshot `cook_name` / `amma_id` so historical payouts stay correct
 *  - Weekly earnings computed from paid orders (admin preview now; payout weeks later)
 *
 * See AMMAS.md for full design.
 */

/** Seed ammas — demo Tenali-style names until kitchen onboards real cooks. */
export const SEED_AMMAS = [
  {
    id: 'lakshmi',
    name: 'Lakshmi Amma',
    phone: null,
    active: true,
    payout_share_bps: 7000,
    upi_id: null,
    notes: 'Veg pappu & fries specialist',
  },
  {
    id: 'padma',
    name: 'Padma Amma',
    phone: null,
    active: true,
    payout_share_bps: 7000,
    upi_id: null,
    notes: 'Veg curries',
  },
  {
    id: 'saroja',
    name: 'Saroja Amma',
    phone: null,
    active: true,
    payout_share_bps: 7000,
    upi_id: null,
    notes: 'Paneer & specials',
  },
  {
    id: 'kamala',
    name: 'Kamala Amma',
    phone: null,
    active: true,
    payout_share_bps: 7200,
    upi_id: null,
    notes: 'Egg & chicken curries',
  },
  {
    id: 'hymavathi',
    name: 'Hymavathi Amma',
    phone: null,
    active: true,
    payout_share_bps: 7200,
    upi_id: null,
    notes: 'Non-veg fry & pepper',
  },
  {
    id: 'ramadevi',
    name: 'Ramadevi Amma',
    phone: null,
    active: true,
    payout_share_bps: 7200,
    upi_id: null,
    notes: 'Natu kodi & mutton (advance)',
  },
  {
    id: 'sujatha',
    name: 'Sujatha Amma',
    phone: null,
    active: true,
    payout_share_bps: 6800,
    upi_id: null,
    notes: 'Rice, meals & combos',
  },
  {
    id: 'venkatalakshmi',
    name: 'Venkatalakshmi Amma',
    phone: null,
    active: true,
    payout_share_bps: 6500,
    upi_id: null,
    notes: 'Rotis, pickle, sides',
  },
];

const PLACEHOLDER_COOKS = new Set(['', 'amma kitchen', 'kitchen', 'null', 'undefined']);

export function isPlaceholderCook(name) {
  return PLACEHOLDER_COOKS.has(String(name || '').trim().toLowerCase());
}

/** WhatsApp / customer-facing dish line — USP: dish + Amma. */
export function formatDishLabel(dishOrName, cookName) {
  const name =
    typeof dishOrName === 'string'
      ? dishOrName
      : String(dishOrName?.name || dishOrName?.base_name || '').trim();
  const cook = String(
    cookName != null
      ? cookName
      : typeof dishOrName === 'object'
        ? dishOrName?.cook_name || ''
        : '',
  ).trim();
  if (!name) return cook || '—';
  if (!cook || isPlaceholderCook(cook)) return name;
  // "Tomato Pappu · Lakshmi Amma"
  return `${name} · ${cook}`;
}

/** Compact form for 24-char WhatsApp list titles — prefer dish name. */
export function formatDishListTitle(dish) {
  return String(dish?.name || dish?.code || 'Item').slice(0, 24);
}

/** 72-char WhatsApp list description — Amma first so USP is visible. */
export function formatDishListDescription(dish, bits = []) {
  const cook = String(dish?.cook_name || '').trim();
  const prefix =
    cook && !isPlaceholderCook(cook) ? [`by ${cook}`] : [];
  return [...prefix, ...bits].filter(Boolean).join(' · ').slice(0, 72);
}

export function ammaSlugFromName(name) {
  const base = String(name || '')
    .toLowerCase()
    .replace(/\bamma\b/gi, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 32);
  return base || `amma${Date.now().toString(36).slice(-6)}`;
}

/**
 * Monday–Sunday (IST calendar) of the week containing `date`.
 * Returns { weekStart: 'YYYY-MM-DD', weekEnd: 'YYYY-MM-DD' }
 */
export function weekBoundsIst(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(safe);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const y = Number(get('year'));
  const m = Number(get('month'));
  const day = Number(get('day'));
  if (!y || !m || !day) {
    // Fallback: UTC week (should not hit on modern Node)
    const fallback = new Date();
    const utcDay = fallback.getUTCDay();
    const fromMon = utcDay === 0 ? 6 : utcDay - 1;
    const monMs = Date.UTC(
      fallback.getUTCFullYear(),
      fallback.getUTCMonth(),
      fallback.getUTCDate() - fromMon,
    );
    return {
      weekStart: new Date(monMs).toISOString().slice(0, 10),
      weekEnd: new Date(monMs + 6 * 86400000).toISOString().slice(0, 10),
    };
  }
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const wd = map[get('weekday')] ?? 1;
  const daysFromMon = wd === 0 ? 6 : wd - 1;
  const monMs = Date.UTC(y, m - 1, day - daysFromMon);
  const pad = (n) => String(n).padStart(2, '0');
  const toIso = (ms) => {
    const x = new Date(ms);
    return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
  };
  return { weekStart: toIso(monMs), weekEnd: toIso(monMs + 6 * 86400000) };
}

/** Gross food paise for a line belonging to amma. */
export function lineFoodPaise(line) {
  const qty = Number(line?.qty) || 0;
  const unit = Number(line?.unit_price_paise) || 0;
  return qty * unit;
}

/**
 * @param {Array} ammas
 * @param {Array} lines — { code, name, qty, unit_price_paise, cook_name?, amma_id? }
 * @param {Map} dishLookup — code → dish (optional, fills amma_id/cook_name)
 */
export function aggregateAmmaEarnings(ammas, lines, dishLookup = null) {
  const byId = new Map();
  for (const a of ammas) {
    byId.set(a.id, {
      amma_id: a.id,
      name: a.name,
      payout_share_bps: Number(a.payout_share_bps) || 7000,
      portions: 0,
      gross_food_paise: 0,
      share_paise: 0,
      dish_codes: new Set(),
    });
  }
  // Bucket unknown cooks by cook_name slug
  for (const line of lines) {
    let ammaId = line.amma_id;
    let cookName = line.cook_name;
    if (dishLookup && line.code) {
      const d = dishLookup.get(String(line.code).toUpperCase());
      if (d) {
        ammaId = ammaId || d.amma_id;
        cookName = cookName || d.cook_name;
      }
    }
    let bucket = ammaId && byId.get(ammaId);
    if (!bucket && cookName && !isPlaceholderCook(cookName)) {
      const id = ammaSlugFromName(cookName);
      if (!byId.has(id)) {
        byId.set(id, {
          amma_id: id,
          name: cookName,
          payout_share_bps: 7000,
          portions: 0,
          gross_food_paise: 0,
          share_paise: 0,
          dish_codes: new Set(),
          provisional: true,
        });
      }
      bucket = byId.get(id);
    }
    if (!bucket) continue;
    const qty = Number(line.qty) || 0;
    const gross = lineFoodPaise(line);
    bucket.portions += qty;
    bucket.gross_food_paise += gross;
    if (line.code) bucket.dish_codes.add(String(line.code).toUpperCase());
  }
  return [...byId.values()]
    .map((b) => {
      const bps = b.payout_share_bps || 7000;
      return {
        amma_id: b.amma_id,
        name: b.name,
        payout_share_bps: bps,
        portions: b.portions,
        gross_food_paise: b.gross_food_paise,
        share_paise: Math.round((b.gross_food_paise * bps) / 10000),
        dish_codes: [...b.dish_codes],
        provisional: Boolean(b.provisional),
      };
    })
    .filter((b) => b.portions > 0)
    .sort((a, b) => b.share_paise - a.share_paise || a.name.localeCompare(b.name));
}
