/** Tenali homely menu — prices in paise. Codes fit WhatsApp list ids. */
export const MENU_VERSION = 3;

export const CATEGORIES = [
  { id: 'veg', title: 'Veg curries', emoji: '🟢' },
  { id: 'nonveg', title: 'Non-veg', emoji: '🔴' },
  { id: 'meals', title: 'Rice & meals', emoji: '🍚' },
  { id: 'combos', title: 'Combos', emoji: '🍱' },
  { id: 'extras', title: 'Extras', emoji: '➕' },
];

/** @type {Array<{
 *  code: string,
 *  name: string,
 *  category: string,
 *  meal: 'lunch'|'dinner'|'both',
 *  price_paise: number,
 *  cook_name: string,
 *  max_portions: number,
 *  portions_sold: number,
 *  active: boolean,
 *  note?: string,
 *  advance_only?: boolean
 * }>} */
export const MENU_DISHES = [
  // Veg curries
  { code: 'V01', name: 'Tomato Pappu', category: 'veg', meal: 'both', price_paise: 6000, cook_name: 'Amma Kitchen', max_portions: 30, portions_sold: 0, active: true },
  { code: 'V02', name: 'Dosakaya Pappu', category: 'veg', meal: 'both', price_paise: 6500, cook_name: 'Amma Kitchen', max_portions: 30, portions_sold: 0, active: true },
  { code: 'V03', name: 'Thotakura Pappu', category: 'veg', meal: 'both', price_paise: 7000, cook_name: 'Amma Kitchen', max_portions: 30, portions_sold: 0, active: true },
  { code: 'V04', name: 'Bendakaya Fry', category: 'veg', meal: 'both', price_paise: 7000, cook_name: 'Amma Kitchen', max_portions: 25, portions_sold: 0, active: true },
  { code: 'V05', name: 'Aloo Fry', category: 'veg', meal: 'both', price_paise: 7000, cook_name: 'Amma Kitchen', max_portions: 25, portions_sold: 0, active: true },
  { code: 'V10', name: 'Aloo Kurma', category: 'veg', meal: 'both', price_paise: 7000, cook_name: 'Amma Kitchen', max_portions: 25, portions_sold: 0, active: true },
  { code: 'V06', name: 'Beans-Carrot Curry', category: 'veg', meal: 'both', price_paise: 7500, cook_name: 'Amma Kitchen', max_portions: 25, portions_sold: 0, active: true },
  { code: 'V07', name: 'Vankaya / Gutti Vankaya', category: 'veg', meal: 'both', price_paise: 8000, cook_name: 'Amma Kitchen', max_portions: 25, portions_sold: 0, active: true },
  { code: 'V08', name: 'Mixed Veg Curry', category: 'veg', meal: 'both', price_paise: 8000, cook_name: 'Amma Kitchen', max_portions: 25, portions_sold: 0, active: true },
  { code: 'V09', name: 'Paneer Butter Masala', category: 'veg', meal: 'both', price_paise: 12000, cook_name: 'Amma Kitchen', max_portions: 20, portions_sold: 0, active: true },
  { code: 'V11', name: 'Kaju Paneer', category: 'veg', meal: 'both', price_paise: 12000, cook_name: 'Amma Kitchen', max_portions: 20, portions_sold: 0, active: true },

  // Non-veg
  { code: 'N01', name: 'Egg Curry (2 eggs)', category: 'nonveg', meal: 'both', price_paise: 8000, cook_name: 'Amma Kitchen', max_portions: 25, portions_sold: 0, active: true },
  { code: 'N02', name: 'Egg Fry', category: 'nonveg', meal: 'both', price_paise: 7000, cook_name: 'Amma Kitchen', max_portions: 25, portions_sold: 0, active: true },
  { code: 'N08', name: 'Egg Bhurji', category: 'nonveg', meal: 'both', price_paise: 7000, cook_name: 'Amma Kitchen', max_portions: 25, portions_sold: 0, active: true },
  { code: 'N03', name: 'Chicken Curry (Andhra)', category: 'nonveg', meal: 'both', price_paise: 14000, cook_name: 'Amma Kitchen', max_portions: 20, portions_sold: 0, active: true, note: '4-5 pieces' },
  { code: 'N04', name: 'Chicken Fry', category: 'nonveg', meal: 'both', price_paise: 15000, cook_name: 'Amma Kitchen', max_portions: 20, portions_sold: 0, active: true },
  { code: 'N09', name: 'Pepper Chicken', category: 'nonveg', meal: 'both', price_paise: 15000, cook_name: 'Amma Kitchen', max_portions: 20, portions_sold: 0, active: true },
  { code: 'N05', name: 'Gongura Chicken', category: 'nonveg', meal: 'both', price_paise: 16000, cook_name: 'Amma Kitchen', max_portions: 15, portions_sold: 0, active: true },
  { code: 'N06', name: 'Natu Kodi Curry', category: 'nonveg', meal: 'both', price_paise: 18000, cook_name: 'Amma Kitchen', max_portions: 12, portions_sold: 0, active: true },
  { code: 'N07', name: 'Mutton Curry', category: 'nonveg', meal: 'both', price_paise: 22000, cook_name: 'Amma Kitchen', max_portions: 8, portions_sold: 0, active: true, advance_only: true, note: 'Order in advance' },

  // Rice & meals
  { code: 'R01', name: 'Plain Rice (1 bowl)', category: 'meals', meal: 'both', price_paise: 4000, cook_name: 'Amma Kitchen', max_portions: 40, portions_sold: 0, active: true },
  { code: 'R02', name: 'Curd Rice', category: 'meals', meal: 'both', price_paise: 6000, cook_name: 'Amma Kitchen', max_portions: 30, portions_sold: 0, active: true },
  { code: 'R03', name: 'Lemon Rice', category: 'meals', meal: 'both', price_paise: 7000, cook_name: 'Amma Kitchen', max_portions: 30, portions_sold: 0, active: true },
  { code: 'R04', name: 'Tomato Rice', category: 'meals', meal: 'both', price_paise: 7000, cook_name: 'Amma Kitchen', max_portions: 30, portions_sold: 0, active: true },
  { code: 'M01', name: 'Veg Meal', category: 'meals', meal: 'both', price_paise: 12000, cook_name: 'Amma Kitchen', max_portions: 25, portions_sold: 0, active: true, note: 'Rice+2 curries+pappu+pickle+papad' },
  { code: 'M02', name: 'Non-Veg Meal', category: 'meals', meal: 'both', price_paise: 16000, cook_name: 'Amma Kitchen', max_portions: 25, portions_sold: 0, active: true, note: 'Rice+chicken/egg+pappu+pickle' },
  { code: 'M03', name: 'Special Amma Meal', category: 'meals', meal: 'both', price_paise: 19000, cook_name: 'Amma Kitchen', max_portions: 20, portions_sold: 0, active: true, note: 'Rice+veg+nonveg+pappu+curd+pickle' },

  // Combos (good first orders)
  { code: 'C01', name: 'Veg Combo', category: 'combos', meal: 'both', price_paise: 11000, cook_name: 'Amma Kitchen', max_portions: 30, portions_sold: 0, active: true, note: 'Rice+2 veg+pappu+pickle' },
  { code: 'C02', name: 'Egg Combo', category: 'combos', meal: 'both', price_paise: 13000, cook_name: 'Amma Kitchen', max_portions: 25, portions_sold: 0, active: true, note: 'Rice+egg curry+1 veg+pickle' },
  { code: 'C03', name: 'Chicken Combo', category: 'combos', meal: 'both', price_paise: 17000, cook_name: 'Amma Kitchen', max_portions: 25, portions_sold: 0, active: true, note: 'Rice+chicken+1 veg+pickle' },

  // Extras
  { code: 'E01', name: 'Chapati / Roti (2 pcs)', category: 'extras', meal: 'both', price_paise: 3000, cook_name: 'Amma Kitchen', max_portions: 40, portions_sold: 0, active: true },
  { code: 'E02', name: 'Pickle / Chutney', category: 'extras', meal: 'both', price_paise: 2000, cook_name: 'Amma Kitchen', max_portions: 50, portions_sold: 0, active: true },
  { code: 'E03', name: 'Curd (small)', category: 'extras', meal: 'both', price_paise: 2000, cook_name: 'Amma Kitchen', max_portions: 40, portions_sold: 0, active: true },
  { code: 'E04', name: 'Papad', category: 'extras', meal: 'both', price_paise: 1000, cook_name: 'Amma Kitchen', max_portions: 50, portions_sold: 0, active: true },
];

export const DELIVERY_ZONES = [
  { id: 'z1', title: '0–3 km', fee_paise: 3000 },
  { id: 'z2', title: '3–6 km', fee_paise: 4500 },
  { id: 'z3', title: 'Above 6 km', fee_paise: 6000 },
];

export function categoryLabel(id) {
  return CATEGORIES.find((c) => c.id === id)?.title || id;
}

export function deliveryFeePaise(zoneId, foodPaise) {
  if (foodPaise >= 30000) return 0;
  const zone = DELIVERY_ZONES.find((z) => z.id === zoneId);
  return zone ? zone.fee_paise : 4500;
}
