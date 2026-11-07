/**
 * Daily market / competitor price board for ACR Fresh admin.
 * Cost rule: vegetables ← Raithu Market; fruits ← Local.
 */

/** @typedef {'vegetables'|'fruits'} PriceCategory */

/**
 * @typedef {{
 *  item_key: string,
 *  item_name: string,
 *  category: PriceCategory,
 *  uom: string,
 *  dish_code: string|null,
 *  local_rupees: number|null,
 *  blinkit_rupees: number|null,
 *  instamart_rupees: number|null,
 *  raithu_rupees: number|null,
 *  suggested_acr_rupees: number|null,
 * }} PriceBoardSeedRow
 */

export const PRICE_COST_RULE = {
  vegetables: 'raithu',
  fruits: 'local',
};

export function costSourceForCategory(category) {
  return PRICE_COST_RULE[String(category || '')] === 'local' ? 'local' : 'raithu';
}

export function rupeesToPaise(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function paiseToRupees(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n) / 100;
}

/**
 * Buy cost (paise). Prefers explicit `cost_paise` (edited on Pricing tab).
 * Else vegetables ← Raithu, fruits ← Local (with cross-fallback).
 */
export function costPaiseFromRow(row) {
  const override = Number(row?.cost_paise);
  if (Number.isFinite(override) && override > 0) return Math.round(override);
  const cat = String(row?.category || '');
  const prefer = costSourceForCategory(cat);
  const primary =
    prefer === 'local' ? Number(row?.local_paise) : Number(row?.raithu_paise);
  if (Number.isFinite(primary) && primary > 0) return Math.round(primary);
  const fallback =
    prefer === 'local' ? Number(row?.raithu_paise) : Number(row?.local_paise);
  if (Number.isFinite(fallback) && fallback > 0) return Math.round(fallback);
  return null;
}

export function marginFromSellAndCost(sellPaise, costPaise) {
  if (sellPaise == null || sellPaise === '' || costPaise == null || costPaise === '') {
    return { margin_paise: null, margin_pct: null };
  }
  const sell = Number(sellPaise);
  const cost = Number(costPaise);
  if (!Number.isFinite(sell) || !Number.isFinite(cost)) {
    return { margin_paise: null, margin_pct: null };
  }
  const margin_paise = Math.round(sell - cost);
  const margin_pct = cost > 0 ? Math.round((margin_paise / cost) * 1000) / 10 : null;
  return { margin_paise, margin_pct };
}

/**
 * Sample board from market research sheets (2026-09-06).
 * ACR suggested prices are samples — apply to menu only via admin action.
 * @type {PriceBoardSeedRow[]}
 */
export const PRICE_BOARD_SEED_20260906 = [
  // Vegetables — buy at Raithu
  { item_key: 'tom', item_name: 'Tomato', category: 'vegetables', uom: '1 Kg', dish_code: 'TOM', local_rupees: 30, blinkit_rupees: 40, instamart_rupees: 38, raithu_rupees: 25, suggested_acr_rupees: 29 },
  { item_key: 'oni', item_name: 'Onion', category: 'vegetables', uom: '1 Kg', dish_code: 'ONI', local_rupees: 55, blinkit_rupees: 60, instamart_rupees: 58, raithu_rupees: 45, suggested_acr_rupees: 49 },
  { item_key: 'pot', item_name: 'Potato', category: 'vegetables', uom: '1 Kg', dish_code: 'POT', local_rupees: 33, blinkit_rupees: 40, instamart_rupees: 39, raithu_rupees: 28, suggested_acr_rupees: 32 },
  { item_key: 'chi', item_name: 'Green Chilli', category: 'vegetables', uom: '1 Kg', dish_code: 'CHI', local_rupees: 65, blinkit_rupees: 85, instamart_rupees: 80, raithu_rupees: 60, suggested_acr_rupees: 62 },
  { item_key: 'gin', item_name: 'Ginger', category: 'vegetables', uom: '1 Kg', dish_code: 'GIN', local_rupees: 120, blinkit_rupees: 150, instamart_rupees: 145, raithu_rupees: 105, suggested_acr_rupees: 109 },
  { item_key: 'gar', item_name: 'Garlic', category: 'vegetables', uom: '1 Kg', dish_code: 'GAR', local_rupees: 220, blinkit_rupees: 260, instamart_rupees: 250, raithu_rupees: 190, suggested_acr_rupees: 199 },
  { item_key: 'okr', item_name: 'Okra', category: 'vegetables', uom: '1 Kg', dish_code: 'OKR', local_rupees: 45, blinkit_rupees: 65, instamart_rupees: 60, raithu_rupees: 35, suggested_acr_rupees: 42 },
  { item_key: 'bri', item_name: 'Brinjal', category: 'vegetables', uom: '1 Kg', dish_code: 'BRI', local_rupees: 40, blinkit_rupees: 55, instamart_rupees: 52, raithu_rupees: 30, suggested_acr_rupees: 38 },
  { item_key: 'rid', item_name: 'Ridge Gourd', category: 'vegetables', uom: '1 Kg', dish_code: 'RID', local_rupees: 45, blinkit_rupees: 65, instamart_rupees: 60, raithu_rupees: 35, suggested_acr_rupees: 42 },
  { item_key: 'bot', item_name: 'Bottle Gourd', category: 'vegetables', uom: '1 Pc', dish_code: 'BOT', local_rupees: 38, blinkit_rupees: 55, instamart_rupees: 50, raithu_rupees: 30, suggested_acr_rupees: 35 },
  { item_key: 'bit', item_name: 'Bitter Gourd', category: 'vegetables', uom: '1 Kg', dish_code: 'BIT', local_rupees: 48, blinkit_rupees: 65, instamart_rupees: 60, raithu_rupees: 40, suggested_acr_rupees: 44 },
  { item_key: 'bea', item_name: 'French Beans', category: 'vegetables', uom: '1 Kg', dish_code: 'BEA', local_rupees: 90, blinkit_rupees: 120, instamart_rupees: 110, raithu_rupees: 75, suggested_acr_rupees: 85 },
  { item_key: 'car', item_name: 'Carrot', category: 'vegetables', uom: '1 Kg', dish_code: 'CAR', local_rupees: 60, blinkit_rupees: 75, instamart_rupees: 70, raithu_rupees: 50, suggested_acr_rupees: 55 },
  { item_key: 'cab', item_name: 'Cabbage', category: 'vegetables', uom: '1 Pc', dish_code: 'CAB', local_rupees: 34, blinkit_rupees: 50, instamart_rupees: 45, raithu_rupees: 25, suggested_acr_rupees: 30 },
  { item_key: 'cau', item_name: 'Cauliflower', category: 'vegetables', uom: '1 Pc', dish_code: 'CAU', local_rupees: 43, blinkit_rupees: 55, instamart_rupees: 50, raithu_rupees: 35, suggested_acr_rupees: 39 },
  { item_key: 'dru', item_name: 'Drumstick', category: 'vegetables', uom: '1 Pc', dish_code: 'DRU', local_rupees: 78, blinkit_rupees: 100, instamart_rupees: 95, raithu_rupees: 65, suggested_acr_rupees: 72 },
  { item_key: 'tho', item_name: 'Amaranth Greens', category: 'vegetables', uom: '1 Bunch', dish_code: 'THO', local_rupees: 12, blinkit_rupees: 20, instamart_rupees: 18, raithu_rupees: 10, suggested_acr_rupees: 10 },
  { item_key: 'gon', item_name: 'Gongura', category: 'vegetables', uom: '1 Bunch', dish_code: 'GON', local_rupees: 45, blinkit_rupees: 65, instamart_rupees: 60, raithu_rupees: 40, suggested_acr_rupees: 50 },
  { item_key: 'bapatlab', item_name: 'Bapatla Brinjal', category: 'vegetables', uom: '1 Kg', dish_code: 'BAPATLAB', local_rupees: 40, blinkit_rupees: 55, instamart_rupees: 52, raithu_rupees: 35, suggested_acr_rupees: 44 },
  { item_key: 'cor', item_name: 'Kothimira', category: 'vegetables', uom: '1 Bunch', dish_code: 'COR', local_rupees: 18, blinkit_rupees: 25, instamart_rupees: 22, raithu_rupees: 15, suggested_acr_rupees: 15 },
  { item_key: 'cur', item_name: 'Karivepaku', category: 'vegetables', uom: '1 Bunch', dish_code: 'CUR', local_rupees: 20, blinkit_rupees: 30, instamart_rupees: 25, raithu_rupees: 15, suggested_acr_rupees: 17 },
  { item_key: 'cuc', item_name: 'Dosakaya (Cucumber)', category: 'vegetables', uom: '1 Kg', dish_code: 'CUC', local_rupees: 36, blinkit_rupees: 50, instamart_rupees: 45, raithu_rupees: 30, suggested_acr_rupees: 32 },
  { item_key: 'kdo', item_name: 'Cucumber Kera', category: 'vegetables', uom: '1 Kg', dish_code: 'KDO', local_rupees: 40, blinkit_rupees: 55, instamart_rupees: 50, raithu_rupees: 35, suggested_acr_rupees: 36 },
  { item_key: 'cap', item_name: 'Capsicum', category: 'vegetables', uom: '1 Kg', dish_code: 'CAP', local_rupees: 60, blinkit_rupees: 80, instamart_rupees: 75, raithu_rupees: 55, suggested_acr_rupees: 55 },
  { item_key: 'clu', item_name: 'Cluster Beans', category: 'vegetables', uom: '1 Kg', dish_code: 'CLU', local_rupees: 49, blinkit_rupees: 65, instamart_rupees: 60, raithu_rupees: 42, suggested_acr_rupees: 45 },
  { item_key: 'brb', item_name: 'Pedda Chikkudu (Broad Beans)', category: 'vegetables', uom: '1 Kg', dish_code: 'BRB', local_rupees: 55, blinkit_rupees: 75, instamart_rupees: 70, raithu_rupees: 50, suggested_acr_rupees: 60 },
  { item_key: 'ivy', item_name: 'Dondakaya', category: 'vegetables', uom: '1 Kg', dish_code: 'IVY', local_rupees: 49, blinkit_rupees: 65, instamart_rupees: 60, raithu_rupees: 42, suggested_acr_rupees: 45 },
  { item_key: 'sna', item_name: 'Snake Gourd', category: 'vegetables', uom: '1 Pc', dish_code: 'SNA', local_rupees: 40, blinkit_rupees: 55, instamart_rupees: 50, raithu_rupees: 35, suggested_acr_rupees: 40 },
  { item_key: 'bee', item_name: 'Beetroot', category: 'vegetables', uom: '1 Kg', dish_code: 'BEE', local_rupees: 45, blinkit_rupees: 60, instamart_rupees: 55, raithu_rupees: 40, suggested_acr_rupees: 45 },
  { item_key: 'cha', item_name: 'Chamadumpa', category: 'vegetables', uom: '1 Kg', dish_code: 'CHA', local_rupees: 40, blinkit_rupees: 55, instamart_rupees: 50, raithu_rupees: 35, suggested_acr_rupees: 40 },
  { item_key: 'swp', item_name: 'Sweet Potato', category: 'vegetables', uom: '1 Kg', dish_code: 'SWP', local_rupees: 44, blinkit_rupees: 55, instamart_rupees: 52, raithu_rupees: 38, suggested_acr_rupees: 40 },
  { item_key: 'lem', item_name: 'Lemon (12 pcs)', category: 'vegetables', uom: '12 Pcs', dish_code: 'LEM', local_rupees: 100, blinkit_rupees: 120, instamart_rupees: 110, raithu_rupees: 90, suggested_acr_rupees: 100 },
  { item_key: 'raw', item_name: 'Pachi Aratikaya', category: 'vegetables', uom: '1 Pc', dish_code: 'RAW', local_rupees: 30, blinkit_rupees: 40, instamart_rupees: 38, raithu_rupees: 25, suggested_acr_rupees: 27 },

  // Fruits — buy at Local
  { item_key: 'ban_amr', item_name: 'Banana Amrutha', category: 'fruits', uom: '1 Kg', dish_code: 'BAN', local_rupees: 60, blinkit_rupees: 153, instamart_rupees: 82, raithu_rupees: 60, suggested_acr_rupees: 59 },
  { item_key: 'pap', item_name: 'Papaya', category: 'fruits', uom: '1 Kg', dish_code: 'PAP', local_rupees: 35, blinkit_rupees: 55, instamart_rupees: 50, raithu_rupees: 30, suggested_acr_rupees: 40 },
  { item_key: 'ban_rob', item_name: 'Banana Robusta', category: 'fruits', uom: '1 Kg', dish_code: null, local_rupees: 60, blinkit_rupees: 140, instamart_rupees: 155, raithu_rupees: 60, suggested_acr_rupees: 59 },
  { item_key: 'wml', item_name: 'Water Melon', category: 'fruits', uom: '1 Kg', dish_code: 'WML', local_rupees: 29, blinkit_rupees: null, instamart_rupees: 90, raithu_rupees: 29, suggested_acr_rupees: 39 },
  { item_key: 'mos', item_name: 'Mousambi', category: 'fruits', uom: '1 Kg', dish_code: 'MOS', local_rupees: 48, blinkit_rupees: 65, instamart_rupees: 130, raithu_rupees: 48, suggested_acr_rupees: 59 },
  { item_key: 'man', item_name: 'Mango', category: 'fruits', uom: '1 Kg', dish_code: 'MAN', local_rupees: 117, blinkit_rupees: null, instamart_rupees: 140, raithu_rupees: 117, suggested_acr_rupees: 129 },
  { item_key: 'pom', item_name: 'Pomegranate', category: 'fruits', uom: '1 Kg', dish_code: 'POM', local_rupees: 143, blinkit_rupees: 244, instamart_rupees: 217, raithu_rupees: 143, suggested_acr_rupees: 159 },
  { item_key: 'gra_grn', item_name: 'Grapes Green', category: 'fruits', uom: '1 Kg', dish_code: 'GRA', local_rupees: 156, blinkit_rupees: null, instamart_rupees: 555, raithu_rupees: 156, suggested_acr_rupees: 169 },
  { item_key: 'gra_blk', item_name: 'Grapes Black', category: 'fruits', uom: '1 Kg', dish_code: null, local_rupees: 156, blinkit_rupees: null, instamart_rupees: 524, raithu_rupees: 156, suggested_acr_rupees: 169 },
  { item_key: 'gra_imp', item_name: 'Grapes Imported', category: 'fruits', uom: '1 Kg', dish_code: null, local_rupees: null, blinkit_rupees: 524, instamart_rupees: 524, raithu_rupees: null, suggested_acr_rupees: 299 },
  { item_key: 'app_sim', item_name: 'Apple Simla', category: 'fruits', uom: '1 Kg', dish_code: 'APP', local_rupees: 156, blinkit_rupees: 328, instamart_rupees: null, raithu_rupees: 156, suggested_acr_rupees: 179 },
  { item_key: 'app_fuji', item_name: 'Apple Fuji', category: 'fruits', uom: '1 Kg', dish_code: null, local_rupees: null, blinkit_rupees: 444, instamart_rupees: null, raithu_rupees: 300, suggested_acr_rupees: 399 },
  { item_key: 'app_was', item_name: 'Apple Washington', category: 'fruits', uom: '1 Kg', dish_code: null, local_rupees: 299, blinkit_rupees: 550, instamart_rupees: null, raithu_rupees: 299, suggested_acr_rupees: 349 },
  { item_key: 'app_gala', item_name: 'Apple Royal Gala', category: 'fruits', uom: '1 Kg', dish_code: null, local_rupees: null, blinkit_rupees: 427, instamart_rupees: 358, raithu_rupees: null, suggested_acr_rupees: 399 },
  { item_key: 'org', item_name: 'Orange Nagpur', category: 'fruits', uom: '1 Kg', dish_code: 'ORG', local_rupees: 82, blinkit_rupees: null, instamart_rupees: 156, raithu_rupees: 82, suggested_acr_rupees: 99 },
  { item_key: 'coc', item_name: 'Coconut', category: 'fruits', uom: '1 Pc', dish_code: 'COC', local_rupees: null, blinkit_rupees: 89, instamart_rupees: 79, raithu_rupees: null, suggested_acr_rupees: 109 },
  { item_key: 'app_cult', item_name: 'Cultivated Apple', category: 'fruits', uom: '1 Kg', dish_code: null, local_rupees: null, blinkit_rupees: 260, instamart_rupees: 260, raithu_rupees: null, suggested_acr_rupees: 299 },
  { item_key: 'gua', item_name: 'Guava', category: 'fruits', uom: '1 Kg', dish_code: null, local_rupees: 59, blinkit_rupees: 330, instamart_rupees: 126, raithu_rupees: 59, suggested_acr_rupees: 79 },
  { item_key: 'kiwi', item_name: 'Kiwi Fruits', category: 'fruits', uom: '1 Kg', dish_code: null, local_rupees: null, blinkit_rupees: 437, instamart_rupees: 464, raithu_rupees: null, suggested_acr_rupees: 499 },
  { item_key: 'musk', item_name: 'Musk Melon', category: 'fruits', uom: '1 Kg', dish_code: null, local_rupees: 27, blinkit_rupees: 283, instamart_rupees: 188, raithu_rupees: 27, suggested_acr_rupees: 49 },
  { item_key: 'pear', item_name: 'Pears', category: 'fruits', uom: '1 Kg', dish_code: null, local_rupees: 156, blinkit_rupees: 234, instamart_rupees: 152, raithu_rupees: 156, suggested_acr_rupees: 179 },
];

export function seedRowsToDbRows(observedOn, seedRows = PRICE_BOARD_SEED_20260906) {
  return seedRows.map((r, i) => ({
    observed_on: observedOn,
    item_key: r.item_key,
    item_name: r.item_name,
    category: r.category,
    uom: r.uom,
    dish_code: r.dish_code || null,
    sort_order: i + 1,
    local_paise: rupeesToPaise(r.local_rupees),
    blinkit_paise: rupeesToPaise(r.blinkit_rupees),
    instamart_paise: rupeesToPaise(r.instamart_rupees),
    raithu_paise: rupeesToPaise(r.raithu_rupees),
    suggested_acr_paise: rupeesToPaise(r.suggested_acr_rupees),
  }));
}

/** Map linked dish unit/note → admin price-board UOM label. */
export function uomLabelFromDish(dish) {
  if (!dish) return null;
  const unit = String(dish.unit || '').toLowerCase();
  const note = String(dish.note || '').toLowerCase();
  if (unit === 'pc') {
    if (note.includes('bunch')) return '1 Bunch';
    if (/\b12\b/.test(note) || note.includes('12 pcs')) return '12 Pcs';
    return '1 Pc';
  }
  if (unit === 'pack') return '1 Pack';
  if (unit === 'l') return '1 L';
  if (unit === 'kg') return '1 Kg';
  return null;
}

export function enrichPriceBoardRow(row, dishByCode = new Map()) {
  const cost_paise = costPaiseFromRow(row);
  const cost_source = costSourceForCategory(row.category);
  const dish = row.dish_code ? dishByCode.get(String(row.dish_code).toUpperCase()) : null;
  const sell_paise = dish ? Number(dish.price_paise) : null;
  const { margin_paise, margin_pct } = marginFromSellAndCost(sell_paise, cost_paise);
  const suggested = Number(row.suggested_acr_paise);
  const suggestedMargin = marginFromSellAndCost(
    Number.isFinite(suggested) ? suggested : null,
    cost_paise,
  );
  const uomFromDish = uomLabelFromDish(dish);
  return {
    ...row,
    // Linked menu dishes: UOM follows menu.js (not stale board rows).
    uom: uomFromDish || row.uom || '1 Kg',
    cost_source,
    cost_paise,
    sell_paise: Number.isFinite(sell_paise) ? sell_paise : null,
    sell_linked: Boolean(dish),
    margin_paise,
    margin_pct,
    suggested_margin_paise: suggestedMargin.margin_paise,
    suggested_margin_pct: suggestedMargin.margin_pct,
  };
}

/** Map price-board UOM text → dish unit. */
export function unitFromUom(uom) {
  const s = String(uom || '').toLowerCase();
  if (s.includes('bunch') || s.includes('pc') || s.includes('piece') || s.includes('pcs')) return 'pc';
  if (s.includes('l') && !s.includes('kg')) return 'L';
  if (s.includes('pack')) return 'pack';
  return 'kg';
}

/** Build a unique dish code (2–8 A-Z0-9) from item_key / name. */
export function suggestDishCode(itemKey, itemName, usedCodes = new Set()) {
  const used = new Set([...usedCodes].map((c) => String(c).toUpperCase()));
  const fromKey = String(itemKey || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const fromName = String(itemName || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  let base = (fromKey || fromName || 'ITEM').slice(0, 8);
  if (base.length < 2) base = (base + 'XX').slice(0, 2);
  if (!used.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const suffix = String(i);
    const code = (base.slice(0, Math.max(2, 8 - suffix.length)) + suffix).slice(0, 8);
    if (!used.has(code)) return code;
  }
  return `X${Date.now().toString(36).toUpperCase()}`.replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

export function normalizeItemKey(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}
