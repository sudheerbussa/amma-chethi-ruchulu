/**
 * Rebuild cart from last order for a meal / service day (Flow + button reorder).
 */

import { getDb } from '../db.js';
import { isSundayPartyDinnerService, sundayPartyOrderNotice } from '../cutoffs.js';
import {
  addToCart,
  cartLineFromDish,
  getOrderLines,
  lineDisplayName,
  MAX_LINE_QTY,
  remainingForDish,
} from './cart.js';
import { formatDishLabel } from '../ammas.js';

/**
 * @returns {Promise<{ cart: object[], missing: string[], partyNotice: string|null }>}
 */
export async function buildReorderCart({ phone, meal, serviceDay }) {
  const db = getDb();
  const last = await db.findLatestOrder(phone);
  const lines = last ? getOrderLines(last) : [];
  if (!lines.length) return { cart: [], missing: [], partyNotice: null };

  const partyOnly = isSundayPartyDinnerService(meal, serviceDay);
  let sourceLines = lines;
  let partyNotice = null;
  if (partyOnly) {
    sourceLines = lines.filter((l) => l.category === 'packs');
    if (!sourceLines.length) {
      return {
        cart: [],
        missing: [],
        partyNotice:
          sundayPartyOrderNotice() +
          `\n\nYour last order had no Party Packs, so we cannot re-add it for Sunday.`,
      };
    }
  }

  let cart = [];
  const missing = [];
  for (const line of sourceLines) {
    const dish = await db.getDish(line.code);
    if (!dish || !dish.active) {
      missing.push(lineDisplayName(line) || line.code);
      continue;
    }
    if (dish.meal !== 'both' && dish.meal !== meal) {
      missing.push(formatDishLabel(dish));
      continue;
    }
    const left = remainingForDish(dish, cart);
    if (left <= 0) {
      missing.push(formatDishLabel(dish));
      continue;
    }
    const qty = Math.min(Number(line.qty) || 1, left, MAX_LINE_QTY);
    cart = addToCart(cart, cartLineFromDish(dish, qty));
  }

  return { cart, missing, partyNotice };
}
