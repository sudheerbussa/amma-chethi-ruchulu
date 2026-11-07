/** Admin / rider WhatsApp alerts and delivery pin helpers. */

import { config } from './config.js';
import { sendText } from './whatsapp.js';
import { mapsUrlFromLatLng } from './geo.js';
import { mealTitle } from './cutoffs.js';
import { formatLinesText, formatPaise, getOrderLines } from './orders/cart.js';

export function orderPinCoords(order) {
  if (!order) return null;
  const lat = Number(order.delivery_lat);
  const lng = Number(order.delivery_lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function orderPinUrl(order) {
  const coords = orderPinCoords(order);
  return coords ? mapsUrlFromLatLng(coords.lat, coords.lng) : null;
}

/** WhatsApp / kitchen alert line when a map pin exists on the order. */
export function orderPinLine(order) {
  const url = orderPinUrl(order);
  return url ? `\n📍 Pin: ${url}` : '';
}

function uniquePhones(lists) {
  const set = new Set();
  for (const list of lists) {
    for (const p of list || []) {
      const digits = String(p || '').replace(/\D/g, '');
      if (digits) set.add(digits);
    }
  }
  return [...set];
}

export function isRiderPhone(phone) {
  const p = String(phone || '').replace(/\D/g, '');
  if (!p || !(config.riderPhones || []).length) return false;
  return config.riderPhones.some((r) => p === r || p.endsWith(r) || r.endsWith(p));
}

async function sendOpsText(phones, body) {
  const list = phones || [];
  if (!list.length) return;
  // Parallel WhatsApp sends — sequential Graph calls made checkout feel stuck.
  await Promise.allSettled(
    list.map(async (phone) => {
      try {
        await sendText(phone, body);
      } catch (err) {
        console.error('Ops notify failed', phone, err?.message || err);
      }
    }),
  );
}

export async function notifyAdmins(body) {
  await sendOpsText(config.adminPhones || [], body);
}

export async function notifyRiders(body) {
  await sendOpsText(config.riderPhones || [], body);
}

/** Admins + riders (same number receives one message). */
export async function notifyAdminsAndRiders(body) {
  await sendOpsText(uniquePhones([config.adminPhones, config.riderPhones]), body);
}

export function formatUnpaidOrderAlert(order) {
  const items = getOrderLines(order);
  const who = order.customer_name ? `${order.customer_name} · ` : '';
  const discount = Number(order.discount_paise) || 0;
  return (
    `🛒 New order (unpaid)\n` +
    `${order.order_ref} · ${mealTitle(order.meal)} · ${order.service_label || order.service_date || ''}\n` +
    `${who}${order.phone}\n` +
    `${formatLinesText(items)}\n` +
    `Food ${formatPaise(order.food_paise ?? 0)}` +
    (discount > 0 ? ` · −${formatPaise(discount)}` : '') +
    ` · Del ${formatPaise(order.delivery_fee_paise ?? 0)}\n` +
    `Total ${formatPaise(order.total_paise)}\n` +
    `${order.address || '—'}${orderPinLine(order)}\n` +
    `Waiting for payment — check admin if stuck.`
  );
}

/** Customer chose COD — kitchen can cook, but cash is still due at door/pickup. */
export function formatCodConfirmedAlert(order) {
  const items = getOrderLines(order);
  const who = order.customer_name ? `${order.customer_name} · ` : '';
  const due = Math.max(
    0,
    Math.round(Number(order.cod_due_paise) || Number(order.total_paise) || 0),
  );
  const pickup =
    String(order.fulfillment_type || order.meta?.fulfillment_type || '').toLowerCase() ===
    'pickup';
  return (
    `💵 COD confirmed (cash not collected yet)\n` +
    `${order.order_ref} · ${mealTitle(order.meal)} · ${order.service_label || order.service_date || ''}\n` +
    `${who}${order.phone}\n` +
    `${formatLinesText(items)}\n` +
    `Total ${formatPaise(order.total_paise)}\n` +
    `Collect ${formatPaise(due)} ${pickup ? 'at pickup' : 'on delivery'}\n` +
    `${order.address || '—'}${orderPinLine(order)}\n` +
    `Ready for kitchen — do not treat as online paid.`
  );
}

export function formatPaidOrderAlert(order, { via = 'payment' } = {}) {
  // COD confirm used to reuse this helper and wrongly said "✅ Order paid".
  if (via === 'cod_pending' || String(order.payment_method || '') === 'cod') {
    const due = Number(order.cod_due_paise) || 0;
    if (due > 0 || via === 'cod_pending') return formatCodConfirmedAlert(order);
  }
  const items = getOrderLines(order);
  const who = order.customer_name ? `${order.customer_name} · ` : '';
  const viaLabel =
    via === 'razorpay'
      ? 'Razorpay'
      : via === 'admin'
        ? 'Admin'
        : via === 'whatsapp_paid'
          ? 'WhatsApp PAID'
          : 'Payment';
  return (
    `✅ Order paid (${viaLabel})\n` +
    `${order.order_ref} · ${mealTitle(order.meal)} · ${order.service_label || order.service_date || ''}\n` +
    `${who}${order.phone}\n` +
    `${formatLinesText(items)}\n` +
    `Total ${formatPaise(order.total_paise)}\n` +
    `${order.address || '—'}${orderPinLine(order)}\n` +
    `Ready for kitchen / delivery.`
  );
}

export function formatOrderKitchenPackLine(order) {
  const svc = order.service_label || order.service_date;
  return (
    `${order.order_ref} · ${formatLinesText(getOrderLines(order))}\n` +
    `${order.phone}\n${order.address || '—'}${orderPinLine(order)}\n` +
    `Pay ${formatPaise(order.total_paise)} · ${order.status}` +
    (svc ? `\nService: ${svc}` : '')
  );
}

/** Rider delivery brief — manual send or out-for-delivery alert. */
export function formatRiderDeliveryAlert(order, { heading = '🛵 Delivery' } = {}) {
  const items = getOrderLines(order);
  const who = order.customer_name ? `${order.customer_name} · ` : '';
  const svc = order.service_label || order.service_date;
  const due = Number(order.cod_due_paise) || 0;
  const prepaid = Number(order.prepaid_paise);
  const prepaidAmt = Number.isFinite(prepaid) ? prepaid : Math.max(0, (Number(order.total_paise) || 0) - due);
  let money =
    `Total ${formatPaise(order.total_paise)}`;
  if (due > 0) {
    money += `\nAlready paid ${formatPaise(prepaidAmt)}\n💵 Collect cash (COD) ${formatPaise(due)}`;
  } else {
    money += ' · prepaid (no cash)';
  }
  return (
    `${heading}\n` +
    `${order.order_ref} · ${mealTitle(order.meal)}` +
    (svc ? ` · ${svc}` : '') +
    `\n${who}${order.phone}\n` +
    `${formatLinesText(items)}\n` +
    `${order.address || '—'}${orderPinLine(order)}\n` +
    `${money} · ${order.status || '—'}`
  );
}

export function formatOutForDeliveryRiderAlert(order) {
  return formatRiderDeliveryAlert(order, { heading: '🛵 Out for delivery — deliver now' });
}

export async function sendOrderToRiders(order) {
  if (!(config.riderPhones || []).length) {
    throw new Error('No RIDER_PHONES configured');
  }
  const body = formatRiderDeliveryAlert(order, { heading: '🛵 Delivery details' });
  await notifyRiders(body);
  return config.riderPhones.length;
}
