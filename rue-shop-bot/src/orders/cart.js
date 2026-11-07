import { getProduct } from '../menu.js';

/**
 * Build priced line items from { code, qty }[].
 * @returns {{ ok: true, items, food_paise } | { ok: false, error }}
 */
export function buildCartLines(rawItems) {
  if (!Array.isArray(rawItems) || !rawItems.length) {
    return { ok: false, error: 'Cart is empty' };
  }
  const items = [];
  let food_paise = 0;
  for (const raw of rawItems) {
    const code = String(raw.code || raw.product_code || '').trim();
    const qty = Math.max(1, Math.min(99, Math.floor(Number(raw.qty) || 1)));
    const product = getProduct(code);
    if (!product || product.active === false) {
      return { ok: false, error: `Unknown or unavailable product: ${code || '?'}` };
    }
    const unit = Math.round(Number(product.price_paise) || 0);
    const line = unit * qty;
    food_paise += line;
    items.push({
      code: product.code,
      name: product.name,
      qty,
      unit_price_paise: unit,
      line_paise: line,
      image: product.image || null,
    });
  }
  return { ok: true, items, food_paise };
}
