/** Multi-item cart helpers for WhatsApp order flow */

import { stripCookFromLineName } from '../ammas.js';

export function formatPaise(paise) {
  return `₹${(Number(paise || 0) / 100).toFixed(0)}`;
}

/** Show offer price with struck-off MRP when mrp_paise > price_paise.
 *  WhatsApp doesn't render HTML <s>, but Unicode strikethrough (̶) works. */
export function formatPriceWithMrp(dish) {
  const price = formatPaise(dish.price_paise);
  const mrp = Number(dish.mrp_paise || 0);
  if (!mrp || mrp <= dish.price_paise) return price;
  const mrpStr = `₹${(mrp / 100).toFixed(0)}`;
  const struck = [...mrpStr].map((ch) => ch + '\u0336').join('');
  return `${price} ${struck}`;
}

/** Normalize order → line items (supports legacy single-dish orders) */
export function getOrderLines(order) {
  if (Array.isArray(order?.items) && order.items.length) {
    return order.items.map((i) => ({
      code: i.code || i.dish_code,
      name: i.name || i.dish_name,
      base_name: i.base_name || null,
      qty: Number(i.qty) || 1,
      unit_price_paise: i.unit_price_paise ?? i.price_paise ?? null,
      category: i.category || null,
      cook_name: i.cook_name || null,
      amma_id: i.amma_id || null,
    }));
  }
  if (!order?.dish_code && !order?.dish_name) return [];
  return [
    {
      code: order.dish_code,
      name: order.dish_name,
      base_name: null,
      qty: Number(order.qty) || 1,
      unit_price_paise: order.unit_price_paise ?? null,
      category: order.category || null,
      cook_name: order.cook_name || null,
      amma_id: order.amma_id || null,
    },
  ];
}

/** Dish name for customer messages (no Amma suffix). */
export function lineDisplayName(line) {
  if (!line) return '—';
  if (line.base_name) return String(line.base_name).trim();
  const raw = String(line.name || line.code || '').trim();
  return stripCookFromLineName(raw) || raw || '—';
}

export function formatLinesText(lines, { maxLines = 12 } = {}) {
  const list = Array.isArray(lines) ? lines : [];
  if (!list.length) return '—';
  const shown = list.slice(0, maxLines).map((i) => `${i.qty}x ${lineDisplayName(i)}`);
  if (list.length > maxLines) shown.push(`…+${list.length - maxLines} more`);
  return shown.join('\n');
}

export function cartFoodPaise(cart) {
  return (Array.isArray(cart) ? cart : []).reduce(
    (sum, i) => sum + (Number(i.unit_price_paise) || 0) * (Number(i.qty) || 0),
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

/** Build cart line from a dish (display name = dish only; cook_name kept for admin/payout). */
export function cartLineFromDish(dish, qty) {
  const base = dish?.name || dish?.code;
  return {
    code: String(dish.code).toUpperCase(),
    name: base,
    base_name: base,
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
        `Food total: ${formatPaise(food)}`;
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
