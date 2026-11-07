/**
 * ACR referral program — one code + one wallet shared by Food and Fresh.
 * Data lives in the Food Postgres DB (REFERRAL_DATABASE_URL on Fresh).
 * Keep this file identical in order-bot and acr-fresh-bot (brand comes from config).
 * Rules: docs/REFERRAL_PROGRAM.md
 */
import { config } from './config.js';
import { formatPaise } from './orders/cart.js';

export const REFERRAL_BRAND = config.adminHubProduct === 'fresh' ? 'fresh' : 'food';

const PAID_STATUSES = ['paid', 'preparing', 'out_for_delivery', 'delivered'];

export const DEFAULT_REFERRAL_SETTINGS = {
  enabled: true,
  friend_discount_paise: 5000,
  reward_paise: 3000,
  min_order_paise: 30000,
  // Food only: friend's first order gets ONE of these dishes at this price, or the flat discount — whichever saves more.
  food_deal_codes: ['B04', 'D18'],
  food_deal_price_paise: 9900,
  food_deal_label: 'Chicken Dum Biryani (single) / Chepala Pulusu (2 pcs)',
  wallet_max_pct: 50,
  credit_expiry_days: 90,
};

const pools = new Map();
let schemaReady = null;

function cleanUrl(u) {
  return String(u || '').trim();
}

async function poolFor(url) {
  const key = cleanUrl(url);
  if (!key) return null;
  if (!pools.has(key)) {
    const { default: pg } = await import('pg');
    const p = new pg.Pool({
      connectionString: key,
      max: 3,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
    });
    p.on('error', (err) => console.warn('[referrals] pool error', err.message));
    pools.set(key, p);
  }
  return pools.get(key);
}

export function referralsConfigured() {
  return Boolean(cleanUrl(config.referralDatabaseUrl));
}

async function refPool() {
  const p = await poolFor(config.referralDatabaseUrl);
  if (!p) return null;
  if (!schemaReady) {
    schemaReady = ensureSchema(p).catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
  return p;
}

async function ensureSchema(p) {
  await p.query(`
    CREATE TABLE IF NOT EXISTS referral_settings (
      id SMALLINT PRIMARY KEY DEFAULT 1,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS referral_codes (
      phone TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT,
      brand TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS referrals (
      id BIGSERIAL PRIMARY KEY,
      referee_phone TEXT NOT NULL UNIQUE,
      referrer_phone TEXT NOT NULL,
      code TEXT NOT NULL,
      brand TEXT,
      source TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      first_order_ref TEXT,
      first_order_brand TEXT,
      reward_paise INTEGER,
      rewarded_at TIMESTAMPTZ,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON referrals (referrer_phone);
    CREATE TABLE IF NOT EXISTS wallet_ledger (
      id BIGSERIAL PRIMARY KEY,
      phone TEXT NOT NULL,
      delta_paise INTEGER NOT NULL,
      kind TEXT NOT NULL,
      brand TEXT,
      order_ref TEXT,
      referral_id BIGINT,
      note TEXT,
      expires_at TIMESTAMPTZ,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS wallet_ledger_phone_idx ON wallet_ledger (phone);
    CREATE UNIQUE INDEX IF NOT EXISTS wallet_ledger_order_uniq
      ON wallet_ledger (kind, brand, order_ref) WHERE order_ref IS NOT NULL;
  `);
}

export function normalizePhone(raw) {
  let p = String(raw || '').replace(/\D/g, '');
  if (p.length === 10) p = `91${p}`;
  return p;
}

function clampInt(v, min, max, fallback) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function dealCodes(raw, fallback) {
  if (raw === undefined || raw === null) return [...fallback];
  const list = Array.isArray(raw) ? raw : String(raw).split(/[\s,]+/);
  return [...new Set(list.map((c) => String(c).trim().toUpperCase()).filter((c) => /^[A-Z0-9]{2,8}$/.test(c)))].slice(0, 10);
}

/** Food dish deal for referred friends, or null (off, or Fresh). */
export function foodDishDeal(settings, brand = REFERRAL_BRAND) {
  if (brand !== 'food' || !settings) return null;
  if (!settings.food_deal_codes?.length || !(settings.food_deal_price_paise > 0)) return null;
  return {
    codes: settings.food_deal_codes,
    price_paise: settings.food_deal_price_paise,
    label: settings.food_deal_label || settings.food_deal_codes.join(' / '),
  };
}

/** Friend's first-order benefit in Telugu-English, per brand ("₹99 కే Biryani … లేదా ₹50 OFF (₹300+)"). */
export function friendOfferText(settings, brand = REFERRAL_BRAND, lang = 'te') {
  const flat = settings.friend_discount_paise > 0
    ? `${formatPaise(settings.friend_discount_paise)} OFF (food ${formatPaise(settings.min_order_paise)}+)`
    : '';
  const deal = foodDishDeal(settings, brand);
  if (!deal) return flat;
  const price = formatPaise(deal.price_paise);
  const dealText = lang === 'en' ? `${deal.label} at ${price}` : `${price} కే ${deal.label}`;
  if (!flat) return dealText;
  return lang === 'en' ? `${dealText}, or ${flat} — whichever saves more` : `${dealText} — లేదా ${flat}`;
}

export function normalizeReferralSettings(raw = {}) {
  const d = DEFAULT_REFERRAL_SETTINGS;
  return {
    enabled: raw.enabled === undefined ? d.enabled : raw.enabled !== false && raw.enabled !== 'false',
    friend_discount_paise: clampInt(raw.friend_discount_paise, 0, 100000, d.friend_discount_paise),
    reward_paise: clampInt(raw.reward_paise, 0, 100000, d.reward_paise),
    min_order_paise: clampInt(raw.min_order_paise, 0, 1000000, d.min_order_paise),
    food_deal_codes: dealCodes(raw.food_deal_codes, d.food_deal_codes),
    food_deal_price_paise: clampInt(raw.food_deal_price_paise, 0, 100000, d.food_deal_price_paise),
    food_deal_label: String(raw.food_deal_label ?? d.food_deal_label).trim().slice(0, 120),
    wallet_max_pct: clampInt(raw.wallet_max_pct, 0, 100, d.wallet_max_pct),
    credit_expiry_days: clampInt(raw.credit_expiry_days, 1, 3650, d.credit_expiry_days),
  };
}

export async function getReferralSettings() {
  const p = await refPool();
  if (!p) return { ...normalizeReferralSettings({}), enabled: false, configured: false };
  const r = await p.query('SELECT data FROM referral_settings WHERE id = 1');
  return { ...normalizeReferralSettings(r.rows[0]?.data || {}), configured: true };
}

/** Welcome-message line that sells the benefit, so people actually type REFER. */
export async function referPromoLine() {
  try {
    const s = await getReferralSettings();
    if (!s.enabled) return '';
    return (
      `🎁 *Refer & earn:* మీ friend కి first order పై *${friendOfferText(s)}*, ` +
      `వాళ్ళ order deliver అయ్యాక మీకు *${formatPaise(s.reward_paise)} ACR Credit*.\n` +
      `మీ link కోసం *REFER* అని type చేయండి.`
    );
  } catch {
    return `🎁 Friends ని refer చేసి ACR Credit పొందండి — type *REFER*`;
  }
}

export async function saveReferralSettings(patch = {}) {
  const p = await refPool();
  if (!p) throw new Error('Referral DB not configured');
  const cur = await getReferralSettings();
  const next = normalizeReferralSettings({ ...cur, ...patch });
  await p.query(
    `INSERT INTO referral_settings (id, data, updated_at) VALUES (1, $1, now())
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [JSON.stringify(next)],
  );
  return { ...next, configured: true };
}

async function activeSettings() {
  if (!referralsConfigured()) return null;
  try {
    const s = await getReferralSettings();
    return s.enabled ? s : null;
  } catch (err) {
    console.error('[referrals] settings failed', err.message);
    return null;
  }
}

/**
 * Candidate codes in free text: "Hi SHYAM27", "ACR-SHYAM27", "shyam27 referral".
 * A mobile number only counts after "ref"/"referral" ("Hi, referral 98222 22222" — website verify button),
 * so numbers in normal chat are never treated as referrals.
 */
export function referralCodeCandidates(text) {
  const up = String(text || '')
    .toUpperCase()
    .replace(/ACR[-\s]+/g, ' ');
  const out = [];
  for (const m of up.matchAll(/(?<![A-Z0-9])([A-Z]{3,8}\d{2,3})(?![A-Z0-9])/g)) {
    if (!out.includes(m[1])) out.push(m[1]);
  }
  for (const m of up.matchAll(/REF(?:ERRAL)?[\s:#-]*((?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5})(?!\d)/g)) {
    const phone = referrerPhoneFromInput(m[1]);
    if (phone && !out.includes(phone)) out.push(phone);
  }
  return out.slice(0, 3);
}

function codeStem(name) {
  const first = String(name || '')
    .trim()
    .split(/\s+/)[0]
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  return first.length >= 3 ? first.slice(0, 8) : 'ACR';
}

export async function getCodeForPhone(phone) {
  const p = await refPool();
  if (!p) return null;
  const r = await p.query('SELECT phone, code, name FROM referral_codes WHERE phone = $1', [
    normalizePhone(phone),
  ]);
  return r.rows[0] || null;
}

export async function getOrCreateCode(phone, name) {
  const p = await refPool();
  if (!p) return null;
  const ph = normalizePhone(phone);
  const existing = await getCodeForPhone(ph);
  if (existing) return existing;
  const stem = codeStem(name);
  for (let i = 0; i < 40; i += 1) {
    const digits = i < 30 ? 2 : 3;
    const n = Math.floor(Math.random() * 10 ** digits)
      .toString()
      .padStart(digits, '0');
    const code = `${stem}${n}`;
    const r = await p.query(
      `INSERT INTO referral_codes (phone, code, name, brand) VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING RETURNING phone, code, name`,
      [ph, code, name || null, REFERRAL_BRAND],
    );
    if (r.rows[0]) return r.rows[0];
    const again = await getCodeForPhone(ph);
    if (again) return again;
  }
  throw new Error('Could not allocate referral code');
}

/** Referral typed as a mobile number ("98765 43210", "+91 98765…") → 91XXXXXXXXXX, else null. */
export function referrerPhoneFromInput(input) {
  const s = String(input || '').trim();
  if (!/^[\d\s+()-]+$/.test(s)) return null;
  const d = s.replace(/\D/g, '');
  if (d.length === 10 && /^[6-9]/.test(d)) return `91${d}`;
  if (d.length === 12 && d.startsWith('91') && /^[6-9]/.test(d.slice(2))) return d;
  return null;
}

function orderDbUrls() {
  return [...new Set([cleanUrl(config.databaseUrl), cleanUrl(config.peerOrdersDatabaseUrl)])].filter(Boolean);
}

async function customerNameFromOrderDbs(phone) {
  for (const url of orderDbUrls()) {
    try {
      const p = await poolFor(url);
      const r = await p.query('SELECT name FROM customers WHERE phone = $1', [phone]);
      if (r.rows[0]?.name) return r.rows[0].name;
    } catch {
      /* customers table missing on this DB */
    }
  }
  return null;
}

/**
 * Referrer from a code or a mobile number. A number counts only when it has a paid order
 * on Food or Fresh (visitors who never paid are not referrers).
 */
export async function findCodeOwner(input) {
  const p = await refPool();
  if (!p) return null;
  const phone = referrerPhoneFromInput(input);
  if (!phone) {
    const r = await p.query('SELECT phone, code, name FROM referral_codes WHERE code = $1', [
      String(input || '').trim().toUpperCase(),
    ]);
    return r.rows[0] || null;
  }
  if (!(await isExistingCustomer(phone))) return null;
  return (await getCodeForPhone(phone)) || getOrCreateCode(phone, await customerNameFromOrderDbs(phone));
}

async function phoneHasPaidOrderIn(url, phone) {
  const p = await poolFor(url);
  if (!p) return false;
  const r = await p.query(
    'SELECT 1 FROM orders WHERE phone = $1 AND status = ANY($2) LIMIT 1',
    [phone, PAID_STATUSES],
  );
  return r.rowCount > 0;
}

/**
 * Existing = a paid / preparing / out-for-delivery / delivered order on Food or Fresh.
 * Offline orders count once admin enters them in the portal and marks them paid / COD.
 */
export async function isExistingCustomer(phone) {
  const ph = normalizePhone(phone);
  for (const url of orderDbUrls()) {
    if (await phoneHasPaidOrderIn(url, ph)) return true;
  }
  return false;
}

export async function isNewCustomer(phone) {
  return !(await isExistingCustomer(phone));
}

export async function getReferralForReferee(phone) {
  const p = await refPool();
  if (!p) return null;
  const r = await p.query('SELECT * FROM referrals WHERE referee_phone = $1', [normalizePhone(phone)]);
  return r.rows[0] || null;
}

/**
 * Attach a friend to a referrer (first valid code wins).
 * @returns {Promise<{ status: 'applied'|'already'|'self'|'not_new'|'unknown_code'|'disabled', code?: string, referrer_name?: string|null, amount_paise?: number, min_paise?: number }>}
 */
async function evaluateReferral({ phone, code }) {
  const settings = await activeSettings();
  if (!settings) return { status: 'disabled' };
  const ph = normalizePhone(phone);
  if (ph.length < 12) return { status: 'need_phone' };
  const owner = await findCodeOwner(code);
  if (!owner) return { status: 'unknown_code' };
  const base = {
    code: owner.code,
    referrer_name: owner.name || null,
    amount_paise: settings.friend_discount_paise,
    min_paise: settings.min_order_paise,
    offer_text: friendOfferText(settings),
    offer_text_en: friendOfferText(settings, REFERRAL_BRAND, 'en'),
  };
  if (owner.phone === ph) return { ...base, status: 'self' };
  const existing = await getReferralForReferee(ph);
  if (existing) return { ...base, status: 'already', code: existing.code };
  if (!(await isNewCustomer(ph))) return { ...base, status: 'not_new' };
  return { ...base, status: 'ok', owner, phone: ph };
}

/** Website "Check" button: same rules as capture, nothing saved. */
export async function previewReferral({ phone, code }) {
  const res = await evaluateReferral({ phone, code });
  if (res.status !== 'ok') return res;
  const { owner: _o, phone: _p, ...rest } = res;
  return { ...rest, status: 'valid' };
}

export async function captureReferral({ phone, code, source = 'whatsapp' }) {
  const res = await evaluateReferral({ phone, code });
  if (res.status !== 'ok') return res;
  const { owner, phone: ph, ...base } = res;
  delete base.status;
  const p = await refPool();
  const r = await p.query(
    `INSERT INTO referrals (referee_phone, referrer_phone, code, brand, source)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT (referee_phone) DO NOTHING RETURNING id`,
    [ph, owner.phone, owner.code, REFERRAL_BRAND, String(source).slice(0, 20)],
  );
  return { ...base, status: r.rowCount ? 'applied' : 'already' };
}

/** Try every code-looking token in a message; null when none is a real code. */
export async function captureReferralFromText(phone, text, source = 'whatsapp') {
  if (!referralsConfigured()) return null;
  for (const cand of referralCodeCandidates(text)) {
    const res = await captureReferral({ phone, code: cand, source });
    if (res.status !== 'unknown_code') return /^\d+$/.test(cand) ? { ...res, by_phone: true } : res;
  }
  return null;
}

/**
 * Friend welcome discount for checkout (pass to applyOffers as referralWelcome).
 * Null when not referred, already ordered, rejected, or program off.
 */
export async function referralWelcomeFor(phone) {
  try {
    const settings = await activeSettings();
    const dishDeal = foodDishDeal(settings);
    if (!settings || (settings.friend_discount_paise <= 0 && !dishDeal)) return null;
    const ref = await getReferralForReferee(phone);
    if (!ref || ref.status !== 'pending') return null;
    if (!(await isNewCustomer(phone))) return null;
    return {
      referral_id: Number(ref.id),
      code: ref.code,
      amount_paise: settings.friend_discount_paise,
      min_paise: settings.min_order_paise,
      title: `Referral welcome (${ref.code}) — ${formatPaise(settings.friend_discount_paise)} off`,
      dish_deal: dishDeal,
    };
  } catch (err) {
    console.error('[referrals] welcome lookup failed', err.message);
    return null;
  }
}

/**
 * Write off expired credit, oldest first: expired credits minus everything already used
 * (debits, negative adjustments, earlier expiries) net of refunds. phone = null → everyone.
 */
async function expireCredits(db, phone = null) {
  await db.query(
    `INSERT INTO wallet_ledger (phone, delta_paise, kind, brand, note, created_by)
     SELECT phone, -(exp_cr - used), 'expiry', $1, 'Credit expired', 'system'
     FROM (
       SELECT phone,
         COALESCE(SUM(delta_paise) FILTER (
           WHERE delta_paise > 0 AND expires_at IS NOT NULL AND expires_at <= now()), 0) AS exp_cr,
         COALESCE(-SUM(delta_paise) FILTER (WHERE delta_paise < 0), 0)
           - COALESCE(SUM(delta_paise) FILTER (WHERE kind = 'order_refund'), 0) AS used
       FROM wallet_ledger
       WHERE ($2::text IS NULL OR phone = $2::text)
       GROUP BY phone
     ) s
     WHERE exp_cr - used > 0`,
    [REFERRAL_BRAND, phone],
  );
}

async function withWalletLock(phone, fn) {
  const p = await refPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    if (phone) {
      await client.query("SELECT pg_advisory_xact_lock_shared(hashtext('acr_wallet:*'))");
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`acr_wallet:${phone}`]);
    } else {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('acr_wallet:*'))");
    }
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function balanceOn(db, phone) {
  const r = await db.query(
    'SELECT COALESCE(SUM(delta_paise), 0)::int AS bal FROM wallet_ledger WHERE phone = $1',
    [phone],
  );
  return Math.max(0, Number(r.rows[0]?.bal) || 0);
}

export async function walletBalancePaise(phone) {
  const p = await refPool();
  if (!p) return 0;
  const ph = normalizePhone(phone);
  return withWalletLock(ph, async (db) => {
    await expireCredits(db, ph);
    return balanceOn(db, ph);
  });
}

/** Daily sweep so admin totals match what customers can spend. */
export async function expireWalletCredits() {
  const p = await refPool();
  if (!p) return;
  await withWalletLock(null, (db) => expireCredits(db, null));
}

/**
 * Credit to use on this order: min(balance, wallet_max_pct of food, food after other discounts).
 * Whole rupees only. Never throws (0 on any failure).
 */
export async function walletUseFor(phone, pricing) {
  try {
    if (!referralsConfigured()) return 0;
    const settings = await getReferralSettings();
    const food = Math.max(0, Number(pricing?.food_paise) || 0);
    const discount = Math.max(0, Number(pricing?.discount_paise) || 0);
    const cap = Math.floor((food * settings.wallet_max_pct) / 100);
    const bal = await walletBalancePaise(phone);
    const amount = Math.min(bal, cap, Math.max(0, food - discount));
    return Math.floor(amount / 100) * 100;
  } catch (err) {
    console.error('[referrals] wallet lookup failed', err.message);
    return 0;
  }
}

/**
 * Debit the credit used on an order once it is paid / COD-confirmed. Idempotent per order.
 * If the balance dropped since checkout, debits what is left and reports the shortfall.
 */
export async function walletDebitForOrder(order) {
  const want = Math.max(0, Math.round(Number(order?.wallet_paise ?? order?.meta?.wallet_paise) || 0));
  if (!want || !order?.phone || !order?.order_ref || !referralsConfigured()) return null;
  const ph = normalizePhone(order.phone);
  return withWalletLock(ph, async (db) => {
    const prev = await db.query(
      `SELECT delta_paise FROM wallet_ledger WHERE kind = 'order_debit' AND brand = $1 AND order_ref = $2`,
      [REFERRAL_BRAND, order.order_ref],
    );
    if (prev.rows[0]) return { debited_paise: -prev.rows[0].delta_paise, shortfall_paise: 0, already: true };
    await expireCredits(db, ph);
    const debit = Math.min(want, await balanceOn(db, ph));
    if (debit > 0) {
      await db.query(
        `INSERT INTO wallet_ledger (phone, delta_paise, kind, brand, order_ref, note, created_by)
         VALUES ($1, $2::int, 'order_debit', $3, $4, $5, 'system') ON CONFLICT DO NOTHING`,
        [ph, -debit, REFERRAL_BRAND, order.order_ref, `Used on ${order.order_ref}`],
      );
    }
    return { debited_paise: debit, shortfall_paise: want - debit, already: false };
  });
}

/** Give back credit debited for an order (cancel). Idempotent; no-op when nothing was debited. */
export async function walletRefundForOrder(order) {
  if (!order?.order_ref || !referralsConfigured()) return null;
  const p = await refPool();
  const r = await p.query(
    `INSERT INTO wallet_ledger (phone, delta_paise, kind, brand, order_ref, note, created_by)
     SELECT phone, -delta_paise, 'order_refund', brand, order_ref, $3, 'system'
     FROM wallet_ledger WHERE kind = 'order_debit' AND brand = $1 AND order_ref = $2
     ON CONFLICT DO NOTHING
     RETURNING phone, delta_paise`,
    [REFERRAL_BRAND, order.order_ref, `Refund · ${order.order_ref} cancelled`],
  );
  const row = r.rows[0];
  return row ? { phone: row.phone, refunded_paise: row.delta_paise } : null;
}

/**
 * Pay the referrer when the friend's qualifying order is delivered. Idempotent.
 * @returns {Promise<null | { referrer_phone: string, reward_paise: number, balance_paise: number, referee_phone: string }>}
 */
export async function onOrderDelivered(order) {
  const settings = await activeSettings();
  if (!settings || !order?.phone || !order?.order_ref) return null;
  // Qualifies if the friend's order used the referral welcome (dish deal has no minimum) or met the min.
  const usedWelcome = Boolean(order.meta?.referral_code);
  if (!usedWelcome && (Number(order.food_paise) || 0) < settings.min_order_paise) return null;
  const p = await refPool();
  const ph = normalizePhone(order.phone);
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const upd = await client.query(
      `UPDATE referrals SET status = 'rewarded', first_order_ref = $2, first_order_brand = $3,
         reward_paise = $4, rewarded_at = now(), updated_at = now()
       WHERE referee_phone = $1 AND status = 'pending'
       RETURNING id, referrer_phone, code`,
      [ph, order.order_ref, REFERRAL_BRAND, settings.reward_paise],
    );
    const ref = upd.rows[0];
    if (!ref) {
      await client.query('ROLLBACK');
      return null;
    }
    if (settings.reward_paise > 0) {
      await client.query(
        `INSERT INTO wallet_ledger (phone, delta_paise, kind, brand, order_ref, referral_id, note, expires_at, created_by)
         VALUES ($1, $2, 'referral_reward', $3, $4, $5, $6, now() + make_interval(days => $7::int), 'system')
         ON CONFLICT DO NOTHING`,
        [
          ref.referrer_phone,
          settings.reward_paise,
          REFERRAL_BRAND,
          order.order_ref,
          ref.id,
          `Friend ${ph.slice(-4)} first order ${order.order_ref}`,
          settings.credit_expiry_days,
        ],
      );
    }
    await client.query('COMMIT');
    return {
      referrer_phone: ref.referrer_phone,
      referee_phone: ph,
      reward_paise: settings.reward_paise,
      balance_paise: await walletBalancePaise(ref.referrer_phone),
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/* ---------- Customer copy ---------- */

function waNumber(brand) {
  return brand === 'fresh' ? config.freshWhatsappNumber : config.foodWhatsappNumber;
}

export function referralShareLink(code, brand = REFERRAL_BRAND) {
  return `https://wa.me/${waNumber(brand)}?text=${encodeURIComponent(`Hi ${code}`)}`;
}

/** Forwardable message the customer sends to friends. */
export function referralShareMessage({ code, settings }) {
  return (
    `❤️ నేను *Amma Chethi Ruchulu (ACR)* use చేస్తున్నాను — మీరు కూడా try చేయండి!\n\n` +
    `🍛 ACR Food — ఇంటి భోజనం, biryani, curries\n` +
    `🥦 ACR Fresh — fruits & vegetables\n` +
    `🏠 Tenali home delivery\n\n` +
    `🎁 మీ first order offer — code *${code}*\n` +
    `🍛 Food: ${friendOfferText(settings, 'food')}\n` +
    `🥦 Fresh: ${friendOfferText(settings, 'fresh')}\n\n` +
    `🍛 Food: ${referralShareLink(code, 'food')}\n` +
    `🥦 Fresh: ${referralShareLink(code, 'fresh')}`
  );
}

export async function referInfoMessages(phone, name) {
  const settings = await activeSettings();
  if (!settings) return null;
  const row = await getOrCreateCode(phone, name);
  const stats = await referrerStats(phone);
  const reward = formatPaise(settings.reward_paise);
  const intro =
    `🎁 *ACR — Oka Customer, Oka Kotha Family*\n\n` +
    `మీ referral code: *${row.code}*\n\n` +
    `👤 మీ friend first order:\n` +
    `   🍛 Food: *${friendOfferText(settings, 'food')}*\n` +
    `   🥦 Fresh: *${friendOfferText(settings, 'fresh')}*\n` +
    `💰 మీకు: వాళ్ల first order deliver అయిన తర్వాత *${reward} ACR Credit*\n` +
    `(Food + Fresh రెండింటిలో పనిచేస్తుంది)\n\n` +
    `ఇప్పటివరకు: ${stats.rewarded} friends joined · ${stats.pending} pending · ` +
    `Credit ${formatPaise(stats.balance_paise)}\n\n` +
    `👇 కింది message ని friends & family కి forward చేయండి.`;
  return { intro, share: referralShareMessage({ code: row.code, settings }), code: row.code };
}

export function referralAppliedText(res) {
  if (!res) return null;
  const offer = res.offer_text || `${formatPaise(res.amount_paise || 0)} OFF (food ${formatPaise(res.min_paise || 0)}+)`;
  // By-phone referrals never echo the owner's code or name (anyone can type a number).
  const label = res.by_phone ? '' : ` *${res.code}*`;
  if (res.status === 'applied') {
    return (
      `✅ Referral${label} applied${res.referrer_name && !res.by_phone ? ` (${res.referrer_name})` : ''}!\n` +
      `మీ first order పై *${offer}* — checkout లో auto apply అవుతుంది.`
    );
  }
  if (res.status === 'already') return `✅ Referral already linked${res.by_phone ? '' : ` (${res.code})`}. First order discount checkout లో apply అవుతుంది.`;
  if (res.status === 'self') return `ఇది మీ own referral code 🙂 Friends కి share చేయండి — type *REFER*.`;
  if (res.status === 'not_new') return `Referral codes కొత్త customers కి మాత్రమే. మీరు ఇప్పటికే ACR customer 🙏 — type *REFER* for your own code.`;
  return null;
}

/** Short website message for a referral check / checkout result. */
export function referralWebStatus(res) {
  const offer = res?.offer_text_en || `${formatPaise(res?.amount_paise || 0)} OFF (food ${formatPaise(res?.min_paise || 0)}+)`;
  switch (res?.status) {
    case 'valid':
    case 'applied':
      return { ok: true, message: `✅ First order: ${offer}` };
    case 'already':
      return { ok: true, message: `✅ Referral already linked (${res.code}) — discount applies on your first order` };
    case 'self':
      return { ok: false, message: 'You cannot use your own code or number.' };
    case 'not_new':
      return { ok: false, message: 'Referral is only for new customers — you have ordered with ACR before.' };
    case 'unknown_code':
      return { ok: false, message: 'Code / number not found. Check with your friend.' };
    case 'need_phone':
      return { ok: false, message: 'Enter your WhatsApp number first.' };
    default:
      return { ok: false, message: 'Referral offer is not available right now.' };
  }
}

export function referrerRewardText(reward) {
  return (
    `🎉 మీ friend first ACR order deliver అయ్యింది!\n` +
    `*${formatPaise(reward.reward_paise)} ACR Credit* మీ wallet లో add అయ్యింది.\n` +
    `Balance: ${formatPaise(reward.balance_paise)} — next order లో auto apply అవుతుంది.\n\n` +
    `ఇంకా friends ని refer చేయండి — type *REFER*.`
  );
}

export async function walletSummaryText(phone) {
  if (!referralsConfigured()) return null;
  const settings = await getReferralSettings();
  const bal = await walletBalancePaise(phone);
  const p = await refPool();
  const r = await p.query(
    `SELECT delta_paise, kind, note, created_at, expires_at FROM wallet_ledger
     WHERE phone = $1 ORDER BY id DESC LIMIT 5`,
    [normalizePhone(phone)],
  );
  const lines = r.rows.map((row) => {
    const sign = row.delta_paise >= 0 ? '+' : '−';
    const d = new Date(row.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
    return `${sign}${formatPaise(Math.abs(row.delta_paise))} · ${row.note || row.kind} · ${d}`;
  });
  return (
    `💰 *ACR Credit*: ${formatPaise(bal)}\n` +
    (bal > 0
      ? `Next order checkout లో auto apply అవుతుంది (food bill లో max ${settings.wallet_max_pct}%) — Food & Fresh రెండింటిలో.\n`
      : '') +
    (lines.length ? `\n${lines.join('\n')}\n` : '\nఇంకా credit లేదు.\n') +
    `\nFriends ని refer చేసి credit సంపాదించండి — type *REFER*.`
  );
}

/* ---------- Admin ---------- */

export async function referrerStats(phone) {
  const p = await refPool();
  const ph = normalizePhone(phone);
  const r = await p.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'rewarded')::int AS rewarded,
       COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
     FROM referrals WHERE referrer_phone = $1`,
    [ph],
  );
  return {
    rewarded: r.rows[0]?.rewarded || 0,
    pending: r.rows[0]?.pending || 0,
    balance_paise: await walletBalancePaise(ph),
  };
}

export async function adminOverview() {
  const p = await refPool();
  if (!p) return { configured: false };
  await expireWalletCredits();
  const settings = await getReferralSettings();
  const leaders = await p.query(`
    SELECT c.phone, c.code, c.name,
      COUNT(r.id) FILTER (WHERE r.status = 'rewarded')::int AS rewarded,
      COUNT(r.id) FILTER (WHERE r.status = 'pending')::int AS pending,
      COALESCE((SELECT SUM(delta_paise) FROM wallet_ledger w WHERE w.phone = c.phone), 0)::int AS balance_paise,
      COALESCE((SELECT SUM(delta_paise) FROM wallet_ledger w
                WHERE w.phone = c.phone AND w.kind = 'referral_reward'), 0)::int AS earned_paise
    FROM referral_codes c
    LEFT JOIN referrals r ON r.referrer_phone = c.phone
    GROUP BY c.phone, c.code, c.name
    HAVING COUNT(r.id) > 0
    ORDER BY rewarded DESC, pending DESC
    LIMIT 200`);
  const referrals = await p.query(`
    SELECT r.*, c.name AS referrer_name
    FROM referrals r LEFT JOIN referral_codes c ON c.phone = r.referrer_phone
    ORDER BY r.id DESC LIMIT 300`);
  const totals = await p.query(`
    SELECT
      (SELECT COUNT(*) FROM referral_codes)::int AS codes,
      (SELECT COUNT(*) FROM referrals WHERE status = 'pending')::int AS pending,
      (SELECT COUNT(*) FROM referrals WHERE status = 'rewarded')::int AS rewarded,
      (SELECT COALESCE(SUM(delta_paise), 0) FROM wallet_ledger)::int AS outstanding_paise`);
  return {
    configured: true,
    settings,
    totals: totals.rows[0],
    leaders: leaders.rows,
    referrals: referrals.rows,
  };
}

export async function adminWallet(phone) {
  const p = await refPool();
  if (!p) return { configured: false };
  const ph = normalizePhone(phone);
  const r = await p.query('SELECT * FROM wallet_ledger WHERE phone = $1 ORDER BY id DESC LIMIT 200', [ph]);
  const code = await getCodeForPhone(ph);
  const referral = await getReferralForReferee(ph);
  return {
    configured: true,
    phone: ph,
    code: code?.code || null,
    referred_by: referral,
    balance_paise: await walletBalancePaise(ph),
    entries: r.rows,
  };
}

export async function adminAdjustWallet({ phone, delta_paise, note, by }) {
  const p = await refPool();
  if (!p) throw new Error('Referral DB not configured');
  const ph = normalizePhone(phone);
  const delta = Math.round(Number(delta_paise) || 0);
  if (ph.length < 12) throw new Error('Valid phone required');
  if (!delta) throw new Error('Amount required');
  const settings = await getReferralSettings();
  await p.query(
    `INSERT INTO wallet_ledger (phone, delta_paise, kind, brand, note, expires_at, created_by)
     VALUES ($1, $2::int, 'admin_adjust', $3, $4,
       CASE WHEN $2::int > 0 THEN now() + make_interval(days => $6::int) ELSE NULL END, $5)`,
    [ph, delta, REFERRAL_BRAND, String(note || '').slice(0, 200) || 'Admin adjustment', by || 'admin', settings.credit_expiry_days],
  );
  return adminWallet(ph);
}

export async function adminSetReferralStatus(id, status, note) {
  const p = await refPool();
  if (!p) throw new Error('Referral DB not configured');
  if (!['pending', 'rejected'].includes(status)) throw new Error('status must be pending or rejected');
  const r = await p.query(
    `UPDATE referrals SET status = $2, note = COALESCE($3, note), updated_at = now()
     WHERE id = $1 AND status <> 'rewarded' RETURNING *`,
    [Number(id), status, note ? String(note).slice(0, 200) : null],
  );
  if (!r.rows[0]) throw new Error('Referral not found or already rewarded');
  return r.rows[0];
}

/** Admin manual link (phone orders): attach friend to code without WhatsApp. */
export async function adminLinkReferral({ phone, code }) {
  return captureReferral({ phone, code, source: 'admin' });
}

export async function adminReferralsCsv() {
  const data = await adminOverview();
  if (!data.configured) return 'configured,false\n';
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = 'id,referrer_phone,referrer_name,code,referee_phone,status,brand,source,first_order_ref,reward_paise,created_at,rewarded_at';
  const rows = data.referrals.map((r) =>
    [
      r.id,
      r.referrer_phone,
      r.referrer_name,
      r.code,
      r.referee_phone,
      r.status,
      r.brand,
      r.source,
      r.first_order_ref,
      r.reward_paise,
      r.created_at?.toISOString?.() || r.created_at,
      r.rewarded_at?.toISOString?.() || r.rewarded_at || '',
    ]
      .map(esc)
      .join(','),
  );
  return `${head}\n${rows.join('\n')}\n`;
}
