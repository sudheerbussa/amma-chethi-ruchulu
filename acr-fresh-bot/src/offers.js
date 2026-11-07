/**
 * Launch / admin offers.
 * Kinds:
 *  - flat_discount: food ≥ above_paise → subtract discount_paise (stack multiple)
 *  - free_delivery: food ≥ above_paise → delivery fee 0 (stacks with discounts)
 *  - qty_bundle: every N qty of dish_code → discount_paise (× floor(qty/N)); optional valid_date
 */

import { DELIVERY_ZONES } from './menu.js';
import { formatPaise } from './orders/cart.js';
import {
  baseDeliveryFeePaise,
  DELIVERY_MODES,
  defaultDeliverySettings,
  effectiveDeliverySettings,
} from './delivery-settings.js';

export const META_KEY_OFFERS = 'offers_v1';

export {
  META_KEY_DELIVERY,
  DELIVERY_MODES,
  defaultDeliverySettings,
  normalizeDeliverySettings,
  effectiveDeliverySettings,
  baseDeliveryFeePaise,
  zoneBaseFeePaise,
  deliveryModeLabel,
} from './delivery-settings.js';

export const OFFER_KINDS = {
  flat_discount: 'flat_discount',
  free_delivery: 'free_delivery',
  qty_bundle: 'qty_bundle',
};

/** No default promos — add in Admin → Offers when ready. */
export function defaultOffers() {
  return [];
}

function slugId(prefix = 'offer') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function cartQtyForCode(cart, dishCode) {
  const code = String(dishCode || '').toUpperCase();
  if (!code) return 0;
  return (Array.isArray(cart) ? cart : []).reduce((sum, line) => {
    if (String(line?.code || '').toUpperCase() !== code) return sum;
    return sum + Math.max(0, Math.round(Number(line.qty) || 0));
  }, 0);
}

export function normalizeOffer(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const kind = String(raw.kind || '').trim();
  if (
    kind !== OFFER_KINDS.flat_discount &&
    kind !== OFFER_KINDS.free_delivery &&
    kind !== OFFER_KINDS.qty_bundle
  ) {
    return null;
  }

  if (kind === OFFER_KINDS.qty_bundle) {
    const dishCode = String(raw.dish_code || raw.dishCode || '')
      .trim()
      .toUpperCase();
    if (!dishCode) return null;
    const everyQty = Math.max(2, Math.round(Number(raw.every_qty ?? raw.everyQty) || 2));
    const discount = Math.max(0, Math.round(Number(raw.discount_paise) || 0));
    if (discount <= 0) return null;
    const validDate = String(raw.valid_date || raw.validDate || '')
      .trim()
      .slice(0, 10);
    const title =
      String(raw.title || '').trim() ||
      `${formatPaise(discount)} off · every ${everyQty}× ${dishCode}`;
    return {
      id: String(raw.id || slugId(kind)).slice(0, 48),
      kind,
      enabled: raw.enabled !== false && raw.enabled !== 0 && raw.enabled !== '0',
      title: title.slice(0, 80),
      above_paise: 0,
      discount_paise: discount,
      dish_code: dishCode.slice(0, 16),
      every_qty: everyQty,
      valid_date: /^\d{4}-\d{2}-\d{2}$/.test(validDate) ? validDate : null,
    };
  }

  const above = Math.max(0, Math.round(Number(raw.above_paise) || 0));
  let discount = Math.max(0, Math.round(Number(raw.discount_paise) || 0));
  if (kind === OFFER_KINDS.free_delivery) discount = 0;
  if (kind === OFFER_KINDS.flat_discount && discount <= 0) return null;
  const title =
    String(raw.title || '').trim() ||
    (kind === OFFER_KINDS.free_delivery
      ? `Free delivery above ${formatPaise(above)}`
      : `${formatPaise(discount)} off above ${formatPaise(above)}`);
  return {
    id: String(raw.id || slugId(kind)).slice(0, 48),
    kind,
    enabled: raw.enabled !== false && raw.enabled !== 0 && raw.enabled !== '0',
    title: title.slice(0, 80),
    above_paise: above,
    discount_paise: discount,
  };
}

export function normalizeOffersList(list) {
  if (!Array.isArray(list)) return defaultOffers();
  if (!list.length) return [];
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    const o = normalizeOffer(raw);
    if (!o) continue;
    let id = o.id;
    while (seen.has(id)) id = slugId(o.kind);
    seen.add(id);
    out.push({ ...o, id });
  }
  return out;
}

export function freeDeliveryThresholdPaise(offers) {
  const acts = normalizeOffersList(offers || [])
    .filter((o) => o.enabled && o.kind === OFFER_KINDS.free_delivery)
    .map((o) => o.above_paise);
  if (!acts.length) return null;
  return Math.min(...acts);
}

export function qualifiesFreeDelivery(foodPaise, offers) {
  const t = freeDeliveryThresholdPaise(offers);
  return t != null && foodPaise >= t;
}

/**
 * Referred friend's first order: one deal dish at the deal price (no minimum) or the flat
 * discount (food ≥ min) — whichever saves more. Never both.
 */
function referralWelcomeOffer(rw, food, cart) {
  if (!rw) return null;
  const flatAmount = Math.round(Number(rw.amount_paise) || 0);
  const flat = flatAmount > 0 && food >= (Number(rw.min_paise) || 0) ? flatAmount : 0;
  const deal = rw.dish_deal;
  const dealPrice = Math.round(Number(deal?.price_paise) || 0);
  let dealSave = 0;
  let dealLine = null;
  if (deal && Array.isArray(deal.codes)) {
    for (const line of Array.isArray(cart) ? cart : []) {
      if (!deal.codes.includes(String(line?.code || '').toUpperCase())) continue;
      if (!(Number(line.qty) >= 1)) continue;
      const save = Math.round(Number(line.unit_price_paise) || 0) - dealPrice;
      if (save > dealSave) {
        dealSave = save;
        dealLine = line;
      }
    }
  }
  const tag = rw.code ? ` (${rw.code})` : '';
  if (dealSave > flat) {
    return {
      id: 'referral_welcome',
      kind: 'referral_welcome',
      title: `Referral welcome${tag} — ${dealLine.base_name || dealLine.name || dealLine.code} @ ${formatPaise(dealPrice)}`,
      amount_paise: dealSave,
      code: rw.code || null,
      dish_code: String(dealLine.code).toUpperCase(),
    };
  }
  if (flat > 0) {
    return {
      id: 'referral_welcome',
      kind: 'referral_welcome',
      title: rw.title || `Referral welcome — ${formatPaise(flat)} off`,
      amount_paise: flat,
      code: rw.code || null,
    };
  }
  return null;
}

/**
 * @param {{ foodPaise: number, zoneId?: string, offers: Array, deliverySettings?: object, dayIso?: string, cart?: Array, referralWelcome?: { amount_paise: number, min_paise: number, title: string, code?: string, dish_deal?: { codes: string[], price_paise: number } | null } | null }} args
 */
export function applyOffers({
  foodPaise,
  zoneId,
  offers,
  deliverySettings,
  dayIso,
  cart,
  referralWelcome = null,
}) {
  const food = Math.max(0, Math.round(Number(foodPaise) || 0));
  const day = String(dayIso || '').slice(0, 10);
  const effective = effectiveDeliverySettings(
    deliverySettings || defaultDeliverySettings(),
    day || '',
  );
  const baseFee = baseDeliveryFeePaise(zoneId || 'z2', effective);
  let discount_paise = 0;
  let free_delivery = false;
  const applied = [];

  for (const o of normalizeOffersList(offers)) {
    if (!o.enabled) continue;

    if (o.kind === OFFER_KINDS.qty_bundle) {
      if (o.valid_date && day && o.valid_date !== day) continue;
      if (o.valid_date && !day) continue;
      const qty = cartQtyForCode(cart, o.dish_code);
      const bundles = Math.floor(qty / (o.every_qty || 2));
      if (bundles < 1) continue;
      const amount = bundles * o.discount_paise;
      discount_paise += amount;
      applied.push({
        id: o.id,
        kind: o.kind,
        title: o.title,
        amount_paise: amount,
        dish_code: o.dish_code,
        bundles,
      });
      continue;
    }

    if (food < o.above_paise) continue;
    if (o.kind === OFFER_KINDS.flat_discount) {
      discount_paise += o.discount_paise;
      applied.push({
        id: o.id,
        kind: o.kind,
        title: o.title,
        amount_paise: o.discount_paise,
      });
    } else if (o.kind === OFFER_KINDS.free_delivery) {
      free_delivery = true;
      applied.push({
        id: o.id,
        kind: o.kind,
        title: o.title,
        amount_paise: baseFee,
      });
    }
  }

  const welcome = referralWelcomeOffer(referralWelcome, food, cart);
  if (welcome) {
    discount_paise += welcome.amount_paise;
    applied.push(welcome);
  }

  discount_paise = Math.min(discount_paise, food);
  const delivery_fee_paise = free_delivery ? 0 : baseFee;
  const total_paise = Math.max(0, food - discount_paise + delivery_fee_paise);
  const zone = DELIVERY_ZONES.find((z) => z.id === zoneId);

  let delivery_label;
  if (free_delivery) {
    delivery_label = 'Free delivery (offer)';
  } else if (effective.mode === DELIVERY_MODES.flat) {
    delivery_label = 'Flat rate';
  } else {
    delivery_label = zone?.title || zoneId || 'Delivery';
  }

  return {
    food_paise: food,
    discount_paise,
    delivery_fee_paise,
    total_paise,
    free_delivery,
    zone_id: effective.mode === DELIVERY_MODES.flat ? 'flat' : zoneId || null,
    delivery_mode: effective.mode,
    delivery_label,
    applied,
    delivery_settings_source: effective.source,
  };
}

/**
 * ACR Credit (wallet) as the last discount line. Amount comes from referrals.walletUseFor
 * (already capped); run after pickup / fee overrides so total stays consistent.
 */
export function applyWalletCredit(pricing, walletPaise) {
  const food = Math.max(0, Number(pricing.food_paise) || 0);
  const discount = Math.max(0, Number(pricing.discount_paise) || 0);
  const amount = Math.min(Math.max(0, Math.round(Number(walletPaise) || 0)), Math.max(0, food - discount));
  if (amount <= 0) return { ...pricing, wallet_paise: 0 };
  return {
    ...pricing,
    discount_paise: discount + amount,
    total_paise: Math.max(0, (Number(pricing.total_paise) || 0) - amount),
    wallet_paise: amount,
    applied: [
      ...(pricing.applied || []),
      { id: 'wallet_credit', kind: 'wallet_credit', title: `ACR Credit −${formatPaise(amount)}`, amount_paise: amount },
    ],
  };
}

/** Short lines for WhatsApp cart / welcome */
export function formatOffersPublicLines(offers, { dayIso } = {}) {
  const day = String(dayIso || '').slice(0, 10);
  const lines = [];
  for (const o of normalizeOffersList(offers)) {
    if (!o.enabled) continue;
    if (o.kind === OFFER_KINDS.flat_discount) {
      lines.push(
        `• ${formatPaise(o.discount_paise)} off on orders ≥ ${formatPaise(o.above_paise)}`,
      );
    } else if (o.kind === OFFER_KINDS.free_delivery) {
      lines.push(`• Free delivery on orders ≥ ${formatPaise(o.above_paise)}`);
    } else if (o.kind === OFFER_KINDS.qty_bundle) {
      if (o.valid_date && (!day || o.valid_date !== day)) continue;
      lines.push(
        `• ${o.title || `${formatPaise(o.discount_paise)} off every ${o.every_qty}× ${o.dish_code}`}`,
      );
    }
  }
  return lines;
}

export function formatAppliedOffersText(pricing) {
  if (!pricing?.discount_paise && !pricing?.free_delivery) return '';
  const bits = [];
  if (pricing.discount_paise > 0) {
    bits.push(`Discount: −${formatPaise(pricing.discount_paise)}`);
  }
  const titles = (pricing.applied || []).map((a) => a.title).filter(Boolean);
  if (titles.length) bits.push(`Offers: ${titles.join(', ')}`);
  return bits.join('\n');
}
