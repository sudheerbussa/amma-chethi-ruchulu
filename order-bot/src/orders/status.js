import { getDb } from '../db.js';
import { config } from '../config.js';
import { sendButtons, sendCtaUrl, sendList, sendText } from '../whatsapp.js';
import { formatLinesText, formatPaise, getOrderLines, lineDisplayName } from './cart.js';
import { communityInviteBlock } from '../copy.js';
import {
  onOrderDelivered,
  referrerRewardText,
  walletDebitForOrder,
  walletRefundForOrder,
} from '../referrals.js';
import { acrSupportCallLine } from '../cutoffs.js';
import { deliveryTrackLines, resolveDeliveryTrack } from '../delivery-track.js';
import {
  formatPaidOrderAlert,
  formatCodConfirmedAlert,
  formatOutForDeliveryRiderAlert,
  notifyAdminsAndRiders,
  notifyRiders,
  orderPinLine,
} from '../ops-notify.js';

function withCommunityInvite(body) {
  return body + communityInviteBlock(config.communityInviteUrl);
}

/** Human-readable status for customers (WhatsApp). */
export function customerStatusLabel(status) {
  switch (status) {
    case 'pending_payment':
      return 'Waiting for payment';
    case 'paid':
      return 'Paid — kitchen will prepare';
    case 'preparing':
      return 'Being prepared';
    case 'out_for_delivery':
      return 'Out for delivery';
    case 'delivered':
      return 'Delivered';
    case 'cancelled':
      return 'Cancelled';
    default:
      return String(status || 'Unknown');
  }
}

export function paymentThanksMessage(order) {
  const total = formatPaise(order.total_paise);
  const items = formatLinesText(getOrderLines(order));
  const isCod =
    String(order.payment_method || '') === 'cod' ||
    String(order.paid_via || '') === 'cod_pending';
  if (isCod) {
    const due = formatPaise(order.cod_due_paise || order.total_paise);
    const pickup = String(order.fulfillment_type || '').toLowerCase() === 'pickup';
    return withCommunityInvite(
      `Order ${order.order_ref} confirmed (COD) ✅\n` +
        `${items}\n` +
        `Total: ${total}\n` +
        (pickup ? `Pay *cash at pickup* ${due}.\n` : `Pay *cash on delivery* ${due}.\n`) +
        `Kitchen will prepare your food.\n` +
        `STATUS for updates.\n` +
        acrSupportCallLine(),
    );
  }
  return withCommunityInvite(
    `Payment received for order ${order.order_ref} ✅\n` +
      `${items}\n` +
      `Total: ${total}\n` +
      `ఆర్డర్ చేసినందుకు ధన్యవాదాలు!\n` +
      `ఆర్డర్ out for delivery అయినప్పుడు అప్‌డేట్ పంపుతాము.\n` +
      acrSupportCallLine(),
  );
}

export const STATUS_FLOW = {
  pending_payment: ['paid', 'cancelled'],
  paid: ['out_for_delivery', 'cancelled', 'preparing'],
  preparing: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

function orderItems(order) {
  return getOrderLines(order);
}

function customerStatusMessage(order, status, track = null) {
  const ref = order.order_ref;
  const line = formatLinesText(getOrderLines(order));
  switch (status) {
    case 'paid':
      return paymentThanksMessage(order);
    case 'preparing':
      // No customer WhatsApp for preparing (admin may still set status)
      return null;
    case 'out_for_delivery': {
      const trackLines = deliveryTrackLines(track).join('\n');
      return (
        `Order ${ref} is out for delivery 🛵\n` +
        `${line}\n` +
        (trackLines ? `${trackLines}\n` : '') +
        `దయచేసి సిద్ధంగా ఉండండి.\n` +
        acrSupportCallLine()
      );
    }
    case 'delivered':
      return withCommunityInvite(
        `Order ${ref} delivered ✅\n` +
          `${line}\n` +
          `Thank you! / ధన్యవాదాలు! Please rate your food next.\n` +
          acrSupportCallLine(),
      );
    case 'cancelled':
      return (
        `Order ${ref} was cancelled.\n` +
        `If you already paid, we will arrange a refund after verification.\n` +
        `Reply HELP if you need.\n` +
        acrSupportCallLine()
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
 * Soft follow-up for unrated deliveries.
 * Not auto-sent on Hi (that spammed users after welcome). Rating is optional on main menu.
 * Kept for manual / future use — returns false always after design change.
 */
export async function tryNudgePendingFeedback(_phone) {
  return false;
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
  const title = `${item.qty || 1}x ${lineDisplayName(item)}`;
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
    ['hi', 'hello', 'hii', 'hey', 'start', 'menu', 'start_over', 'start over', 'status', 'my status'].includes(lower)
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
          { id: 'order', title: 'View Menu & Order' },
          { id: 'more_menu', title: 'More' },
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
    // Escape intents — don't treat as kitchen comment
    if (
      [
        'hi',
        'hello',
        'hii',
        'hey',
        'start',
        'menu',
        'help',
        'support',
        'lunch',
        'dinner',
        'status',
        'my status',
        'cancel',
        'stop',
        'reorder',
        'order again',
      ].includes(lower)
    ) {
      await deferFeedbackSession(db, phone);
      return false;
    }

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
        { id: 'order', title: 'View Menu & Order' },
        { id: 'help', title: 'Help' },
        { id: 'status', title: 'My status' },
      ],
    );
    return true;
  }

  return false;
}

/** Friend's first qualifying order delivered → referrer credit (idempotent, never blocks status). */
async function rewardReferrerOnDelivery(order) {
  try {
    const reward = await onOrderDelivered(order);
    if (!reward) return;
    console.log(
      `[referrals] reward ${reward.reward_paise} → ${reward.referrer_phone} (friend ${reward.referee_phone}, ${order.order_ref})`,
    );
    try {
      await sendText(reward.referrer_phone, referrerRewardText(reward));
    } catch (err) {
      // Outside the 24h customer window WhatsApp rejects free-form text; credit is still saved.
      console.warn('[referrals] referrer notify failed', err.message || err);
    }
  } catch (err) {
    console.error('[referrals] reward failed', order?.order_ref, err.message || err);
  }
}

/** ACR Credit used at checkout: debit when paid / COD-confirmed, give back on cancel. */
async function settleWalletForStatus(order, status) {
  try {
    if (status === 'paid') {
      const res = await walletDebitForOrder(order);
      if (res && !res.already) {
        console.log(`[wallet] debit ${res.debited_paise} on ${order.order_ref} (${order.phone})`);
        if (res.shortfall_paise > 0) {
          console.warn(`[wallet] shortfall ${res.shortfall_paise} on ${order.order_ref} — balance changed after checkout`);
        }
      }
    } else if (status === 'cancelled') {
      const res = await walletRefundForOrder(order);
      if (res) console.log(`[wallet] refund ${res.refunded_paise} on ${order.order_ref} (${res.phone})`);
    }
  } catch (err) {
    console.error('[wallet] settle failed', order?.order_ref, status, err.message || err);
  }
}

/**
 * Update order status and optionally notify customer on WhatsApp.
 */
export async function applyOrderStatus(orderRef, status, { notifyCustomer = true, notifyOps = true, extra = {} } = {}) {
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
  // Tracking fields belong in meta, not top-level order columns
  const trackOverride = {};
  if (extra.track_map_url != null) {
    trackOverride.track_map_url = String(extra.track_map_url).trim();
    delete patch.track_map_url;
  }
  if (extra.delivery_contact != null) {
    trackOverride.delivery_contact = String(extra.delivery_contact).replace(/\D/g, '');
    delete patch.delivery_contact;
  }
  if (extra.eta_minutes != null) {
    trackOverride.eta_minutes = Math.max(5, Math.round(Number(extra.eta_minutes) || 0));
    delete patch.eta_minutes;
  }

  if (status === 'paid') {
    patch.paid_at = new Date().toISOString();
  }
  if (status === 'delivered') patch.delivered_at = new Date().toISOString();

  let trackForNotify = null;
  if (status === 'out_for_delivery') {
    const deliverySettings = await db.getDeliverySettings();
    trackForNotify = resolveDeliveryTrack({
      order,
      settings: deliverySettings,
      overrides: trackOverride,
    });
    patch.out_for_delivery_at = new Date().toISOString();
    patch.track_map_url = trackForNotify.track_map_url || null;
    patch.delivery_contact = trackForNotify.delivery_contact || null;
    patch.eta_minutes = trackForNotify.eta_minutes;
  }

  const updated = await db.updateOrderStatus(order.order_ref, status, patch);
  if (status === 'delivered' && updated) void rewardReferrerOnDelivery(updated);
  if ((status === 'paid' || status === 'cancelled') && updated) await settleWalletForStatus(updated, status);

  if (notifyCustomer && updated?.phone) {
    try {
      const msg = customerStatusMessage(updated, status, trackForNotify);
      if (!msg) {
        // e.g. preparing — no customer WhatsApp
      } else if (status === 'paid') {
        await sendButtons(updated.phone, msg, [
          { id: 'status', title: 'My status' },
          { id: 'order', title: 'View Menu & Order' },
          { id: 'help', title: 'Help' },
        ]);
      } else if (status === 'out_for_delivery') {
        const mapUrl = String(trackForNotify?.track_map_url || '').trim();
        const usableMap = /^https?:\/\//i.test(mapUrl);
        try {
          if (usableMap) {
            await sendCtaUrl(
              updated.phone,
              msg,
              {
                displayText: 'Track on map',
                url: mapUrl,
              },
              { footer: 'ETA · call if needed' },
            );
          } else {
            await sendText(updated.phone, msg);
          }
        } catch (ctaErr) {
          console.error('Out-for-delivery CTA/text failed — falling back to plain text', ctaErr);
          await sendText(updated.phone, msg);
        }
        await sendButtons(updated.phone, 'Need help with this delivery?', [
          { id: 'status', title: 'My status' },
          { id: 'help', title: 'Help' },
        ]);
      } else if (status === 'delivered') {
        await sendText(updated.phone, msg);
        await startFeedbackFlow(updated);
      } else if (status === 'cancelled') {
        await sendButtons(updated.phone, msg, [
          { id: 'order', title: 'View Menu & Order' },
          { id: 'help', title: 'Help' },
          { id: 'start_over', title: 'Start over' },
        ]);
      } else {
        await sendText(updated.phone, msg);
      }
    } catch (err) {
      console.error('Customer notify failed', err);
      return {
        ok: true,
        order: updated,
        notify_error: err.message || 'Customer WhatsApp notify failed',
      };
    }
  }

  if (status === 'paid' && notifyOps && updated) {
    try {
      const via = updated.paid_via || patch.paid_via || extra.paid_via || 'payment';
      const isCodPending =
        via === 'cod_pending' ||
        (String(updated.payment_method || '') === 'cod' &&
          Number(updated.cod_due_paise) > 0);
      const body = isCodPending
        ? formatCodConfirmedAlert(updated)
        : formatPaidOrderAlert(updated, { via });
      await notifyAdminsAndRiders(body);
    } catch (err) {
      console.error('Paid order ops notify failed', err);
    }
  }

  if (status === 'out_for_delivery' && notifyOps && updated) {
    try {
      await notifyRiders(formatOutForDeliveryRiderAlert(updated));
    } catch (err) {
      console.error('Out-for-delivery rider notify failed', err);
    }
  }

  return { ok: true, order: updated };
}

/** Auto-cancel of unpaid orders is disabled — admin cancels manually only. */
export const PENDING_PAYMENT_TTL_MS = null;

/** @deprecated No-op: unpaid orders are not auto-expired. */
export async function expireStalePendingOrders() {
  return [];
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
        `${o.address}${orderPinLine(o)}`
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
        .map((i) => `${lineDisplayName(i)}: ${i.rating}/5`)
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
