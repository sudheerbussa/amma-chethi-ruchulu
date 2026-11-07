/**
 * Daily / range cashbook: expenses, manual cash-in, opening backlog + order aggregates.
 * Optionally rolls in Fresh (ACR Fresh) orders when FRESH_DATABASE_URL is set.
 */

import { getDb } from './db.js';
import { config } from './config.js';
import { nowIst } from './cutoffs.js';

export const CASHBOOK_KINDS = [
  { id: 'opening_balance', label: 'Opening / backlog balance', sign: 1 },
  { id: 'manual_cash_in', label: 'Manual cash received (offline order)', sign: 1 },
  { id: 'expense', label: 'Expense', sign: -1 },
  { id: 'adjustment', label: 'Adjustment (+/−)', sign: 1 },
];

function dayIso(d) {
  return String(d || nowIst().isoDate).slice(0, 10);
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

function normalizeRange(fromDate, toDate) {
  let from = dayIso(fromDate);
  let to = dayIso(toDate || fromDate);
  if (from > to) {
    const tmp = from;
    from = to;
    to = tmp;
  }
  return { from, to };
}

export async function addCashbookEntry({
  entry_date,
  kind,
  amount_paise,
  note = '',
  order_ref = null,
  created_by = 'admin',
}) {
  const db = getDb();
  if (typeof db.insertCashbookEntry !== 'function') {
    throw new Error('Cashbook not available on this store');
  }
  const k = String(kind || '').trim();
  if (!CASHBOOK_KINDS.some((x) => x.id === k)) throw new Error('Invalid cashbook kind');
  const amt = Math.round(Number(amount_paise) || 0);
  if (!Number.isFinite(amt) || amt === 0) throw new Error('Amount required (nonzero)');
  // Expenses stored as positive outflow; summary applies sign
  const storeAmt = k === 'expense' ? Math.abs(amt) : amt;
  return db.insertCashbookEntry({
    entry_date: dayIso(entry_date),
    kind: k,
    amount_paise: storeAmt,
    note: String(note || '').slice(0, 500),
    order_ref: order_ref ? String(order_ref).slice(0, 40) : null,
    created_by: String(created_by || 'admin').slice(0, 80),
  });
}

export async function deleteCashbookEntry(id) {
  const db = getDb();
  if (typeof db.deleteCashbookEntry !== 'function') return false;
  return db.deleteCashbookEntry(id);
}

/**
 * Roll prepaid / COD open / COD collected for a list of orders in an IST date range.
 * @param {string} from
 * @param {string} to
 */
function aggregateOrdersForRange(orders, from, to, seen) {
  let online_in_paise = 0;
  let cod_due_open_paise = 0;
  let cod_collected_paise = 0;
  let orders_paid_count = 0;

  for (const o of orders || []) {
    const key = String(o.order_ref || o.id || '');
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    if (['cancelled', 'pending_payment'].includes(o.status)) continue;
    const total = Math.round(Number(o.total_paise) || 0);
    const due = Math.round(Number(o.cod_due_paise) || 0);
    const prepaid = Math.max(0, total - due);
    const paidDay = istDayFromIso(o.paid_at) || String(o.service_date || '').slice(0, 10);
    const serviceDay = String(o.service_date || '').slice(0, 10);
    const inPaidWindow =
      (paidDay && paidDay >= from && paidDay <= to) ||
      (serviceDay && serviceDay >= from && serviceDay <= to);
    if (inPaidWindow) {
      orders_paid_count += 1;
      online_in_paise += prepaid;
    }
    if (due > 0 && !o.cash_confirmed_at) cod_due_open_paise += due;
    const cashDay = istDayFromIso(o.cash_confirmed_at);
    if (cashDay && cashDay >= from && cashDay <= to) {
      const collected = Math.round(Number(o.cod_collected_paise) || due || 0);
      cod_collected_paise += collected;
    }
  }

  return {
    online_in_paise,
    cod_due_open_paise,
    cod_collected_paise,
    orders_paid_count,
  };
}

/** Lazy Fresh Postgres pool (optional — Food cashbook only). */
let freshPool = null;

function mapFreshCashbookOrder(row) {
  if (!row) return null;
  const meta = row.meta && typeof row.meta === 'object' ? row.meta : {};
  const paidAt =
    row.paid_at instanceof Date ? row.paid_at.toISOString() : row.paid_at || null;
  return {
    id: row.id,
    order_ref: row.order_ref,
    status: row.status,
    total_paise: Math.round(Number(row.total_paise) || 0),
    service_date: row.service_date ? String(row.service_date).slice(0, 10) : null,
    paid_at: paidAt,
    cod_due_paise: Math.round(Number(meta.cod_due_paise) || 0),
    cod_collected_paise:
      meta.cod_collected_paise != null
        ? Math.round(Number(meta.cod_collected_paise) || 0)
        : null,
    cash_confirmed_at: meta.cash_confirmed_at || null,
    payment_method: meta.payment_method || null,
  };
}

async function listFreshOrdersForCashbookRange(from, to) {
  const url = String(config.freshDatabaseUrl || '').trim();
  if (!url) return { linked: false, orders: [] };

  try {
    if (!freshPool) {
      const { default: pg } = await import('pg');
      freshPool = new pg.Pool({
        connectionString: url,
        max: 2,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 8_000,
      });
      freshPool.on('error', (err) => {
        console.warn('[cashbook] fresh pool error', err.message);
      });
    }
    const res = await freshPool.query(
      `SELECT id, order_ref, status, total_paise, service_date, paid_at, meta
       FROM orders
       WHERE (service_date BETWEEN $1::date AND $2::date)
          OR ((paid_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $1::date AND $2::date)
          OR COALESCE(
               ((NULLIF(meta->>'cash_confirmed_at',''))::timestamptz
                  AT TIME ZONE 'Asia/Kolkata')::date,
               NULL
             ) BETWEEN $1::date AND $2::date
       ORDER BY id DESC
       LIMIT 2000`,
      [from, to],
    );
    return {
      linked: true,
      orders: (res.rows || []).map(mapFreshCashbookOrder).filter(Boolean),
    };
  } catch (err) {
    console.warn('[cashbook] Fresh query failed', err.message);
    return { linked: true, orders: [], error: err.message };
  }
}

function summarizeEntries(entries) {
  let opening_paise = 0;
  let manual_cash_in_paise = 0;
  let expense_paise = 0;
  let adjustment_paise = 0;
  for (const e of entries || []) {
    const amt = Math.round(Number(e.amount_paise) || 0);
    if (e.kind === 'opening_balance') opening_paise += amt;
    else if (e.kind === 'manual_cash_in') manual_cash_in_paise += amt;
    else if (e.kind === 'expense') expense_paise += Math.abs(amt);
    else if (e.kind === 'adjustment') adjustment_paise += amt;
  }
  return { opening_paise, manual_cash_in_paise, expense_paise, adjustment_paise };
}

function buildSummaryPayload({ from, to, entries, food, fresh, freshResult, kindFilter }) {
  const filteredEntries =
    kindFilter && kindFilter !== 'all'
      ? (entries || []).filter((e) => e.kind === kindFilter)
      : entries || [];
  const entryTotals = summarizeEntries(filteredEntries);

  const online_in_paise = food.online_in_paise + fresh.online_in_paise;
  const cod_collected_paise = food.cod_collected_paise + fresh.cod_collected_paise;
  const cod_due_open_paise = food.cod_due_open_paise + fresh.cod_due_open_paise;
  const orders_paid_count = food.orders_paid_count + fresh.orders_paid_count;

  const net_paise =
    entryTotals.opening_paise +
    online_in_paise +
    cod_collected_paise +
    entryTotals.manual_cash_in_paise +
    entryTotals.adjustment_paise -
    entryTotals.expense_paise;

  return {
    entry_date: from === to ? from : null,
    from_date: from,
    to_date: to,
    is_range: from !== to,
    kind_filter: kindFilter || 'all',
    opening_paise: entryTotals.opening_paise,
    online_in_paise,
    food_online_in_paise: food.online_in_paise,
    fresh_online_in_paise: fresh.online_in_paise,
    cod_collected_paise,
    food_cod_collected_paise: food.cod_collected_paise,
    fresh_cod_collected_paise: fresh.cod_collected_paise,
    cod_due_open_paise,
    food_cod_due_open_paise: food.cod_due_open_paise,
    fresh_cod_due_open_paise: fresh.cod_due_open_paise,
    manual_cash_in_paise: entryTotals.manual_cash_in_paise,
    expense_paise: entryTotals.expense_paise,
    adjustment_paise: entryTotals.adjustment_paise,
    orders_paid_count,
    food_orders_paid_count: food.orders_paid_count,
    fresh_orders_paid_count: fresh.orders_paid_count,
    net_paise,
    entries: filteredEntries,
    entries_total: (entries || []).length,
    fresh_linked: Boolean(String(config.freshDatabaseUrl || '').trim()),
    fresh_error: freshResult.error || null,
  };
}

/**
 * Day summary combining WhatsApp orders + cashbook rows.
 */
export async function cashbookDaySummary(entry_date, { kind } = {}) {
  const day = dayIso(entry_date);
  return cashbookRangeSummary({ from: day, to: day, kind });
}

/**
 * Range summary (inclusive IST dates) + optional kind filter on manual entries.
 */
export async function cashbookRangeSummary({ from, to, kind } = {}) {
  const db = getDb();
  const range = normalizeRange(from, to);
  const kindFilter = String(kind || 'all').trim() || 'all';

  let entries = [];
  if (typeof db.listCashbookEntriesRange === 'function') {
    entries = await db.listCashbookEntriesRange(range.from, range.to);
  } else if (typeof db.listCashbookEntries === 'function' && range.from === range.to) {
    entries = await db.listCashbookEntries(range.from);
  }

  const seen = new Set();
  let foodOrders = [];
  if (typeof db.listOrdersForCashbookRange === 'function') {
    foodOrders = await db.listOrdersForCashbookRange(range.from, range.to);
  } else if (typeof db.listOrdersForCashbookDay === 'function' && range.from === range.to) {
    foodOrders = await db.listOrdersForCashbookDay(range.from);
  }
  const food = aggregateOrdersForRange(foodOrders, range.from, range.to, seen);

  const freshResult = await listFreshOrdersForCashbookRange(range.from, range.to);
  const freshSeen = new Set();
  const fresh = aggregateOrdersForRange(freshResult.orders, range.from, range.to, freshSeen);

  return buildSummaryPayload({
    from: range.from,
    to: range.to,
    entries,
    food,
    fresh,
    freshResult,
    kindFilter,
  });
}
