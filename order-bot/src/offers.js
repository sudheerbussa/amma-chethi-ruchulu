/**
 * Launch / admin offers.
 * Kinds:
 *  - flat_discount: food ≥ above_paise → subtract discount_paise (stack multiple)
 *  - free_delivery: food ≥ above_paise → delivery fee 0 (stacks with discounts)
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
};

/** Launch defaults — both enabled. */
export function defaultOffers() {
  return [
    {
      id: 'launch_discount',
      kind: OFFER_KINDS.flat_discount,
      enabled: true,
      title: 'Launch offer — ₹50 off',
      above_paise: 20000,
      discount_paise: 5000,
    },
    {
      id: 'launch_free_delivery',
      kind: OFFER_KINDS.free_delivery,
      enabled: true,
      title: 'Launch offer — free delivery',
      above_paise: 30000,
      discount_paise: 0,
    },
  ];
}

function slugId(prefix = 'offer') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function normalizeOffer(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const kind = String(raw.kind || '').trim();
  if (kind !== OFFER_KINDS.flat_discount && kind !== OFFER_KINDS.free_delivery) return null;
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
  if (!Array.isArray(list) || !list.length) return defaultOffers();
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
  return out.length ? out : defaultOffers();
}

export function freeDeliveryThresholdPaise(offers) {
  const acts = (offers || [])
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
 * @param {{ foodPaise: number, zoneId?: string, offers: Array, deliverySettings?: object, dayIso?: string }} args
 */
export function applyOffers({ foodPaise, zoneId, offers, deliverySettings, dayIso }) {
  const food = Math.max(0, Math.round(Number(foodPaise) || 0));
  const effective = effectiveDeliverySettings(
    deliverySettings || defaultDeliverySettings(),
    dayIso || '',
  );
  const baseFee = baseDeliveryFeePaise(zoneId || 'z2', effective);
  let discount_paise = 0;
  let free_delivery = false;
  const applied = [];

  for (const o of normalizeOffersList(offers)) {
    if (!o.enabled) continue;
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

/** Short lines for WhatsApp cart / welcome */
export function formatOffersPublicLines(offers) {
  const lines = [];
  for (const o of normalizeOffersList(offers)) {
    if (!o.enabled) continue;
    if (o.kind === OFFER_KINDS.flat_discount) {
      lines.push(
        `• ${formatPaise(o.discount_paise)} off food ≥ ${formatPaise(o.above_paise)}`,
      );
    } else if (o.kind === OFFER_KINDS.free_delivery) {
      lines.push(`• Free delivery on food ≥ ${formatPaise(o.above_paise)}`);
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
