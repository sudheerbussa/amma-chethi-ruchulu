import { getDb } from '../db.js';
import { config } from '../config.js';
import { sendButtons, sendList, sendText } from '../whatsapp.js';
import { formatLinesText, formatPaise, getOrderLines } from './cart.js';
import { communityInviteBlock } from '../copy.js';

function withCommunityInvite(body) {
  return body + communityInviteBlock(config.communityInviteUrl);
}

export function paymentThanksMessage(order) {
  const total = formatPaise(order.total_paise);
  const items = formatLinesText(getOrderLines(order));
  return withCommunityInvite(
    `Payment received for order ${order.order_ref} ✅\n` +
      `${items}\n` +
      `Total: ${total}\n\n` +
      `Thank you for ordering! / ఆర్డర్ చేసినందుకు ధన్యవాదాలు!\n` +
      `We'll cook with homemade (amma chethi) taste and care.\n\n` +
      `${config.businessName} — delivering soon.`,
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

function orderItems(order) {
  return getOrderLines(order);
}

function customerStatusMessage(order, status) {
  const ref = order.order_ref;
  const line = formatLinesText(getOrderLines(order));
  switch (status) {
    case 'paid':
      return paymentThanksMessage(order);
    case 'preparing':
      return (
        `Order ${ref} is being prepared 🍳\n` +
        `${line}\n` +
        `మీ ఆర్డర్ కుక్ అవుతోంది — out for delivery అయ్యాక తెలుస్తుంది.`
      );
    case 'out_for_delivery':
      return (
        `Order ${ref} is out for delivery 🛵\n` +
        `${line}\n` +
        `Please be ready to receive. / దయచేసి సిద్ధంగా ఉండండి.`
      );
    case 'delivered':
      return withCommunityInvite(
        `Order ${ref} delivered ✅\n` +
          `${line}\n` +
          `Thank you! / ధన్యవాదాలు! Please rate your food next.`,
      );
    case 'cancelled':
      return (
        `Order ${ref} was cancelled.\n` +
        `If you already paid, we will arrange a refund/credit.\n` +
        `Reply HELP for help, or start a new order.`
      );
    default:
      return `Order ${ref} updated to ${status}.`;
  }
}

/** Start dynamic feedback for only this order's items */
export async function startFeedbackFlow(order) {
  const db = getDb();
  if (!order?.phone) return false;
  if (await db.getFeedbackByOrder(order.order_ref)) return false;

  const items = orderItems(order);
  if (!items.length) return false;

  await db.updateOrderStatus(order.order_ref, order.status || 'delivered', {
    feedback_requested_at: order.feedback_requested_at || new Date().toISOString(),
  });

  await db.setSession(order.phone, {
    state: 'await_feedback_rating',
    feedback_order_ref: order.order_ref,
    feedback_index: 0,
    feedback_draft: [],
  });

  await sendItemRatingPrompt(order.phone, order.order_ref, items[0], 0, items.length);
  return true;
}

/** Resume ratings for latest delivered order still missing feedback */
export async function resumePendingFeedback(phone) {
  const db = getDb();
  const order = await db.findLatestDeliveredWithoutFeedback(phone);
  if (!order) return false;
  return startFeedbackFlow(order);
}

/**
 * One soft follow-up when customer left without rating (or typed SKIP during ratings).
 * Called on later messages (Hi / Menu / idle).
 */
export async function tryNudgePendingFeedback(phone) {
  const db = getDb();
  const session = await db.getSession(phone);
  if (String(session.state || '').startsWith('await_feedback')) return false;

  const order = await db.findLatestDeliveredWithoutFeedback(phone);
  if (!order) return false;
  if (order.feedback_nudge_sent) return false;

  await db.updateOrderStatus(order.order_ref, 'delivered', {
    feedback_nudge_sent: true,
    feedback_nudge_at: new Date().toISOString(),
  });

  await sendButtons(
    phone,
    `Quick request 🙏\n` +
      `Order ${order.order_ref} was delivered.\n` +
      `${formatLinesText(getOrderLines(order))}\n\n` +
      `A short rating helps us improve Amma-style food quality.\n` +
      `Only items you ordered — 1 minute.`,
    [
      { id: 'rate', title: 'Rate now' },
      { id: 'lunch', title: 'Order lunch' },
      { id: 'dinner', title: 'Order dinner' },
    ],
    { footer: 'Or type SKIP' },
  );
  return true;
}

async function deferFeedbackSession(db, phone) {
  const session = await db.getSession(phone);
  const orderRef = session.feedback_order_ref || null;
  await db.setSession(phone, {
    state: 'idle',
    feedback_order_ref: null,
    feedback_index: null,
    feedback_draft: null,
    pending_feedback_ref: orderRef || session.pending_feedback_ref || null,
  });
  return orderRef;
}

async function sendItemRatingPrompt(phone, orderRef, item, index, total) {
  const title = `${item.qty || 1}x ${item.name || item.code}`;
  await sendList(phone, {
    header: 'Rate your food',
    body:
      `Order ${orderRef} delivered ✅\n\n` +
      `Please rate only what you ordered:\n` +
      `(${index + 1}/${total}) ${title}\n\n` +
      `1 = needs work · 5 = excellent`,
    button: 'Rate this item',
    footer: 'Your feedback improves our kitchen',
    sections: [
      {
        title: 'Your rating',
        rows: [
          { id: 'rate_5', title: '5 — Excellent', description: title.slice(0, 72) },
          { id: 'rate_4', title: '4 — Very good', description: title.slice(0, 72) },
          { id: 'rate_3', title: '3 — OK', description: title.slice(0, 72) },
          { id: 'rate_2', title: '2 — Needs work', description: title.slice(0, 72) },
          { id: 'rate_1', title: '1 — Poor', description: title.slice(0, 72) },
        ],
      },
    ],
  });
}

/**
 * Handle rating + optional comment in customer handler.
 * @returns {Promise<boolean>} true if handled
 */
export async function tryHandleFeedbackReply({ phone, text }) {
  const db = getDb();
  const session = await db.getSession(phone);
  const raw = String(text || '').trim();
  const lower = raw.toLowerCase();
  const inFeedback = String(session.state || '').startsWith('await_feedback');

  // Leaving feedback mid-flow (Hi/Menu) — park and allow later RATE / one nudge
  if (
    inFeedback &&
    ['hi', 'hello', 'hii', 'hey', 'start', 'menu', 'status', 'my status'].includes(lower)
  ) {
    await deferFeedbackSession(db, phone);
    return false;
  }

  // Explicit rate / re-open from nudge button
  if (lower === 'rate' || lower === 'rate now' || lower === 'feedback') {
    const started = await resumePendingFeedback(phone);
    if (!started) {
      await sendText(phone, 'No delivered order waiting for a rating. Thank you!');
    }
    return true;
  }

  if (session.state === 'await_feedback_rating') {
    // Customer skips rating for now — we follow up once later
    if (['skip', 'later', 'not now'].includes(lower)) {
      const ref = await deferFeedbackSession(db, phone);
      await sendButtons(
        phone,
        ref
          ? `No problem — you can rate order ${ref} anytime.\nReply RATE when ready.`
          : 'No problem. Reply RATE anytime after delivery.',
        [
          { id: 'lunch', title: 'Order lunch' },
          { id: 'dinner', title: 'Order dinner' },
          { id: 'help', title: 'Help' },
        ],
      );
      return true;
    }

    const m = lower.match(/^rate_([1-5])$/);
    const rating = m ? Number(m[1]) : Number(raw);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      await sendText(
        phone,
        'Please rate 1–5 using the list (or type a number 1 to 5).\nType SKIP to rate later.',
      );
      return true;
    }

    const order = await db.findOrderByRef(session.feedback_order_ref);
    if (!order) {
      await db.setSession(phone, { state: 'idle', feedback_order_ref: null, feedback_index: null, feedback_draft: null });
      await sendText(phone, 'Feedback session expired. Thank you!');
      return true;
    }

    const items = orderItems(order);
    const idx = Number(session.feedback_index) || 0;
    const item = items[idx];
    const draft = Array.isArray(session.feedback_draft) ? [...session.feedback_draft] : [];
    draft.push({
      code: item?.code,
      name: item?.name,
      qty: item?.qty,
      rating,
    });

    if (idx + 1 < items.length) {
      await db.setSession(phone, {
        state: 'await_feedback_rating',
        feedback_index: idx + 1,
        feedback_draft: draft,
      });
      await sendItemRatingPrompt(phone, order.order_ref, items[idx + 1], idx + 1, items.length);
      return true;
    }

    await db.setSession(phone, {
      state: 'await_feedback_comment',
      feedback_draft: draft,
    });
    await sendText(
      phone,
      `Thanks for the ratings!\n\n` +
        `Any short comment for the kitchen?\n` +
        `(taste, spice, quantity, packing…)\n\n` +
        `Type your comment, or type SKIP.`,
    );
    return true;
  }

  if (session.state === 'await_feedback_comment') {
    const orderRef = session.feedback_order_ref;
    const order = await db.findOrderByRef(orderRef);
    const comment = lower === 'skip' || lower === 'no' ? '' : raw.slice(0, 500);
    const items = Array.isArray(session.feedback_draft) ? session.feedback_draft : [];

    if (order) {
      await db.saveFeedback({
        order_ref: order.order_ref,
        phone,
        meal: order.meal,
        items,
        comment,
        average_rating:
          items.length
            ? Number(
                (
                  items.reduce((s, i) => s + Number(i.rating || 0), 0) / items.length
                ).toFixed(2),
              )
            : null,
      });
      await db.updateOrderStatus(order.order_ref, 'delivered', {
        feedback_at: new Date().toISOString(),
      });
    }

    await db.setSession(phone, {
      state: 'idle',
      feedback_order_ref: null,
      feedback_index: null,
      feedback_draft: null,
    });

    await sendButtons(
      phone,
      withCommunityInvite(
        `Thank you for your feedback! 🙏\n` +
          `It helps us improve Amma-style food quality.\n\n` +
          `We hope to serve you again soon.`,
      ),
      [
        { id: 'lunch', title: 'Order lunch' },
        { id: 'dinner', title: 'Order dinner' },
        { id: 'status', title: 'My status' },
      ],
    );
    return true;
  }

  return false;
}

/**
 * Update order status and optionally notify customer on WhatsApp.
 */
export async function applyOrderStatus(orderRef, status, { notifyCustomer = true, extra = {} } = {}) {
  const db = getDb();
  const order = await db.findOrderByRef(orderRef);
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
  if (status === 'paid') {
    patch.paid_at = new Date().toISOString();
    if (Array.isArray(order.items) && order.items.length) {
      for (const it of order.items) await db.adjustStock(it.code || it.dish_code, it.qty || 1);
    } else {
      await db.adjustStock(order.dish_code, order.qty);
    }
  }
  if (status === 'cancelled' && ['paid', 'preparing', 'out_for_delivery'].includes(order.status)) {
    if (Array.isArray(order.items) && order.items.length) {
      for (const it of order.items) await db.adjustStock(it.code || it.dish_code, -(it.qty || 1));
    } else {
      await db.adjustStock(order.dish_code, -(order.qty || 0));
    }
  }
  if (status === 'delivered') patch.delivered_at = new Date().toISOString();

  const updated = await db.updateOrderStatus(order.order_ref, status, patch);

  if (notifyCustomer && updated?.phone) {
    try {
      const msg = customerStatusMessage(updated, status);
      if (status === 'paid') {
        await sendButtons(updated.phone, msg, [
          { id: 'status', title: 'My status' },
          { id: 'lunch', title: 'Order lunch' },
          { id: 'dinner', title: 'Order dinner' },
        ]);
      } else if (status === 'delivered') {
        await sendText(updated.phone, msg);
        await startFeedbackFlow(updated);
      } else if (status === 'cancelled') {
        await sendButtons(updated.phone, msg, [
          { id: 'help', title: 'Help' },
          { id: 'lunch', title: 'Lunch' },
          { id: 'dinner', title: 'Dinner' },
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
        `${formatLinesText(getOrderLines(o))} · ${total} (del ${fee})\n` +
        `${o.customer_name ? o.customer_name + ' · ' : ''}${o.phone}\n` +
        `${o.address}`
      );
    })
    .join('\n\n---\n\n');
}

export function formatFeedbackList(rows) {
  if (!rows.length) return 'No feedback yet.';
  return rows
    .slice(0, 15)
    .map((f) => {
      const items = (f.items || [])
        .map((i) => `${i.name || i.code}: ${i.rating}/5`)
        .join(', ');
      return (
        `${f.order_ref} · avg ${f.average_rating ?? '—'}/5\n` +
        `${items || '—'}\n` +
        (f.comment ? `“${f.comment}”\n` : '') +
        `${f.phone} · ${f.created_at}`
      );
    })
    .join('\n\n---\n\n');
}
