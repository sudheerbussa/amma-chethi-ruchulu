/**
 * Short supply / revised bill — cut delivered qty, add call-in items, recompute totals,
 * optional WhatsApp to customer with itemized costs.
 */

import { getDb } from '../db.js';
import { sendText } from '../whatsapp.js';
import { formatRevisedBillAlert, notifyAdminsAndRiders } from '../ops-notify.js';
import {
  cartFoodPaise,
  cartTotalQty,
  dishSummaryName,
  formatLinesText,
  formatPaise,
  getOrderLines,
  lineDisplayName,
  linePaise,
  withLinePaise,
} from './cart.js';

/** Paid / packing / out + unpaid (pending pay / pre-COD) so market shortfalls can adjust the bill. */
const REVISABLE = new Set(['pending_payment', 'paid', 'preparing', 'out_for_delivery']);

function isCodOrder(order) {
  return (
    String(order?.payment_method || '') === 'cod' ||
    String(order?.paid_via || '') === 'cod_pending' ||
    (Number(order?.cod_due_paise) > 0 && !order?.cash_confirmed_at)
  );
}

/**
 * Build customer WhatsApp for a short-supply / revised bill.
 * Industry terms: short supply / revised bill / partial fulfillment.
 */
export function revisedBillMessage(order, revision) {
  const ref = order.order_ref;
  const lines = getOrderLines(order);
  const itemsBlock = formatLinesText(lines, { withPrices: true });
  const oldTotal = Number(revision?.previous_total_paise) || 0;
  const newTotal = Number(order.total_paise) || 0;
  const refund = Number(revision?.refund_paise) || 0;
  const removed = Array.isArray(revision?.removed) ? revision.removed : [];
  const reduced = Array.isArray(revision?.reduced) ? revision.reduced : [];
  const added = Array.isArray(revision?.added) ? revision.added : [];

  const changeBits = [];
  for (const r of removed) {
    changeBits.push(`❌ ${r.ordered_qty}x ${r.name} — out of stock (${formatPaise(r.line_paise)})`);
  }
  for (const r of reduced) {
    changeBits.push(
      `⚠️ ${r.name}: ${r.ordered_qty} → ${r.delivered_qty} (saved ${formatPaise(r.saved_paise)})`,
    );
  }
  for (const a of added) {
    changeBits.push(
      `➕ ${a.qty}x ${a.name} · ${formatPaise(a.unit_price_paise)}/u · ${formatPaise(a.line_paise)}`,
    );
  }

  const unpaid = order.status === 'pending_payment';
  const isCod = isCodOrder(order);

  let moneyBlock;
  if (isCod) {
    const due = formatPaise(order.cod_due_paise != null ? order.cod_due_paise : newTotal);
    moneyBlock =
      `Previous total: ${formatPaise(oldTotal)}\n` +
      `Revised total: ${formatPaise(newTotal)}\n` +
      `Pay cash on delivery: *${due}*`;
  } else if (unpaid) {
    moneyBlock =
      `Previous total: ${formatPaise(oldTotal)}\n` +
      `Revised total: *${formatPaise(newTotal)}* (pay this amount)`;
  } else if (refund > 0) {
    moneyBlock =
      `Previous total: ${formatPaise(oldTotal)}\n` +
      `Revised total: ${formatPaise(newTotal)}\n` +
      `Refund due: *${formatPaise(refund)}* (we will arrange after verification)`;
  } else if (newTotal > oldTotal) {
    moneyBlock =
      `Previous total: ${formatPaise(oldTotal)}\n` +
      `Revised total: *${formatPaise(newTotal)}* (extra items added)`;
  } else {
    moneyBlock =
      `Previous total: ${formatPaise(oldTotal)}\n` +
      `Revised total: ${formatPaise(newTotal)}`;
  }

  return (
    `Order ${ref} — revised bill 📋\n\n` +
    (changeBits.length ? `${changeBits.join('\n')}\n\n` : '') +
    `Items now:\n${itemsBlock}\n\n` +
    `${moneyBlock}\n\n` +
    `సవరించిన బిల్లు పైన ఉంది.\n` +
    `Reply HELP if you need.`
  );
}

function parseAddItems(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const added = [];
  for (let i = 0; i < list.length; i++) {
    const row = list[i] || {};
    const name = String(row.name || row.item_name || '').trim().slice(0, 80);
    if (!name) return { error: `Add-item #${i + 1}: name required` };
    const qty = Math.round(Number(row.qty));
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      return { error: `Add-item "${name}": qty must be 1–99` };
    }
    let unit = Math.round(Number(row.unit_price_paise));
    if (!Number.isFinite(unit) || unit <= 0) {
      const rupees = Number(row.unit_price_rupees ?? row.price_rupees ?? row.price);
      if (Number.isFinite(rupees) && rupees > 0) unit = Math.round(rupees * 100);
    }
    if (!Number.isFinite(unit) || unit <= 0) {
      return { error: `Add-item "${name}": price required` };
    }
    const code =
      String(row.code || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 12) || `XTRA${i + 1}`;
    added.push(
      withLinePaise({
        code,
        name,
        base_name: name,
        qty,
        unit_price_paise: unit,
        category: row.category || 'call_in',
        custom: true,
        note: 'Call-in / off-menu',
      }),
    );
  }
  return { added };
}

/**
 * Apply short supply / bill revision.
 * @param {string} orderRef
 * @param {{
 *   delivered?: Array<{ index: number, delivered_qty: number }> | Record<string, number>,
 *   add_items?: Array<{ name: string, qty: number, unit_price_paise?: number, unit_price_rupees?: number }>,
 *   notify?: boolean,
 *   note?: string
 * }} input
 */
export async function reviseOrderShortSupply(orderRef, input = {}) {
  const db = getDb();
  const ref = String(orderRef || '').trim().toUpperCase();
  const order = await db.findOrderByRef(ref);
  if (!order) return { ok: false, error: `Order ${ref} not found` };
  if (!REVISABLE.has(order.status)) {
    return {
      ok: false,
      error: `Cannot revise while status is ${order.status}`,
    };
  }

  const originalLines = getOrderLines(order);
  if (!originalLines.length && !(Array.isArray(input.add_items) && input.add_items.length)) {
    return { ok: false, error: 'Order has no items' };
  }

  const deliveredMap = new Map();
  const raw = input.delivered;
  if (Array.isArray(raw)) {
    for (const row of raw) {
      const idx = Number(row.index);
      if (!Number.isInteger(idx) || idx < 0 || idx >= originalLines.length) {
        return { ok: false, error: `Invalid line index ${row.index}` };
      }
      const q = Number(row.delivered_qty);
      if (!Number.isInteger(q) || q < 0) {
        return { ok: false, error: `Invalid delivered qty for line ${idx}` };
      }
      deliveredMap.set(idx, q);
    }
  } else if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) {
      const idx = Number(k);
      if (!Number.isInteger(idx) || idx < 0 || idx >= originalLines.length) {
        return { ok: false, error: `Invalid line index ${k}` };
      }
      const q = Number(v);
      if (!Number.isInteger(q) || q < 0) {
        return { ok: false, error: `Invalid delivered qty for line ${idx}` };
      }
      deliveredMap.set(idx, q);
    }
  } else if (originalLines.length && !(Array.isArray(input.add_items) && input.add_items.length)) {
    return { ok: false, error: 'delivered qty map required' };
  }

  const removed = [];
  const reduced = [];
  const nextItems = [];

  for (let index = 0; index < originalLines.length; index++) {
    const line = originalLines[index];
    const ordered = Number(line.qty) || 0;
    const delivered = deliveredMap.has(index) ? deliveredMap.get(index) : ordered;
    if (delivered > ordered) {
      return {
        ok: false,
        error: `Delivered qty > ordered for ${lineDisplayName(line)}`,
      };
    }
    const unit = Number(line.unit_price_paise) || 0;
    if (delivered <= 0) {
      removed.push({
        index,
        code: line.code,
        name: lineDisplayName(line),
        ordered_qty: ordered,
        delivered_qty: 0,
        line_paise: unit * ordered,
      });
      continue;
    }
    const next = withLinePaise({ ...line, qty: delivered });
    nextItems.push(next);
    if (delivered < ordered) {
      reduced.push({
        index,
        code: line.code,
        name: lineDisplayName(line),
        ordered_qty: ordered,
        delivered_qty: delivered,
        saved_paise: unit * (ordered - delivered),
      });
    }
  }

  const parsedAdd = parseAddItems(input.add_items);
  if (parsedAdd.error) return { ok: false, error: parsedAdd.error };
  const addedLines = parsedAdd.added || [];
  for (const line of addedLines) nextItems.push(line);

  if (!removed.length && !reduced.length && !addedLines.length) {
    return { ok: false, error: 'No quantities changed and no items added' };
  }
  if (!nextItems.length) {
    return {
      ok: false,
      error: 'All items removed — cancel the order instead of revising to empty',
    };
  }

  const previous_total_paise = Number(order.total_paise) || 0;
  const previous_food_paise = Number(order.food_paise) || cartFoodPaise(originalLines);
  const food_paise = cartFoodPaise(nextItems);
  const prevDiscount = Math.max(0, Number(order.discount_paise) || 0);
  const discount_paise = Math.min(prevDiscount, food_paise);
  let delivery_fee_paise = Number(order.delivery_fee_paise) || 0;
  if (order.free_delivery) delivery_fee_paise = 0;
  if (food_paise <= 0) delivery_fee_paise = 0;
  const total_paise = Math.max(0, food_paise + delivery_fee_paise - discount_paise);
  const unpaid = order.status === 'pending_payment';
  const wasCod = isCodOrder(order);
  // Online prepaid only: refund when total drops. Unpaid / COD just change what customer pays.
  const refund_paise =
    !unpaid && !wasCod ? Math.max(0, previous_total_paise - total_paise) : 0;

  const metaPatch = {
    discount_paise,
    free_delivery: Boolean(order.free_delivery),
    offers_applied: order.offers_applied || null,
    short_supply: true,
    revised_at: new Date().toISOString(),
    revised_note: String(input.note || '').trim().slice(0, 200) || null,
    refund_paise,
    previous_total_paise,
    previous_food_paise,
    original_items: order.meta?.original_items || originalLines.map((l) => withLinePaise(l)),
  };

  if (wasCod) {
    metaPatch.cod_due_paise = total_paise;
    metaPatch.payment_method = 'cod';
  }

  const revisions = Array.isArray(order.meta?.revisions) ? [...order.meta.revisions] : [];
  const revisionEntry = {
    at: metaPatch.revised_at,
    removed,
    reduced,
    added: addedLines.map((l) => ({
      code: l.code,
      name: lineDisplayName(l),
      qty: l.qty,
      unit_price_paise: l.unit_price_paise,
      line_paise: linePaise(l),
    })),
    previous_total_paise,
    new_total_paise: total_paise,
    refund_paise,
    note: metaPatch.revised_note,
  };
  revisions.push(revisionEntry);
  metaPatch.revisions = revisions;

  const first = nextItems[0];
  const patched = await db.patchOrderRevision(ref, {
    items: nextItems,
    food_paise,
    delivery_fee_paise,
    total_paise,
    qty: cartTotalQty(nextItems),
    dish_code: first.code,
    dish_name: dishSummaryName(nextItems),
    category: first.category || null,
    unit_price_paise: first.unit_price_paise,
    meta: metaPatch,
  });

  if (!patched) return { ok: false, error: 'Failed to save revision' };

  let notified = false;
  let notify_error = null;
  if (input.notify !== false && patched.phone) {
    try {
      const body = revisedBillMessage(patched, {
        previous_total_paise,
        refund_paise,
        removed,
        reduced,
        added: revisionEntry.added,
      });
      await sendText(patched.phone, body);
      notified = true;
    } catch (err) {
      notify_error = err.message || String(err);
    }
  }

  let ops_notified = false;
  let ops_notify_error = null;
  let ops_notify_detail = null;
  if (input.notify_ops !== false) {
    try {
      const opsBody = formatRevisedBillAlert(patched, {
        previous_total_paise,
        refund_paise,
        removed,
        reduced,
        added: revisionEntry.added,
        note: metaPatch.revised_note,
      });
      // Both ADMIN_PHONES always; extra RIDER_PHONES if not already admins.
      const opsRes = await notifyAdminsAndRiders(opsBody);
      ops_notified = (opsRes?.ok || []).length > 0;
      ops_notify_detail = {
        sent: (opsRes?.ok || []).length,
        failed: (opsRes?.fail || []).length,
      };
      if ((opsRes?.fail || []).length) {
        ops_notify_error = opsRes.fail.map((f) => `…${String(f.phone).slice(-4)}: ${f.error}`).join('; ');
      }
    } catch (err) {
      ops_notify_error = err.message || String(err);
      console.error('[revise] ops notify failed', ops_notify_error);
    }
  }

  return {
    ok: true,
    order: patched,
    revision: revisionEntry,
    notified,
    notify_error,
    ops_notified,
    ops_notify_error,
    ops_notify_detail,
  };
}
