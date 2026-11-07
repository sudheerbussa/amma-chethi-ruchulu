/** Tenali homely menu — prices in paise. Codes fit WhatsApp list ids. */
import { SEED_AMMAS } from './ammas.js';

export const MENU_VERSION = 25;

/**
 * Admin / kitchen categories (Admin panel, posters, MENU_LIST grouping).
 * SKU prefixes: A meals · B biryani · C veg · D nonveg · E packs · S student menu
 */
export const CATEGORIES = [
  { id: 'student', title: 'Student menu', emoji: '🎒' },
  { id: 'meals', title: 'Rice & meals', emoji: '🍚' },
  { id: 'biryani', title: 'Biryanis 🔥', emoji: '🍛' },
  { id: 'veg', title: 'Veg specials', emoji: '🟢' },
  { id: 'nonveg', title: 'Non-veg curries', emoji: '🔴' },
  { id: 'packs', title: 'Party packs', emoji: '🍱' },
];

/**
 * Customer order browse (Flow + button fallback).
 * Student menu available for lunch and dinner browse (meal: both).
 * Sunday party dinner still uses packs only.
 */
export const BROWSE_CATEGORIES = [
  { id: 'student', title: 'Student menu', emoji: '🎒' },
  { id: 'veg', title: 'Veg', emoji: '🟢' },
  { id: 'nonveg', title: 'Non-veg', emoji: '🔴' },
];

/**
 * Map a dish’s admin category → customer browse group.
 * Meals / biryanis / packs fold into veg or nonveg; student stays its own group.
 */
export function dishBrowseGroup(dish) {
  const code = String(dish?.code || '').toUpperCase();
  const cat = String(dish?.category || '');
  if (cat === 'student') return 'student';
  // Party packs only on Sunday party dinner — do not fold into Veg/Non-veg
  if (cat === 'packs') return 'packs';
  if (cat === 'nonveg') return 'nonveg';
  if (cat === 'veg') return 'veg';
  if (cat === 'meals') {
    if (code === 'A06' || code === 'A07' || code === 'A09') return 'nonveg';
    return 'veg';
  }
  if (cat === 'biryani') {
    if (code === 'B01' || code === 'B02' || code === 'B03') return 'veg';
    return 'nonveg';
  }
  return 'veg';
}

export function isBrowseCategoryId(id) {
  const t = String(id || '');
  return t === 'student' || t === 'veg' || t === 'nonveg' || t === 'packs';
}

export function browseCategoryLabel(id) {
  const t = String(id || '');
  if (t === 'packs') return 'Party packs';
  if (t === 'student') return 'Student menu';
  const browse = BROWSE_CATEGORIES.find((c) => c.id === t);
  if (browse) return browse.title;
  return categoryLabel(t);
}

/** Catalog / Meta product_type label. */
export function catalogProductType(categoryId) {
  const i = CATEGORIES.findIndex((c) => c.id === categoryId);
  const cat = CATEGORIES[i];
  if (!cat) return String(categoryId || 'Menu');
  const n = String(i + 1).padStart(2, '0');
  return `${n} · ${cat.title.replace(/\s*🔥\s*/g, '').trim()}`;
}

function cook(id) {
  const a = SEED_AMMAS.find((x) => x.id === id);
  return { amma_id: id, cook_name: a?.name || 'Amma Kitchen' };
}

const PACK_CONTENTS =
  'Chicken Curry + Chicken Fry + Biryani Rice + Onion & Lemon Salad + Raitha + Kaliya';

/** @type {Array<{
 *  code: string,
 *  name: string,
 *  category: string,
 *  meal: 'lunch'|'dinner'|'both',
 *  price_paise: number,
 *  mrp_paise?: number,
 *  cook_name: string,
 *  amma_id?: string,
 *  active: boolean,
 *  note?: string,
 *  advance_only?: boolean
 * }>} */
export const MENU_DISHES = [
  // ━━━━━━━ S## Student menu (₹80 plates + ₹25 add-ons · lunch & dinner) ━━━━━━━
  {
    code: 'S01',
    name: 'Tomato Pappu + Fry + Rice',
    category: 'student',
    meal: 'both',
    price_paise: 8000,
    ...cook('sujatha'),
    active: true,
    note: 'Student plate · seasonal fry',
  },
  {
    code: 'S02',
    name: 'Sambar + Veg Fry + Rice',
    category: 'student',
    meal: 'both',
    price_paise: 8000,
    ...cook('sujatha'),
    active: true,
    note: 'Student plate',
  },
  {
    code: 'S03',
    name: 'Rasam + Potato Fry + Rice',
    category: 'student',
    meal: 'both',
    price_paise: 8000,
    ...cook('sujatha'),
    active: true,
    note: 'Student plate',
  },
  {
    code: 'S04',
    name: 'Dal + Cabbage/Gobi Fry + Rice',
    category: 'student',
    meal: 'both',
    price_paise: 8000,
    ...cook('sujatha'),
    active: true,
    note: 'Student plate · cabbage or cauliflower fry',
  },
  {
    code: 'S05',
    name: 'Add-on: Pappu',
    category: 'student',
    meal: 'both',
    price_paise: 2500,
    ...cook('sujatha'),
    active: true,
    note: 'Student extra · one serving',
  },
  {
    code: 'S06',
    name: 'Add-on: Sambar',
    category: 'student',
    meal: 'both',
    price_paise: 2500,
    ...cook('sujatha'),
    active: true,
    note: 'Student extra · one serving',
  },
  {
    code: 'S07',
    name: 'Add-on: Rasam',
    category: 'student',
    meal: 'both',
    price_paise: 2500,
    ...cook('sujatha'),
    active: true,
    note: 'Student extra · one serving',
  },
  {
    code: 'S08',
    name: 'Add-on: Veg curry',
    category: 'student',
    meal: 'both',
    price_paise: 2500,
    ...cook('sujatha'),
    active: true,
    note: 'Student extra · kitchen picks today’s curry',
  },
  {
    code: 'S09',
    name: 'Add-on: Veg fry',
    category: 'student',
    meal: 'both',
    price_paise: 2500,
    ...cook('sujatha'),
    active: true,
    note: 'Student extra · kitchen picks today’s fry',
  },
  {
    code: 'S10',
    name: 'Lemon Rice',
    category: 'student',
    meal: 'both',
    price_paise: 8000,
    ...cook('sujatha'),
    active: true,
    note: 'Student plate · was A03',
  },
  {
    code: 'S11',
    name: 'Tomato Rice',
    category: 'student',
    meal: 'both',
    price_paise: 8000,
    ...cook('sujatha'),
    active: true,
    note: 'Student plate · was A04',
  },
  {
    code: 'S12',
    name: 'Curd Rice',
    category: 'student',
    meal: 'both',
    price_paise: 8000,
    ...cook('sujatha'),
    active: true,
    note: 'Student plate',
  },
  {
    code: 'S13',
    name: 'Mint Rice',
    category: 'student',
    meal: 'both',
    price_paise: 8000,
    ...cook('sujatha'),
    active: true,
    note: 'Student plate',
  },
  {
    code: 'S14',
    name: 'Fried Rice',
    category: 'student',
    meal: 'both',
    price_paise: 8000,
    ...cook('sujatha'),
    active: true,
    note: 'Student plate · veg',
  },
  {
    code: 'S15',
    name: 'Veg Pulao',
    category: 'student',
    meal: 'both',
    price_paise: 8000,
    ...cook('sujatha'),
    active: true,
    note: 'Student plate',
  },
  {
    code: 'S16',
    name: 'Student Veg Biryani',
    category: 'student',
    meal: 'both',
    price_paise: 8000,
    ...cook('sujatha'),
    active: true,
    note: 'Student plate · not full biryani size',
  },

  // ━━━━━━━ A## Rice & meals (Catalog first — letter A sorts first) ━━━━━━━
  { code: 'A01', name: 'Plain Rice (1 bowl)', category: 'meals', meal: 'both', price_paise: 4000, ...cook('sujatha'), active: true },
  { code: 'A02', name: 'Jeera Rice', category: 'meals', meal: 'both', price_paise: 7000, ...cook('sujatha'), active: true },
  {
    code: 'A03',
    name: 'Lemon Rice',
    category: 'meals',
    meal: 'both',
    price_paise: 7000,
    ...cook('sujatha'),
    active: false,
    note: 'Moved to Student lunch S10 @ ₹80',
  },
  {
    code: 'A04',
    name: 'Tomato Rice',
    category: 'meals',
    meal: 'both',
    price_paise: 7000,
    ...cook('sujatha'),
    active: false,
    note: 'Moved to Student lunch S11 @ ₹80',
  },
  { code: 'A05', name: 'Veg Meal', category: 'meals', meal: 'both', price_paise: 10000, ...cook('sujatha'), active: true, note: 'Rice + 2 curries + pappu + pickle + papad' },
  { code: 'A06', name: 'Non-Veg Meal', category: 'meals', meal: 'both', price_paise: 13000, ...cook('sujatha'), active: true, note: 'Rice + chicken + pappu + pickle' },
  { code: 'A07', name: 'Special Amma Meal', category: 'meals', meal: 'both', price_paise: 19000, ...cook('sujatha'), active: true, note: 'Rice + veg + nonveg + pappu + curd + pickle' },
  { code: 'A08', name: 'Chapathi + veg curry + pappu', category: 'meals', meal: 'both', price_paise: 9000, ...cook('sujatha'), active: true, note: 'Chapathi meal' },
  { code: 'A09', name: 'Chapathi + chicken + pappu', category: 'meals', meal: 'both', price_paise: 13000, ...cook('sujatha'), active: true, note: 'Chapathi meal' },
  { code: 'A10', name: 'Chapathi (1)', category: 'meals', meal: 'both', price_paise: 1000, ...cook('sujatha'), active: true, note: '1 chapathi' },

  // ━━━━━━━ B## Biryanis ━━━━━━━
  { code: 'B01', name: 'Mushroom Biryani', category: 'biryani', meal: 'both', price_paise: 20000, ...cook('sujatha'), active: true, note: 'Full plate · mushrooms' },
  { code: 'B02', name: 'Soya / Mealmaker Biryani', category: 'biryani', meal: 'both', price_paise: 18000, ...cook('sujatha'), active: true, note: 'Full plate' },
  { code: 'B03', name: 'Paneer Biryani', category: 'biryani', meal: 'both', price_paise: 30000, ...cook('sujatha'), active: true, note: 'Full plate' },
  { code: 'B04', name: 'Chicken Dum Biryani (1)', category: 'biryani', meal: 'both', price_paise: 15900, mrp_paise: 18000, ...cook('sujatha'), active: true, note: 'Single · 1 person' },
  { code: 'B05', name: 'Chicken Dum Biryani (2)', category: 'biryani', meal: 'both', price_paise: 29900, mrp_paise: 34000, ...cook('sujatha'), active: true, note: 'Couple · 2 persons' },
  { code: 'B06', name: 'Chicken Dum Biryani (4)', category: 'biryani', meal: 'both', price_paise: 54900, mrp_paise: 65000, ...cook('sujatha'), active: true, note: 'Family · 4 persons' },
  { code: 'B07', name: 'Spl Chicken Fry Biryani (1)', category: 'biryani', meal: 'both', price_paise: 17900, mrp_paise: 20000, ...cook('sujatha'), active: true, note: 'Single · 1 person' },
  { code: 'B08', name: 'Spl Chicken Fry Biryani (2)', category: 'biryani', meal: 'both', price_paise: 32900, mrp_paise: 38000, ...cook('sujatha'), active: true, note: 'Couple · 2 persons' },
  { code: 'B09', name: 'Spl Chicken Fry Biryani (4)', category: 'biryani', meal: 'both', price_paise: 59900, mrp_paise: 72000, ...cook('sujatha'), active: true, note: 'Family · 4 persons' },

  // ━━━━━━━ C## Veg ━━━━━━━
  { code: 'C01', name: 'Mushroom Curry', category: 'veg', meal: 'both', price_paise: 8000, ...cook('saroja'), active: true },

  // ━━━━━━━ D## Non-veg ━━━━━━━
  { code: 'D01', name: 'Chicken Curry (Single)', category: 'nonveg', meal: 'both', price_paise: 14900, ...cook('kamala'), active: true, note: 'Homestyle gravy' },
  { code: 'D02', name: 'Chicken Curry (Family)', category: 'nonveg', meal: 'both', price_paise: 29900, ...cook('kamala'), active: true, note: 'Full plate' },
  { code: 'D03', name: 'Andhra Chicken Fry (Single)', category: 'nonveg', meal: 'both', price_paise: 15900, ...cook('hymavathi'), active: true },
  { code: 'D04', name: 'Andhra Chicken Fry (Family)', category: 'nonveg', meal: 'both', price_paise: 29900, ...cook('hymavathi'), active: true, note: 'Full plate' },
  { code: 'D05', name: 'Gongura Chicken (Single)', category: 'nonveg', meal: 'both', price_paise: 15900, ...cook('hymavathi'), active: true },
  { code: 'D06', name: 'Gongura Chicken (Family)', category: 'nonveg', meal: 'both', price_paise: 29900, ...cook('hymavathi'), active: true, note: 'Full plate' },
  { code: 'D07', name: 'Special Chicken Fry', category: 'nonveg', meal: 'both', price_paise: 29900, ...cook('hymavathi'), active: true },
  { code: 'D08', name: 'Chicken Liver & Gizzard Fry (S)', category: 'nonveg', meal: 'both', price_paise: 10000, ...cook('kamala'), active: true },
  { code: 'D09', name: 'Chicken Liver & Gizzard Fry (F)', category: 'nonveg', meal: 'both', price_paise: 18000, ...cook('kamala'), active: true, note: 'Full' },
  { code: 'D10', name: 'Mutton Curry (Single)', category: 'nonveg', meal: 'both', price_paise: 29900, ...cook('ramadevi'), active: true, note: 'Tender pieces · gravy' },
  { code: 'D11', name: 'Mutton Curry (Family)', category: 'nonveg', meal: 'both', price_paise: 54900, ...cook('ramadevi'), active: true, note: 'Full plate' },
  { code: 'D12', name: 'Gongura Mutton (Single)', category: 'nonveg', meal: 'both', price_paise: 31900, ...cook('ramadevi'), active: true },
  { code: 'D13', name: 'Gongura Mutton (Family)', category: 'nonveg', meal: 'both', price_paise: 59900, ...cook('ramadevi'), active: true, note: 'Full plate' },
  { code: 'D14', name: 'Mutton Fry (Single)', category: 'nonveg', meal: 'both', price_paise: 32900, ...cook('ramadevi'), active: true },
  { code: 'D15', name: 'Mutton Fry (Family)', category: 'nonveg', meal: 'both', price_paise: 59900, ...cook('ramadevi'), active: true, note: 'Full plate' },
  { code: 'D16', name: 'Mutton Keema Curry (Single)', category: 'nonveg', meal: 'both', price_paise: 29900, ...cook('ramadevi'), active: true },
  { code: 'D17', name: 'Mutton Keema Curry (Family)', category: 'nonveg', meal: 'both', price_paise: 54900, ...cook('ramadevi'), active: true, note: 'Full plate' },
  { code: 'D18', name: 'Chepala Pulusu (2 pcs)', category: 'nonveg', meal: 'both', price_paise: 15900, ...cook('ramadevi'), active: true, note: 'Nellore style' },
  { code: 'D19', name: 'Chepala Pulusu (4 pcs)', category: 'nonveg', meal: 'both', price_paise: 29900, ...cook('ramadevi'), active: true, note: 'Family · 4 pieces' },
  { code: 'D20', name: 'Chepala Fry (1 pc)', category: 'nonveg', meal: 'both', price_paise: 9900, ...cook('ramadevi'), active: true, note: '1 big piece' },
  { code: 'D21', name: 'Chepala Fry (2 pcs)', category: 'nonveg', meal: 'both', price_paise: 17900, ...cook('ramadevi'), active: true },
  { code: 'D22', name: 'Royyalu Iguru (Single)', category: 'nonveg', meal: 'both', price_paise: 22900, ...cook('ramadevi'), active: true, note: 'Prawns gravy' },
  { code: 'D23', name: 'Royyalu Iguru (Family)', category: 'nonveg', meal: 'both', price_paise: 39900, ...cook('ramadevi'), active: true, note: 'Full plate' },
  { code: 'D24', name: 'Gongura Royyalu (Single)', category: 'nonveg', meal: 'both', price_paise: 23900, ...cook('ramadevi'), active: true },
  { code: 'D25', name: 'Gongura Royyalu (Family)', category: 'nonveg', meal: 'both', price_paise: 42900, ...cook('ramadevi'), active: true, note: 'Full plate' },
  { code: 'D26', name: 'Pacchi Royyalu Fry (Single)', category: 'nonveg', meal: 'both', price_paise: 23900, ...cook('ramadevi'), active: true },
  { code: 'D27', name: 'Pacchi Royyalu Fry (Family)', category: 'nonveg', meal: 'both', price_paise: 42900, ...cook('ramadevi'), active: true, note: 'Full plate' },
  { code: 'D28', name: 'Egg Curry (2 eggs)', category: 'nonveg', meal: 'both', price_paise: 7000, ...cook('kamala'), active: true, note: 'Kodiguddu pulusu' },
  { code: 'D29', name: 'Egg Fry / Bhurji', category: 'nonveg', meal: 'both', price_paise: 7000, ...cook('kamala'), active: true },
  { code: 'D30', name: 'Double Egg Omelette', category: 'nonveg', meal: 'both', price_paise: 4000, ...cook('kamala'), active: true, note: 'Special omelette' },
  { code: 'D31', name: 'Dabba Fry (250g)', category: 'nonveg', meal: 'both', price_paise: 20000, ...cook('ramadevi'), active: true },
  { code: 'D32', name: 'Chicken Kura (500g)', category: 'nonveg', meal: 'both', price_paise: 49900, ...cook('kamala'), active: true },
  { code: 'D33', name: 'Chicken Fry (500g)', category: 'nonveg', meal: 'both', price_paise: 49900, ...cook('hymavathi'), active: true },
  { code: 'D34', name: 'Mutton Kura (250g)', category: 'nonveg', meal: 'both', price_paise: 40000, ...cook('ramadevi'), active: true },
  { code: 'D35', name: 'Peetalu Fry (500g)', category: 'nonveg', meal: 'both', price_paise: 40000, ...cook('ramadevi'), active: true },

  // ━━━━━━━ E## Party packs ━━━━━━━
  {
    code: 'E01',
    name: '2 KG Party Pack',
    category: 'packs',
    meal: 'both',
    price_paise: 369900,
    ...cook('kamala'),
    active: true,
    note: `2KG Curry + 2KG Fry + 4KG rice · ${PACK_CONTENTS}`,
  },
  {
    code: 'E02',
    name: '3 KG Party Pack',
    category: 'packs',
    meal: 'both',
    price_paise: 534900,
    ...cook('kamala'),
    active: true,
    note: `3KG Curry + 3KG Fry + 6KG rice · ${PACK_CONTENTS}`,
  },
  {
    code: 'E03',
    name: '4 KG Party Pack',
    category: 'packs',
    meal: 'both',
    price_paise: 699900,
    ...cook('kamala'),
    active: true,
    note: `4KG Curry + 4KG Fry + 8KG rice · ${PACK_CONTENTS}`,
  },
  {
    code: 'E04',
    name: '5 KG Jumbo Party Pack',
    category: 'packs',
    meal: 'both',
    price_paise: 854900,
    ...cook('kamala'),
    active: true,
    note: `5KG Curry + 5KG Fry + 10KG rice · ${PACK_CONTENTS}`,
  },
];

/**
 * Legacy / prior serial SKUs → current A–E codes (cart, catalog taps, reorder).
 */
export const CODE_ALIASES = {
  // v17 serial → v18
  R01: 'A01',
  R02: 'A02',
  R03: 'A03',
  R04: 'A04',
  M01: 'A05',
  M02: 'A06',
  M03: 'A07',
  VG01: 'C01',
  NV01: 'D01',
  NV02: 'D02',
  NV03: 'D03',
  NV04: 'D04',
  NV05: 'D05',
  NV06: 'D06',
  NV07: 'D07',
  NV08: 'D08',
  NV09: 'D09',
  NV10: 'D10',
  NV11: 'D11',
  NV12: 'D12',
  NV13: 'D13',
  NV14: 'D14',
  NV15: 'D15',
  NV16: 'D16',
  NV17: 'D17',
  NV18: 'D18',
  NV19: 'D19',
  NV20: 'D20',
  NV21: 'D21',
  NV22: 'D22',
  NV23: 'D23',
  NV24: 'D24',
  NV25: 'D25',
  NV26: 'D26',
  NV27: 'D27',
  NV28: 'D28',
  NV29: 'D29',
  NV30: 'D30',
  NV31: 'D31',
  NV32: 'D32',
  NV33: 'D33',
  NV34: 'D34',
  NV35: 'D35',
  P01: 'E01',
  P02: 'E02',
  P03: 'E03',
  P04: 'E04',
  // older legacy → v18
  V11: 'C01',
  V12: 'B01',
  V13: 'B02',
  V14: 'B03',
  N33: 'B04',
  N33C: 'B05',
  N33F: 'B06',
  N34: 'B07',
  N34C: 'B08',
  N34F: 'B09',
  N03: 'D01',
  N03F: 'D02',
  N04: 'D03',
  N04F: 'D04',
  N05: 'D05',
  N05F: 'D06',
  N32: 'D07',
  N35: 'D08',
  N35F: 'D09',
  N36: 'D10',
  N36F: 'D11',
  N37: 'D12',
  N37F: 'D13',
  N25: 'D14',
  N25F: 'D15',
  N38: 'D16',
  N38F: 'D17',
  N20: 'D18',
  N20F: 'D19',
  N21: 'D20',
  N21D: 'D21',
  N22: 'D22',
  N22F: 'D23',
  N39: 'D24',
  N39F: 'D25',
  N40: 'D26',
  N40F: 'D27',
  N01: 'D28',
  N02: 'D29',
  N11: 'D30',
  N26: 'D31',
  N27: 'D32',
  N28: 'D33',
  N29: 'D34',
  N31: 'D35',
};

export function resolveDishCode(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return c;
  return CODE_ALIASES[c] || c;
}

const SEED_INDEX = new Map(MENU_DISHES.map((d, i) => [d.code, i]));

export function sortDishesBySeed(dishes) {
  return [...dishes].sort((a, b) => {
    const ia = SEED_INDEX.has(a.code) ? SEED_INDEX.get(a.code) : 1000;
    const ib = SEED_INDEX.has(b.code) ? SEED_INDEX.get(b.code) : 1000;
    if (ia !== ib) return ia - ib;
    return String(a.code).localeCompare(String(b.code));
  });
}

export const DELIVERY_ZONES = [
  { id: 'z1', title: '0–3 km', fee_paise: 3000 },
  { id: 'z2', title: '3–6 km', fee_paise: 4500 },
  { id: 'z3', title: 'Above 6 km', fee_paise: 6000 },
];

export function categoryLabel(id) {
  return CATEGORIES.find((c) => c.id === id)?.title || id;
}

export function deliveryFeePaise(zoneId, foodPaise, freeAbovePaise = 30000) {
  const threshold = Number(freeAbovePaise);
  if (Number.isFinite(threshold) && foodPaise >= threshold) return 0;
  const zone = DELIVERY_ZONES.find((z) => z.id === zoneId);
  return zone ? zone.fee_paise : 4500;
}
