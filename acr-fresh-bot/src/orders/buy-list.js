/**
 * Market buying list — combined quantities for one delivery day (pre-planned model).
 * Paid and unpaid orders both count (admin confirms unpaid / non-COD orders next morning).
 * Sent to admin WhatsApp once, a few minutes after config.orderCutoffMinutes, for the next day.
 */
import { config } from '../config.js';
import { getDb } from '../db.js';
import { dayFromIso, nowIst, orderCutoffLabel, parseSlotId, slotLabel } from '../cutoffs.js';
import { formatKgPack } from '../menu.js';
import { formatPaise } from './cart.js';
import { notifyAdmins } from '../ops-notify.js';

const PAID = ['paid', 'preparing', 'out_for_delivery'];
const UNPAID = ['pending_payment'];
const SEND_DELAY_MIN = 5;

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

export function tomorrowIso(now = nowIst()) {
  return new Date(Date.UTC(now.year, now.month - 1, now.day + 1, 12)).toISOString().slice(0, 10);
}

/**
 * @returns {Promise<{ date: string, orders: number, paid: number, unpaid: number, unpaidOrders: Array<object>, items: Array<{ key: string, name: string, kg: number|null, units: number }>, hours: Array<{ label: string, orders: number }> }>}
 */
export async function buildBuyList(isoDate) {
  const db = getDb();
  const date = String(isoDate).slice(0, 10);
  const paidOrders = await db.listOrdersForServiceDate(date, PAID);
  const unpaidOrders = await db.listOrdersForServiceDate(date, UNPAID);
  const all = [...paidOrders, ...unpaidOrders];

  const byItem = new Map();
  const byHour = new Map();
  for (const o of all) {
    const slot = parseSlotId(o.delivery_slot);
    const hourKey = slot ? slot.hour : 99;
    byHour.set(hourKey, (byHour.get(hourKey) || 0) + 1);
    for (const line of Array.isArray(o.items) ? o.items : []) {
      const qty = Math.max(0, Number(line.qty) || 0);
      if (!qty) continue;
      const key = String(line.base_code || line.code || line.name || '?').toUpperCase();
      const cur = byItem.get(key) || {
        key,
        name: String(line.base_name || line.name || key).replace(/\s*\([^)]*kg[^)]*\)\s*$/i, '').trim(),
        kg: null,
        units: 0,
      };
      const packKg = Number(line.pack_kg);
      if (Number.isFinite(packKg) && packKg > 0) cur.kg = round3((cur.kg || 0) + packKg * qty);
      else cur.units += qty;
      byItem.set(key, cur);
    }
  }
  const items = [...byItem.values()].sort((a, b) => a.name.localeCompare(b.name));
  const hours = [...byHour.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([h, n]) => ({ label: h === 99 ? 'No slot' : slotLabel(h), orders: n }));
  return {
    date,
    orders: all.length,
    paid: paidOrders.length,
    unpaid: unpaidOrders.length,
    unpaidOrders: unpaidOrders.map((o) => ({
      order_ref: o.order_ref,
      phone: o.phone,
      customer_name: o.customer_name || '',
      total_paise: o.total_paise,
      slot: parseSlotId(o.delivery_slot) ? slotLabel(parseSlotId(o.delivery_slot).hour) : '',
    })),
    items,
    hours,
  };
}

export function buyListText(list) {
  const day = dayFromIso(list.date);
  const lines = [
    `🛒 *Market buying list — ${day.dayDateLabel}*`,
    `${list.orders} order(s): ${list.paid} paid/COD + ${list.unpaid} unpaid`,
  ];
  for (const h of list.hours) lines.push(`• ${h.label}: ${h.orders}`);
  lines.push('');
  if (!list.items.length) lines.push('No items to buy.');
  for (const it of list.items) {
    const parts = [];
    if (it.kg) parts.push(formatKgPack(it.kg));
    if (it.units) parts.push(`${it.units} pc/pack`);
    lines.push(`• ${it.name} — *${parts.join(' + ')}*`);
  }
  if (list.unpaidOrders.length) {
    lines.push('', `📞 *Confirm in the morning (unpaid, included above):*`);
    for (const o of list.unpaidOrders) {
      lines.push(
        `• ${o.order_ref} · ${o.customer_name || 'Customer'} · +${String(o.phone || '').replace(/\D/g, '')} · ${formatPaise(o.total_paise || 0)}${o.slot ? ` · ${o.slot}` : ''}`,
      );
    }
  }
  return lines.join('\n');
}

export async function sendBuyList(isoDate) {
  const list = await buildBuyList(isoDate);
  const text = buyListText(list);
  const res = await notifyAdmins(text);
  return { list, text, sent: res?.ok || [], failed: res?.fail || [] };
}

/** Every minute from index.js: a few minutes after the cutoff, send tomorrow's list once. */
export async function runBuyListSchedule() {
  const t = nowIst();
  const sendAt = Math.min(23 * 60 + 59, Number(config.orderCutoffMinutes) + SEND_DELAY_MIN);
  if (t.hour * 60 + t.minute < sendAt) return;
  const date = tomorrowIso(t);
  const lock = `buy_list_sent_${date}`;
  const db = getDb();
  try {
    if (await db.getMeta(lock)) return;
    await db.setMeta(lock, new Date().toISOString());
  } catch (err) {
    console.error('[buy-list] lock failed', err.message || err);
    return;
  }
  try {
    const out = await sendBuyList(date);
    console.log(
      `[buy-list] ${date} after ${orderCutoffLabel()} → ${out.list.orders} orders (${out.list.unpaid} unpaid), sent=${out.sent.length} failed=${out.failed.length}`,
    );
  } catch (err) {
    console.error('[buy-list] send failed', err.message || err);
  }
}
