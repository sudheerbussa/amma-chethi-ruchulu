import { getDb } from '../db.js';
import { config } from '../config.js';
import { sendText } from '../whatsapp.js';
import { isOrderingIntent, websiteOrderReply } from '../website-only.js';
import { formatInr } from '../menu.js';

function statusLabel(status) {
  const map = {
    pending_payment: 'Waiting for payment',
    paid: 'Paid — being prepared',
    preparing: 'Being prepared',
    ready_for_pickup: 'Ready for pickup',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  };
  return map[status] || status;
}

export async function handleIncoming(msg) {
  const phone = String(msg.from || '').replace(/\D/g, '');
  const text = String(msg.text || '').trim();
  if (!phone) return;

  try {
    await getDb().logMessage({ phone, direction: 'in', body: text });
  } catch {
    /* ignore */
  }

  const upper = text.toUpperCase();
  if (/^HELP\b/.test(upper) || /^HI\b/.test(upper) || /^HELLO\b/.test(upper) || text === '') {
    await sendText(
      phone,
      [
        `Welcome to ${config.businessName}.`,
        'Decorative Lights are available on our shop:',
        websiteOrderReply().split('\n')[1],
        '',
        'Commands: HELP · STATUS <order-id> · ORDER',
      ].join('\n'),
    );
    return;
  }

  if (/^STATUS\b/.test(upper)) {
    const ref = upper.replace(/^STATUS\s*/, '').trim();
    if (!ref) {
      await sendText(phone, 'Send STATUS followed by your order id, e.g. STATUS RUE261021-001');
      return;
    }
    const order = await getDb().findOrderByRef(ref);
    if (!order || String(order.phone).replace(/\D/g, '') !== phone) {
      await sendText(phone, `No order found for ${ref} on this number.`);
      return;
    }
    await sendText(
      phone,
      [
        `Order *${order.order_ref}*`,
        statusLabel(order.status),
        `Total: ${formatInr(order.total_paise)}`,
        order.fulfillment === 'pickup' ? 'Pickup at Bhor shop' : `Delivery: ${order.delivery_label || ''}`,
      ]
        .filter(Boolean)
        .join('\n'),
    );
    return;
  }

  if (isOrderingIntent(text) || /^ORDER\b/.test(upper) || /^BUY\b/.test(upper)) {
    await sendText(phone, websiteOrderReply());
    return;
  }

  await sendText(
    phone,
    [
      'Thanks for messaging Rare & Unique Electronics.',
      websiteOrderReply(),
    ].join('\n\n'),
  );
}
