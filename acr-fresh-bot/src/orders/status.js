import { getDb } from '../db.js';
import { config } from '../config.js';
import { sendButtons, sendCtaUrl, sendText } from '../whatsapp.js';
import { formatLinesText, formatPaise, getOrderLines, lineDisplayName } from './cart.js';
import { communityInviteBlock } from '../copy.js';
import {
  onOrderDelivered,
  referrerRewardText,
  walletDebitForOrder,
  walletRefundForOrder,
} from '../referrals.js';
import { deliveryTrackLines, resolveDeliveryTrack } from '../delivery-track.js';
import {
  formatPaidOrderAlert,
  formatCodConfirmedAlert,
  formatOutForDeliveryRiderAlert,
  notifyAdminsAndRiders,
  notifyRiders,
  orderPinLine,
} from '../ops-notify.js';
import { storefrontFeedbackUrl } from '../storefront/link.js';
import { saveOrderFeedback } from './customer-support.js';

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

function isCodOrder(order) {
  return String(order?.payment_method || '') === 'cod' || String(order?.paid_via || '') === 'cod_pending';
}

/** Riders have back-to-back drops — ask customers not to hold them at the door. */
export function riderCooperationNote(order) {
  return (
    `🙏 *Delivery partner కి సహకరించండి*\n` +
    (isCodOrder(order) ? `• Cash / UPI ముందే సిద్ధంగా ఉంచండి.\n` : '') +
    `• Items తీసుకుని రైడర్‌ని ఎక్కువసేపు వేచి ఉంచకండి — ఇతర customers orders ఆలస్యం అవుతాయి.\n` +
    `• ఏదైనా item quality సరిగా లేకపోతే photo తో WhatsApp చేయండి — replace / refund చేస్తాం.`
  );
}

export function paymentThanksMessage(order) {
  const total = formatPaise(order.total_paise);
  const items = formatLinesText(getOrderLines(order), { withPrices: true });
  if (isCodOrder(order)) {
    const due = formatPaise(order.cod_due_paise || order.total_paise);
    return withCommunityInvite(
      `Order ${order.order_ref} confirmed (COD) ✅\n` +
        `${items}\n` +
        `Total: ${total}\n` +
        `Pay *cash on delivery* ${due}.\n` +
        `STATUS for updates.\n\n` +
        riderCooperationNote(order),
    );
  }
  return withCommunityInvite(
    `Payment received for order ${order.order_ref} ✅\n` +
      `${items}\n` +
      `Total: ${total}\n` +
      `ఆర్డర్ చేసినందుకు ధన్యవాదాలు!\n` +
      `ఆర్డర్ out for delivery అయినప్పుడు అప్‌డేట్ పంపుతాము.\n\n` +
      riderCooperationNote(order),
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
        `దయచేసి సిద్ధంగా ఉండండి.\n\n` +
        riderCooperationNote(order)
      );
    }
    case 'delivered':
      return withCommunityInvite(
        `Order ${ref} delivered ✅\n` +
          `${line}\n` +
          `Thank you! / ధన్యవాదాలు!\n` +
          `Quick rating on the website helps us improve — tap the button next.`,
      );
    case 'cancelled':
      return (
        `Order ${ref} was cancelled.\n` +
        `If you already paid, we will arrange a refund after verification.\n` +
        `Reply HELP if you need.`
      );
    default:
      return `Order ${ref} updated to ${status}.`;
  }
}

/**
 * Send web feedback CTA (overall rating — not per-item WhatsApp lists).
 */
export async function startFeedbackFlow(order) {
  const db = getDb();
  if (!order?.phone) return false;
  if (await db.getFeedbackByOrder(order.order_ref)) return false;

  const items = orderItems(order);
  if (!items.length && !order.order_ref) return false;

  try {
    await db.updateOrderStatus(order.order_ref, order.status || 'delivered', {
      feedback_requested_at: order.feedback_requested_at || new Date().toISOString(),
    });
  } catch {
    /* ignore */
  }

  const url = storefrontFeedbackUrl(order.phone, order.order_ref);
  await sendCtaUrl(
    order.phone,
    `Order ${order.order_ref} — quick feedback ⭐\n\n` +
      `One overall rating (1–5) + optional comment on the website.\n` +
      `Takes ~20 seconds.`,
    { displayText: 'Rate on website', url },
    { footer: 'Thank you' },
  );
  return true;
}

/** Resume feedback for latest delivered order still missing feedback */
export async function resumePendingFeedback(phone) {
  const db = getDb();
  const order = await db.findLatestDeliveredWithoutFeedback(phone);
  if (!order) return false;
  return startFeedbackFlow(order);
}

/**
 * Soft follow-up for unrated deliveries — disabled (no auto spam).
 */
export async function tryNudgePendingFeedback(_phone) {
  return false;
}

/**
 * RATE / legacy mid-flow replies → always send web feedback link (no per-item WA lists).
 * @returns {Promise<boolean>} true if handled
 */
export async function tryHandleFeedbackReply({ phone, text }) {
  const db = getDb();
  const session = await db.getSession(phone);
  const raw = String(text || '').trim();
  const lower = raw.toLowerCase();
  const inFeedback = String(session.state || '').startsWith('await_feedback');

  // Clear any stuck old per-item WA feedback session
  if (inFeedback) {
    await db.setSession(phone, {
      state: 'idle',
      feedback_order_ref: null,
      feedback_index: null,
      feedback_draft: null,
    });
  }

  if (
    lower === 'rate' ||
    lower === 'rate now' ||
    lower === 'feedback' ||
    inFeedback
  ) {
    const started = await resumePendingFeedback(phone);
    if (!started) {
      await sendText(phone, 'No delivered order waiting for a rating. Thank you!');
    }
    return true;
  }

  return false;
}

// Keep export for admin tooling that may reference save helpers
export { saveOrderFeedback };

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
          { id: 'lunch', title: 'Order lunch' },
          { id: 'dinner', title: 'Order dinner' },
        ]);
      } else if (status === 'out_for_delivery') {
        if (trackForNotify?.track_map_url) {
          await sendCtaUrl(updated.phone, msg, {
            displayText: 'Track on map',
            url: trackForNotify.track_map_url,
          }, { footer: 'ETA · call if needed' });
        } else {
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
