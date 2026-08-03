import { getDb } from '../db.js';
import { config } from '../config.js';
import { sendButtons, sendText } from '../whatsapp.js';

function formatPaise(paise) {
  return `₹${(paise / 100).toFixed(0)}`;
}

export function paymentThanksMessage(order) {
  const total = formatPaise(order.total_paise);
  return (
    `Payment received for order ${order.order_ref} ✅\n` +
    `${order.qty}x ${order.dish_name} — ${total}\n\n` +
    `Order చేసినందుకు ధన్యవాదాలు!\n` +
    `మీ ఫుడ్‌ను పూర్తిగా హోమ్ మేడ్ (అమ్మ చేతి) టేస్ట్‌తో, ` +
    `అంతేకాక శుభ్రతతో కుక్ చేసి మీకు అందిస్తాం.\n\n` +
    `Thank you for ordering from ${config.businessName}. ` +
    `We'll cook with homemade taste and care, and deliver soon.`
  );
}

export const STATUS_FLOW = {
  pending_payment: ['paid', 'cancelled'],
  paid: ['preparing', 'cancelled'],
  preparing: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

function customerStatusMessage(order, status) {
  const ref = order.order_ref;
  const line = `${order.qty}x ${order.dish_name}`;
  switch (status) {
    case 'paid':
      return paymentThanksMessage(order);
    case 'preparing':
      return `Order ${ref} is being prepared 🍳\n${line}\nWe'll notify you when it's out for delivery.`;
    case 'out_for_delivery':
      return `Order ${ref} is out for delivery 🛵\n${line}\nPlease be ready to receive.`;
    case 'delivered':
      return `Order ${ref} delivered ✅\n${line}\nThank you! Reply Menu to order again.`;
    case 'cancelled':
      return `Order ${ref} was cancelled.\nIf you already paid, we will arrange a refund/credit. Reply Menu for help.`;
    default:
      return `Order ${ref} updated to ${status}.`;
  }
}

/**
 * Update order status and optionally notify customer on WhatsApp.
 * @returns {{ ok: boolean, order?: object, error?: string }}
 */
export async function applyOrderStatus(orderRef, status, { notifyCustomer = true, extra = {} } = {}) {
  const db = getDb();
  const order = db.findOrderByRef(orderRef);
  if (!order) return { ok: false, error: `Order ${orderRef} not found` };

  const allowed = STATUS_FLOW[order.status] || [];
  if (order.status === status) return { ok: true, order, skipped: true };
  if (!allowed.includes(status)) {
    return {
      ok: false,
      error: `Cannot move ${order.order_ref} from ${order.status} → ${status}`,
      order,
    };
  }

  const patch = { ...extra };
  if (status === 'paid') patch.paid_at = new Date().toISOString();
  const updated = db.updateOrderStatus(order.order_ref, status, patch);

  if (notifyCustomer && updated?.phone) {
    try {
      const msg = customerStatusMessage(updated, status);
      if (status === 'paid' || status === 'delivered') {
        await sendButtons(updated.phone, msg, [
          { id: 'menu', title: 'Full menu' },
          { id: 'lunch', title: 'Order lunch' },
          { id: 'dinner', title: 'Order dinner' },
        ]);
      } else {
        await sendText(updated.phone, msg);
      }
    } catch (err) {
      console.error('Customer notify failed', err);
    }
  }

  return { ok: true, order: updated };
}

export function formatOrdersList(orders) {
  if (!orders.length) return 'No orders yet.';
  return orders
    .slice(0, 20)
    .map((o) => {
      const total = formatPaise(o.total_paise);
      const fee = o.delivery_fee_paise != null ? formatPaise(o.delivery_fee_paise) : '—';
      return (
        `${o.order_ref} · ${o.status}\n` +
        `${o.qty}x ${o.dish_name} · ${total} (del ${fee})\n` +
        `${o.phone}\n` +
        `${o.address}`
      );
    })
    .join('\n\n---\n\n');
}
