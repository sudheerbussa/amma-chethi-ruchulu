import { getDb } from '../db.js';
import { config } from '../config.js';
import { sendText } from '../whatsapp.js';
import { notifyOps } from '../ops-notify.js';
import { formatInr } from '../menu.js';

const ALLOWED = {
  pending_payment: ['paid', 'cancelled'],
  paid: ['preparing', 'shipped', 'ready_for_pickup', 'delivered', 'cancelled'],
  preparing: ['shipped', 'ready_for_pickup', 'delivered', 'cancelled'],
  ready_for_pickup: ['delivered', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export function paymentThanksMessage(order) {
  const lines = [
    `Payment received — thank you!`,
    `Order *${order.order_ref}* · ${formatInr(order.total_paise)}`,
    '',
  ];
  if (order.fulfillment === 'pickup') {
    lines.push(`Pickup at: ${config.shopAddress}`);
    lines.push('We will confirm when your order is ready.');
  } else {
    lines.push(`Delivery: ${order.delivery_label || order.fulfillment}`);
    if (order.address) lines.push(order.address);
    lines.push('We will update you when it ships.');
  }
  lines.push('', `Questions? Call/WhatsApp ${config.supportPhone.replace(/^91/, '+91 ')}`);
  return lines.join('\n');
}

export async function applyOrderStatus(orderRef, nextStatus, { notifyCustomer = false, extra = {} } = {}) {
  const db = getDb();
  const order = await db.findOrderByRef(orderRef);
  if (!order) return { ok: false, error: 'Order not found' };
  const allowed = ALLOWED[order.status] || [];
  if (!allowed.includes(nextStatus) && order.status !== nextStatus) {
    return { ok: false, error: `Cannot move ${order.status} → ${nextStatus}` };
  }
  const updated = await db.updateOrderStatus(order.order_ref, nextStatus, extra);
  if (notifyCustomer && nextStatus === 'paid' && updated?.phone) {
    try {
      await sendText(updated.phone, paymentThanksMessage(updated));
    } catch (err) {
      console.error('paid thanks failed', err.message || err);
    }
  }
  if (nextStatus === 'paid') {
    notifyOps({
      title: `Paid ${updated.order_ref}`,
      text: `${updated.customer_name} (${updated.phone}) — ${formatInr(updated.total_paise)} — ${updated.fulfillment}`,
    }).catch(() => {});
  }
  return { ok: true, order: updated };
}
