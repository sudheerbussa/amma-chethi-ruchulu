/**
 * Shared customer feedback + help ticket helpers (WhatsApp + web storefront).
 */

import { config } from '../config.js';
import { getDb } from '../db.js';
import { notifyAdmins } from '../ops-notify.js';
import { formatLinesText, getOrderLines, lineDisplayName } from './cart.js';

export const HELP_TOPICS = [
  { id: 'payment', title: 'Payment failed / paid', hint: 'Paid but not confirmed, UPI issues' },
  { id: 'cancel_unpaid', title: 'Cancel unpaid order', hint: 'Remove order before you pay' },
  { id: 'refund', title: 'Refund / paid order', hint: 'Already paid — refund or stop delivery' },
  { id: 'status', title: 'Order / delivery status', hint: 'Where is my order?' },
  { id: 'other', title: 'Other issue', hint: 'Address, quality, packing…' },
];

export function normalizeHelpTopic(raw) {
  const map = {
    help_payment: 'payment',
    help_cancel: 'cancel_unpaid',
    help_refund: 'refund',
    help_status: 'status',
    help_other: 'other',
    payment: 'payment',
    cancel_unpaid: 'cancel_unpaid',
    refund: 'refund',
    cancelled: 'refund',
    status: 'status',
    other: 'other',
    payment_claim: 'payment_claim',
  };
  return map[String(raw || '').toLowerCase()] || 'other';
}

/**
 * Save overall order feedback (single rating + optional comment).
 * Keeps optional items[] for admin display of what was ordered (not per-item scores).
 */
export async function saveOrderFeedback({
  orderRef,
  phone,
  rating,
  comment = '',
  tags = [],
}) {
  const db = getDb();
  const ref = String(orderRef || '').trim().toUpperCase();
  if (!ref) return { ok: false, error: 'Order ref required' };

  const order = await db.findOrderByRef(ref);
  if (!order) return { ok: false, error: 'Order not found' };

  let p = String(phone || order.phone || '').replace(/\D/g, '');
  if (p.length === 10) p = `91${p}`;
  const orderPhone = String(order.phone || '').replace(/\D/g, '');
  if (p && orderPhone && p !== orderPhone) {
    return { ok: false, error: 'Phone does not match this order' };
  }

  if (await db.getFeedbackByOrder(ref)) {
    return { ok: false, error: 'Feedback already submitted for this order', already: true };
  }

  const stars = Math.round(Number(rating));
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return { ok: false, error: 'Rating must be 1–5' };
  }

  const lines = getOrderLines(order);
  const items = lines.map((i) => ({
    code: i.code,
    name: lineDisplayName(i),
    qty: i.qty,
    rating: stars,
  }));

  const tagList = (Array.isArray(tags) ? tags : [])
    .map((t) => String(t || '').trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 8);

  await db.saveFeedback({
    order_ref: ref,
    phone: order.phone || p || null,
    meal: order.meal || 'fresh',
    items,
    comment: String(comment || '').trim().slice(0, 500),
    tags: tagList,
    average_rating: stars,
    source: 'web',
  });

  try {
    await db.updateOrderStatus(ref, order.status || 'delivered', {
      feedback_at: new Date().toISOString(),
    });
  } catch {
    /* non-fatal */
  }

  return { ok: true, order_ref: ref, average_rating: stars };
}

export async function createHelpTicket({
  phone,
  topic,
  message,
  orderRef = null,
  source = 'web',
}) {
  const db = getDb();
  let p = String(phone || '').replace(/\D/g, '');
  if (p.length === 10) p = `91${p}`;
  if (p.length < 12) return { ok: false, error: 'Valid WhatsApp number required' };

  const topicId = normalizeHelpTopic(topic);
  const pending = await db.findLatestPendingOrder(p);
  const latest = await db.findLatestOrder(p);
  let ref = String(orderRef || '').trim().toUpperCase() || null;
  if (ref) {
    const o = await db.findOrderByRef(ref);
    if (!o || String(o.phone || '').replace(/\D/g, '') !== p) {
      return { ok: false, error: 'Order not found for this number' };
    }
  } else {
    ref = pending?.order_ref || latest?.order_ref || null;
  }

  const order = ref ? await db.findOrderByRef(ref) : null;
  const msg = String(message || '').trim().slice(0, 800);
  if (msg.length < 3) return { ok: false, error: 'Please describe the issue (a few words)' };

  const ticket = await db.saveHelpTicket({
    phone: p,
    topic: topicId,
    message: msg,
    order_ref: ref,
    order_status: order?.status || pending?.status || latest?.status || null,
    source,
  });

  try {
    await notifyAdmins(
      `HELP #${ticket.id} · ${topicId} (${source})\n` +
        `From: ${p}\n` +
        (ref ? `Order: ${ref} (${ticket.order_status || '—'})\n` : '') +
        `Msg: ${ticket.message}\n\n` +
        `Reply on WhatsApp to the customer number.`,
    );
  } catch (err) {
    console.error('[help] admin notify failed', err?.message || err);
  }

  return {
    ok: true,
    ticket_id: ticket.id,
    topic: topicId,
    order_ref: ref,
    support_phone: config.supportPhone,
    support_display: `+${config.supportPhone}`,
  };
}

export function feedbackContextForOrder(order) {
  if (!order) return null;
  const lines = getOrderLines(order);
  return {
    order_ref: order.order_ref,
    status: order.status,
    service_label: order.service_label || order.service_date,
    items_text: formatLinesText(lines),
    items: lines.map((i) => ({
      code: i.code,
      name: lineDisplayName(i),
      qty: i.qty,
    })),
    total_paise: order.total_paise,
  };
}
