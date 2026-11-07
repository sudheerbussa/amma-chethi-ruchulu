/**
 * Shared menu / booking helpers for button bot, WhatsApp Flows, and Catalog.
 * Single source for dish lists and service-day resolution (channel parity).
 */

import { getDb } from '../db.js';
import {
  BROWSE_CATEGORIES,
  browseCategoryLabel,
  categoryLabel,
  dishBrowseGroup,
  isBrowseCategoryId,
} from '../menu.js';
import {
  dayFromIso,
  isKitchenServiceDayAvailable,
  isMealCallConfirmWindow,
  isMealOpen,
  isSundayPartyDinnerService,
  mealCallConfirmMessage,
  mealTitle,
  nextServiceDayForMeal,
  nowIst,
  orderDayForMeal,
  sundayPartyOrderNoticeShort,
} from '../cutoffs.js';
import { formatDishLabel, formatDishWithCook, isPlaceholderCook } from '../ammas.js';
import { MAX_LINE_QTY, addToCart, cartLineFromDish, formatPaise } from './cart.js';

/** Resolve meal + service day for ordering (today if open, else next cookable day). */
export function resolveBooking(meal, serviceDateIso = null) {
  const m = meal === 'dinner' ? 'dinner' : 'lunch';
  if (serviceDateIso) {
    const day = dayFromIso(serviceDateIso);
    if (!isKitchenServiceDayAvailable(m, day)) {
      return { ok: false, error: `${mealTitle(m)} is not available on ${day.dayDateLabel}.` };
    }
    const today = nowIst();
    if (day.isoDate === today.isoDate && isMealCallConfirmWindow(m)) {
      return { ok: false, error: mealCallConfirmMessage(m), callConfirm: true };
    }
    if (day.isoDate === today.isoDate && !isMealOpen(m)) {
      return { ok: false, error: `${mealTitle(m)} ordering is closed for today.` };
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

/** Customer Flow / button category picker (Student · Veg · Non-veg; Sunday → packs). */
export function categoryOptionsForMeal(meal, serviceDay) {
  const day = serviceDay || nowIst();
  if (isSundayPartyDinnerService(meal, day)) {
    return [{ id: 'packs', title: 'Party Packs' }];
  }
  // No emoji — Meta RadioButtonsGroup titles must be plain text
  return BROWSE_CATEGORIES.map((c) => ({
    id: c.id,
    title: String(c.title).slice(0, 30),
  }));
}

/** Dishes for a customer browse group or exact admin category. */
export async function listDishesForBrowse(meal, browseOrCategory) {
  const id = String(browseOrCategory || '').trim();
  if (id === 'student' || id === 'veg' || id === 'nonveg') {
    const all = await getDb().listDishes(meal, null);
    return all.filter((d) => dishBrowseGroup(d) === id);
  }
  return getDb().listDishes(meal, id || null);
}

/** Max dishes on Flow DISH screen — RadioButtonsGroup limit is 20. */
export const FLOW_DISH_RADIO_LIMIT = 20;

const FLOW_MORE_PREFIX = '__more_';

export function isFlowMoreDishOption(id) {
  return String(id || '').toLowerCase().startsWith(FLOW_MORE_PREFIX);
}

export function flowMorePageFromId(id) {
  const s = String(id || '');
  const lower = s.toLowerCase();
  if (!lower.startsWith(FLOW_MORE_PREFIX)) return 0;
  const n = Number(s.slice(FLOW_MORE_PREFIX.length));
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

/** Radio rows for Flow DISH screen (id + title + description). Paginates if > 20. */
export async function dishOptionsForFlow({
  meal,
  category,
  page = 0,
  limit = FLOW_DISH_RADIO_LIMIT,
}) {
  const dishes = await listDishesForBrowse(meal, category);
  const p = Math.max(0, Number(page) || 0);
  const needMore = dishes.length > limit;
  const pageSize = needMore ? Math.max(1, limit - 1) : limit;
  const start = p * pageSize;
  const slice = dishes.slice(start, start + pageSize);
  const hasMore = start + pageSize < dishes.length;

  const rows = slice.map((d) => {
    const price = formatPaise(d.price_paise);
    const note = String(d.note || '').trim();
    // Customer Flow: name only (code stays as option id for the backend)
    const title = formatDishLabel(d).slice(0, 30);
    const cookBit =
      d.cook_name && !isPlaceholderCook(d.cook_name) ? `by ${d.cook_name}` : null;
    const description = [cookBit, price, note || null].filter(Boolean).join(' · ').slice(0, 72);
    return {
      id: d.code,
      title,
      description,
    };
  });

  if (hasMore) {
    rows.push({
      id: `${FLOW_MORE_PREFIX}${p + 1}`,
      title: 'More items…',
      description: `Page ${p + 2} · ${dishes.length - start - pageSize} more`,
    });
  }
  return rows;
}

export async function validateDishForMeal(code, meal) {
  const dish = await getDb().getDish(code);
  if (!dish || !dish.active) return { ok: false, error: 'Item unavailable.' };
  if (dish.meal !== 'both' && dish.meal !== meal) {
    return { ok: false, error: `${formatDishLabel(dish)} is not for ${mealTitle(meal)}.` };
  }
  return { ok: true, dish };
}

/** Meal + service-day rules (Sunday party packs only). */
export async function validateDishForBooking(code, meal, serviceDay) {
  const checked = await validateDishForMeal(code, meal);
  if (!checked.ok) return checked;
  const day = serviceDay || nowIst();
  if (isSundayPartyDinnerService(meal, day) && checked.dish.category !== 'packs') {
    return {
      ok: false,
      error: `${formatDishLabel(checked.dish)} — ${sundayPartyOrderNoticeShort()}`,
    };
  }
  return checked;
}

export function cartViolatesSundayPartyRule(cart, meal, serviceDay) {
  if (!isSundayPartyDinnerService(meal, serviceDay)) return false;
  return (Array.isArray(cart) ? cart : []).some((line) => line?.category !== 'packs');
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
export async function buildSingleItemCart({ meal, code, qty, serviceDay = null }) {
  const checked = serviceDay
    ? await validateDishForBooking(code, meal, serviceDay)
    : await validateDishForMeal(code, meal);
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
  return isBrowseCategoryId(id) ? browseCategoryLabel(id) : categoryLabel(id);
}

export function nextOpenServiceDay(meal) {
  return nextServiceDayForMeal(meal, 0);
}
