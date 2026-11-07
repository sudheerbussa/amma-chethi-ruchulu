/**
 * Shared menu / booking helpers for button bot, WhatsApp Flows, and Catalog.
 * Single source for dish lists and service-day resolution (channel parity).
 */

import { getDb } from '../db.js';
import { CATEGORIES, categoryCustomerTitle, dishCustomerName } from '../menu.js';
import {
  dayFromIso,
  isKitchenServiceDayAvailable,
  isMealOpen,
  mealTitle,
  nextServiceDayForMeal,
  nowIst,
  orderDayForMeal,
} from '../cutoffs.js';
import { formatDishLabel } from '../ammas.js';
import { MAX_LINE_QTY, addToCart, cartLineFromDish, formatPaise } from './cart.js';

/** Resolve service day for ordering (ACR-Fresh: always meal=`fresh`). */
export function resolveBooking(_meal, serviceDateIso = null) {
  const m = 'fresh';
  if (serviceDateIso) {
    const day = dayFromIso(serviceDateIso);
    if (!isKitchenServiceDayAvailable(m, day)) {
      return { ok: false, error: `${mealTitle(m)} is not available on ${day.dayDateLabel}.` };
    }
    const today = nowIst();
    if (day.isoDate === today.isoDate && !isMealOpen(m)) {
      return { ok: false, error: `Ordering is closed for today — pick a later slot.` };
    }
    return { ok: true, meal: m, serviceDay: day, isAdvance: day.isoDate !== today.isoDate };
  }
  const info = orderDayForMeal(m);
  return {
    ok: true,
    meal: m,
    serviceDay: info.serviceDay,
    isAdvance: info.isAdvance,
  };
}

export function categoryOptionsForMeal(_meal, _serviceDay) {
  // No emoji — Meta RadioButtonsGroup titles must be plain text
  return CATEGORIES.map((c) => ({
    id: c.id,
    title: String(c.title_te || c.title).slice(0, 30),
  }));
}

/** Flow dish rows (id + Telugu title + price/note description; code is id only). */
export async function dishOptionsForFlow({ meal, category, limit = 30 }) {
  const dishes = await getDb().listDishes(meal, category);
  return dishes.slice(0, limit).map((d) => {
    const price = formatPaise(d.price_paise);
    const name = dishCustomerName(d);
    const note = String(d.note || '').trim();
    const title = name.slice(0, 30);
    const description = (note ? `${price} · ${note}` : price).slice(0, 72);
    return {
      id: d.code,
      title,
      description,
    };
  });
}

export async function validateDishForMeal(code, meal) {
  const dish = await getDb().getDish(code);
  if (!dish || !dish.active) return { ok: false, error: 'Item unavailable.' };
  const m = meal === 'fresh' || meal === 'lunch' || meal === 'dinner' ? meal : 'fresh';
  if (dish.meal !== 'both' && dish.meal !== 'fresh' && dish.meal !== m) {
    return { ok: false, error: `${formatDishLabel(dish)} is not for ${mealTitle(m)}.` };
  }
  return { ok: true, dish };
}

export function clampQty(qty) {
  const n = Number(qty);
  if (!Number.isInteger(n) || n < 1) return null;
  return Math.min(n, MAX_LINE_QTY);
}

/**
 * Build a one-line cart from Flow / Catalog submission.
 * @returns {{ ok: true, cart, dish } | { ok: false, error: string }}
 */
export async function buildSingleItemCart({ meal, code, qty }) {
  const checked = await validateDishForMeal(code, meal);
  if (!checked.ok) return checked;
  const q = clampQty(qty);
  if (!q) return { ok: false, error: `Quantity must be 1–${MAX_LINE_QTY}.` };
  return {
    ok: true,
    dish: checked.dish,
    cart: [cartLineFromDish(checked.dish, q)],
  };
}

/**
 * Build cart from WhatsApp Catalog "Place order" product_items.
 * Prices always come from menu.js (ignore Meta item_price).
 * Pass meal=null to only require active dishes (meal chosen later).
 * @returns {{ cart: object[], skipped: string[] }}
 */
export async function buildCartFromCatalogItems(productItems, meal = null) {
  let cart = [];
  const skipped = [];
  for (const item of Array.isArray(productItems) ? productItems : []) {
    const code = String(item?.product_retailer_id || item?.retailer_id || '')
      .trim()
      .toUpperCase();
    if (!code) {
      skipped.push('?');
      continue;
    }
    const qtyRaw = Number(item?.quantity);
    const qty =
      Number.isFinite(qtyRaw) && qtyRaw >= 1
        ? Math.min(MAX_LINE_QTY, Math.floor(qtyRaw))
        : 1;
    if (meal) {
      const checked = await validateDishForMeal(code, meal);
      if (!checked.ok) {
        skipped.push(code);
        continue;
      }
      cart = addToCart(cart, cartLineFromDish(checked.dish, qty));
      continue;
    }
    const dish = await getDb().getDish(code);
    if (!dish || !dish.active) {
      skipped.push(code);
      continue;
    }
    cart = addToCart(cart, cartLineFromDish(dish, qty));
  }
  return { cart, skipped };
}

/** Drop / keep lines that are valid for the chosen meal. */
export async function filterCartForMeal(cart, meal) {
  const next = [];
  const skipped = [];
  for (const line of Array.isArray(cart) ? cart : []) {
    const code = String(line?.code || '').toUpperCase();
    const qty = Number(line?.qty) || 1;
    const checked = await validateDishForMeal(code, meal);
    if (!checked.ok) {
      skipped.push(code || '?');
      continue;
    }
    next.push(cartLineFromDish(checked.dish, qty));
  }
  return { cart: next, skipped };
}

export function categoryTitle(id) {
  return categoryCustomerTitle(id);
}

export function nextOpenServiceDay(meal) {
  return nextServiceDayForMeal(meal, 0);
}
