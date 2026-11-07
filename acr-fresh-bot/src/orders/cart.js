/** Multi-item cart helpers for WhatsApp order flow */

import { stripCookFromLineName } from '../ammas.js';

export function formatPaise(paise) {
  return `₹${(Number(paise || 0) / 100).toFixed(0)}`;
}

/** Line total in paise (unit × qty). */
export function linePaise(line) {
  return (Number(line?.unit_price_paise) || 0) * (Number(line?.qty) || 0);
}

/** Attach line_paise on a cart/order line (does not mutate input). */
export function withLinePaise(line) {
  const qty = Number(line?.qty) || 0;
  const unit_price_paise = Number(line?.unit_price_paise) || 0;
  return {
    ...line,
    qty,
    unit_price_paise,
    line_paise: unit_price_paise * qty,
  };
}

/** Normalize order → line items (supports legacy single-dish orders) */
export function getOrderLines(order) {
  if (Array.isArray(order?.items) && order.items.length) {
    return order.items.map((i) =>
      withLinePaise({
        code: i.code || i.dish_code,
        name: i.name || i.dish_name,
        base_name: i.base_name || null,
        qty: Number(i.qty) || 1,
        unit_price_paise: i.unit_price_paise ?? i.price_paise ?? null,
        category: i.category || null,
        cook_name: i.cook_name || null,
        amma_id: i.amma_id || null,
        ...(i.pack_kg != null ? { pack_kg: i.pack_kg } : {}),
        ...(i.base_code ? { base_code: i.base_code } : {}),
      }),
    );
  }
  if (!order?.dish_code && !order?.dish_name) return [];
  return [
    withLinePaise({
      code: order.dish_code,
      name: order.dish_name,
      base_name: null,
      qty: Number(order.qty) || 1,
      unit_price_paise: order.unit_price_paise ?? null,
      category: order.category || null,
      cook_name: order.cook_name || null,
      amma_id: order.amma_id || null,
    }),
  ];
}

/** Dish name for customer messages (Telugu `name`; admin may use base_name). */
export function lineDisplayName(line, { forAdmin = false } = {}) {
  if (!line) return '—';
  if (forAdmin) {
    const en = String(line.base_name || line.name || line.code || '').trim();
    return stripCookFromLineName(en) || en || '—';
  }
  const raw = String(line.name || line.code || '').trim();
  return stripCookFromLineName(raw) || raw || '—';
}

/**
 * Format order lines for WhatsApp / admin.
 * withPrices: "2x Tomato (500 g) · ₹20/u · ₹40"
 */
export function formatLinesText(lines, { maxLines = 12, withPrices = false } = {}) {
  const list = Array.isArray(lines) ? lines : [];
  if (!list.length) return '—';
  const shown = list.slice(0, maxLines).map((i) => {
    const name = lineDisplayName(i);
    if (!withPrices) return `${i.qty}x ${name}`;
    const unit = Number(i.unit_price_paise) || 0;
    const line = linePaise(i);
    return `${i.qty}x ${name} · ${formatPaise(unit)}/u · ${formatPaise(line)}`;
  });
  if (list.length > maxLines) shown.push(`…+${list.length - maxLines} more`);
  return shown.join('\n');
}

export function cartFoodPaise(cart) {
  return (Array.isArray(cart) ? cart : []).reduce(
    (sum, i) => sum + linePaise(i),
    0,
  );
}

export function cartTotalQty(cart) {
  return (Array.isArray(cart) ? cart : []).reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
}

export function dishSummaryName(cart) {
  const lines = Array.isArray(cart) ? cart : [];
  if (!lines.length) return 'Empty cart';
  if (lines.length === 1) return lineDisplayName(lines[0]);
  return `${lineDisplayName(lines[0])} +${lines.length - 1} more`;
}

/** Max qty for one dish line (typo / spam guard). Availability is cutoffs + active flag only. */
export const MAX_LINE_QTY = 30;

/** How many more of this dish can be added to the cart (not inventory). */
export function remainingForDish(dish, cart) {
  if (!dish) return 0;
  const reserved = (Array.isArray(cart) ? cart : [])
    .filter((i) => String(i.code).toUpperCase() === String(dish.code).toUpperCase())
    .reduce((s, i) => s + (Number(i.qty) || 0), 0);
  return Math.max(0, MAX_LINE_QTY - reserved);
}

import { dishCustomerName } from '../menu.js';

/** Build cart line from a dish (customer name Telugu; base_name English for admin). */
export function cartLineFromDish(dish, qty) {
  const en = String(dish?.name || dish?.code || '').trim();
  const display = dishCustomerName(dish);
  return {
    code: String(dish.code).toUpperCase(),
    name: display,
    base_name: en,
    qty: Number(qty) || 1,
    unit_price_paise: Number(dish.price_paise) || 0,
    category: dish.category || null,
    cook_name: dish.cook_name || null,
    amma_id: dish.amma_id || null,
  };
}

/** Qty of a dish code already in cart (0 if none). */
export function cartQtyForDish(cart, code) {
  const c = String(code || '').toUpperCase();
  const line = (Array.isArray(cart) ? cart : []).find(
    (i) => String(i.code).toUpperCase() === c,
  );
  return line ? Number(line.qty) || 0 : 0;
}

/** Merge qty if same code already in cart */
export function addToCart(cart, line) {
  const next = Array.isArray(cart) ? cart.map((i) => ({ ...i })) : [];
  const code = String(line.code).toUpperCase();
  const idx = next.findIndex((i) => String(i.code).toUpperCase() === code);
  if (idx >= 0) {
    next[idx] = {
      ...next[idx],
      qty: (Number(next[idx].qty) || 0) + (Number(line.qty) || 0),
      // refresh labels if dish re-added with Amma
      name: line.name || next[idx].name,
      cook_name: line.cook_name || next[idx].cook_name,
      amma_id: line.amma_id || next[idx].amma_id,
      base_name: line.base_name || next[idx].base_name,
    };
  } else {
    next.push({
      code,
      name: line.name,
      base_name: line.base_name || null,
      qty: Number(line.qty) || 1,
      unit_price_paise: Number(line.unit_price_paise) || 0,
      category: line.category || null,
      cook_name: line.cook_name || null,
      amma_id: line.amma_id || null,
    });
  }
  return next;
}

/** Remove one line by code. Returns new cart. */
export function removeFromCart(cart, code) {
  const c = String(code || '').toUpperCase();
  return (Array.isArray(cart) ? cart : []).filter((i) => String(i.code).toUpperCase() !== c);
}

/**
 * Set absolute qty for a line. qty <= 0 removes the line.
 * Returns { cart, error? }
 */
export function setCartLineQty(cart, code, qty) {
  const c = String(code || '').toUpperCase();
  const next = (Array.isArray(cart) ? cart : []).map((i) => ({ ...i }));
  const idx = next.findIndex((i) => String(i.code).toUpperCase() === c);
  if (idx < 0) return { cart: next, error: 'Item not in cart' };
  const n = Number(qty);
  if (!Number.isInteger(n) || n < 0) return { cart: next, error: 'Invalid quantity' };
  if (n === 0) {
    next.splice(idx, 1);
    return { cart: next };
  }
  next[idx] = { ...next[idx], qty: n };
  return { cart: next };
}

/** Max qty allowed when editing an existing cart line (line cap; not inventory). */
export function maxQtyForCartLine(_dish, cart, code) {
  const others = (Array.isArray(cart) ? cart : []).filter(
    (i) => String(i.code).toUpperCase() !== String(code || '').toUpperCase(),
  );
  return remainingForDish({ code: code || 'X' }, others);
}

export function formatCartMessage(cart, { minOrderPaise = 0, numbered = false, offerLines = [] } = {}) {
  const lines = Array.isArray(cart) ? cart : [];
  const food = cartFoodPaise(lines);
  const listText = numbered
    ? lines
        .map((i, n) => `${n + 1}. ${i.qty}x ${lineDisplayName(i)}`)
        .join('\n') || '—'
    : formatLinesText(lines);
  let body =
    lines.length === 0
      ? 'Your cart is empty.'
      : `Your cart (${lines.length} item${lines.length === 1 ? '' : 's'}):\n` +
        `${listText}\n\n` +
        `Items total: ${formatPaise(food)}`;
  const minHint =
    minOrderPaise && food < minOrderPaise
      ? `\nMin order ${formatPaise(minOrderPaise)} — add more to checkout.`
      : '';
  const offersHint =
    offerLines?.length
      ? `\n\nOffers (auto at checkout):\n${offerLines.join('\n')}`
      : '';
  return body + minHint + offersHint;
}
