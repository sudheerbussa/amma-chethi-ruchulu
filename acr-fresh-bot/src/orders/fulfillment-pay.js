/**
 * Customer payment + fulfillment helpers (COD / pickup).
 */

import { getDb } from '../db.js';
import { applyOrderStatus } from '../orders/status.js';
import { formatPaise } from '../orders/cart.js';
import { sendButtons, sendText } from '../whatsapp.js';

export function isPickupSession(session) {
  return String(session?.fulfillment_type || '').toLowerCase() === 'pickup';
}

/** Zero delivery fee for kitchen pickup. */
export function applyPickupPricing(pricing, foodPaise) {
  const discount = Math.max(0, Number(pricing.discount_paise) || 0);
  const food = Math.max(0, Math.round(Number(foodPaise) || 0));
  return {
    ...pricing,
    delivery_fee_paise: 0,
    total_paise: Math.max(0, food - discount),
    zone_id: 'pickup',
    delivery_label: 'Pickup (no delivery fee)',
    delivery_mode: 'pickup',
  };
}

export async function confirmCustomerCod(orderRef) {
  const db = getDb();
  const order = await db.findOrderByRef(orderRef);
  if (!order) return { ok: false, error: 'Order not found.' };
  if (order.status !== 'pending_payment') {
    return { ok: false, error: `Order is already ${order.status}.` };
  }
  const total = Math.max(0, Math.round(Number(order.total_paise) || 0));
  return applyOrderStatus(order.order_ref, 'paid', {
    extra: {
      payment_method: 'cod',
      cod_due_paise: total,
      prepaid_paise: 0,
      paid_via: 'cod_pending',
      fulfillment_type: order.fulfillment_type || order.meta?.fulfillment_type || 'delivery',
      cod_allowed_at: new Date().toISOString(),
      cod_allowed_by: 'customer',
      cash_confirmed_at: null,
      cod_collected_paise: null,
    },
  });
}

export function orderHasOpenCod(order) {
  return Number(order?.cod_due_paise) > 0 && !order?.cash_confirmed_at;
}

export function orderAcceptsOnlinePayment(order) {
  if (!order) return false;
  if (order.status === 'pending_payment') return true;
  if (
    orderHasOpenCod(order) &&
    ['paid', 'preparing', 'out_for_delivery'].includes(order.status)
  ) {
    return true;
  }
  return false;
}

export function onlinePaymentAmountPaise(order) {
  if (orderHasOpenCod(order)) {
    return Math.max(0, Math.round(Number(order.cod_due_paise) || Number(order.total_paise) || 0));
  }
  return Math.max(0, Math.round(Number(order.total_paise) || 0));
}

export async function sendCodConfirmedMessage(phone, order) {
  const due = Math.max(0, Number(order.cod_due_paise) || Number(order.total_paise) || 0);
  const pickup =
    String(order.fulfillment_type || order.meta?.fulfillment_type || '').toLowerCase() ===
    'pickup';
  const when = pickup
    ? `Pay *cash at pickup* ${formatPaise(due)}.`
    : `Pay *cash on delivery* ${formatPaise(due)}.`;
  await sendText(
    phone,
    `✅ Order ${order.order_ref} confirmed (COD).\n` +
      `${when}\n` +
      `Kitchen will prepare your food.\n` +
      `Track anytime: STATUS`,
  );
  await sendButtons(phone, 'Need anything else?', [
    { id: 'status', title: 'My status' },
    { id: 'help', title: 'Help' },
    { id: 'start_over', title: 'Start over' },
  ]);
}
