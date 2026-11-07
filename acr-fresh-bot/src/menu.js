/** ACR-Fresh catalog — prices in paise. Vegetables priced per kg; packs 250 g–1 kg at order time. */

export const MENU_VERSION = 16;

/**
 * Customer-facing categories (Flow + buttons). Main catalog: vegetables + fruits only.
 * Dairy / staples / utilities are not orderable in-app — customers call admin (COD, unlisted).
 */
export const CATEGORIES = [
  { id: 'vegetables', title: 'Vegetables', title_te: 'కూరగాయలు', emoji: '🥬' },
  { id: 'fruits', title: 'Fruits', title_te: 'పండ్లు', emoji: '🍎' },
];

/** Standard produce pack sizes (kg) — gourds, beans, cucumber, etc. */
export const VEG_PACK_KG = [0.25, 0.5, 0.75, 1];

/** Bulk staples (onion, potato, tomato…) — min 500 g. */
export const VEG_PACK_KG_BULK = [0.5, 1];

/**
 * @typedef {{
 *  code: string,
 *  name: string,
 *  name_te?: string,
 *  category: string,
 *  meal: 'fresh'|'both',
 *  price_paise: number,
 *  unit?: 'kg'|'pc'|'L'|'pack',
 *  sizes_kg?: number[],
 *  cook_name?: string,
 *  amma_id?: string,
 *  active: boolean,
 *  note?: string,
 *  emergency?: boolean
 * }} FreshDish
 */

/** @type {FreshDish[]} */
export const MENU_DISHES = [
  // ── Vegetables (price_paise = per kg) ──
  { code: 'TOM', name: 'Tomato', name_te: 'టమాటా', category: 'vegetables', meal: 'both', price_paise: 4000, unit: 'kg', sizes_kg: VEG_PACK_KG_BULK, active: true },
  { code: 'ONI', name: 'Onion', name_te: 'ఉల్లిపాయ', category: 'vegetables', meal: 'both', price_paise: 3500, unit: 'kg', sizes_kg: VEG_PACK_KG_BULK, active: true },
  { code: 'POT', name: 'Potato', name_te: 'బంగాళాదుంప', category: 'vegetables', meal: 'both', price_paise: 3000, unit: 'kg', sizes_kg: VEG_PACK_KG_BULK, active: true },
  { code: 'CHI', name: 'Green chilli', name_te: 'పచ్చి మిరప', category: 'vegetables', meal: 'both', price_paise: 8000, unit: 'kg', sizes_kg: [0.25, 0.5], active: true },
  { code: 'GIN', name: 'Ginger', name_te: 'అల్లం', category: 'vegetables', meal: 'both', price_paise: 12000, unit: 'kg', sizes_kg: [0.25, 0.5], active: true },
  { code: 'GAR', name: 'Garlic', name_te: 'వెల్లుల్లి', category: 'vegetables', meal: 'both', price_paise: 16000, unit: 'kg', sizes_kg: [0.25, 0.5], active: true },
  { code: 'OKR', name: 'Ladies finger', name_te: 'బెండకాయ', category: 'vegetables', meal: 'both', price_paise: 5000, unit: 'kg', sizes_kg: VEG_PACK_KG, active: true },
  { code: 'BRI', name: 'Brinjal', name_te: 'వంకాయ', category: 'vegetables', meal: 'both', price_paise: 4500, unit: 'kg', sizes_kg: VEG_PACK_KG, active: true },
  { code: 'BAPATLAB', name: 'Bapatla brinjal', name_te: 'బాపట్ల వంకాయ', category: 'vegetables', meal: 'both', price_paise: 4400, unit: 'kg', sizes_kg: VEG_PACK_KG, active: true },
  { code: 'RID', name: 'Ridge gourd', name_te: 'బీరకాయ', category: 'vegetables', meal: 'both', price_paise: 4000, unit: 'kg', sizes_kg: VEG_PACK_KG, active: true },
  { code: 'BOT', name: 'Bottle gourd', name_te: 'సొరకాయ', category: 'vegetables', meal: 'both', price_paise: 3500, unit: 'pc', active: true, note: 'Per piece' },
  { code: 'BIT', name: 'Bitter gourd', name_te: 'కాకరకాయ', category: 'vegetables', meal: 'both', price_paise: 5000, unit: 'kg', sizes_kg: VEG_PACK_KG, active: true },
  { code: 'BEA', name: 'Beans', name_te: 'బీన్స్', category: 'vegetables', meal: 'both', price_paise: 6000, unit: 'kg', sizes_kg: VEG_PACK_KG, active: true },
  { code: 'CAR', name: 'Carrot', name_te: 'క్యారెట్', category: 'vegetables', meal: 'both', price_paise: 5000, unit: 'kg', sizes_kg: VEG_PACK_KG_BULK, active: true },
  { code: 'CAB', name: 'Cabbage', name_te: 'క్యాబేజీ', category: 'vegetables', meal: 'both', price_paise: 3000, unit: 'pc', active: true, note: 'Per piece · 300–600 g' },
  { code: 'CAU', name: 'Cauliflower', name_te: 'కాలీఫ్లవర్', category: 'vegetables', meal: 'both', price_paise: 4500, unit: 'pc', active: true, note: 'Per piece · 300–600 g' },
  { code: 'DRU', name: 'Drumstick', name_te: 'ములక్కాయ', category: 'vegetables', meal: 'both', price_paise: 7000, unit: 'pc', active: true, note: 'Per piece' },
  { code: 'THO', name: 'Thotakura', name_te: 'తోటకూర', category: 'vegetables', meal: 'both', price_paise: 4000, unit: 'kg', sizes_kg: [0.25, 0.5], active: true },
  { code: 'GON', name: 'Gongura', name_te: 'గోంగూర', category: 'vegetables', meal: 'both', price_paise: 5000, unit: 'pc', active: true, note: 'Per bunch' },
  { code: 'COR', name: 'Coriander bunch', name_te: 'కొత్తిమీర కట్ట', category: 'vegetables', meal: 'both', price_paise: 2000, unit: 'pc', active: true, note: 'Per bunch' },
  { code: 'CUR', name: 'Curry leaves bunch', name_te: 'కరివేపాకు కట్ట', category: 'vegetables', meal: 'both', price_paise: 1500, unit: 'pc', active: true, note: 'Per bunch' },
  { code: 'CUC', name: 'Dosakaya (Cucumber)', name_te: 'దోసకాయ', category: 'vegetables', meal: 'both', price_paise: 3500, unit: 'kg', sizes_kg: VEG_PACK_KG, active: true },
  { code: 'KDO', name: 'Keera dosakaya', name_te: 'కీర దోసకాయ', category: 'vegetables', meal: 'both', price_paise: 3500, unit: 'kg', sizes_kg: VEG_PACK_KG, active: true },
  { code: 'CAP', name: 'Capsicum', name_te: 'క్యాప్సికం', category: 'vegetables', meal: 'both', price_paise: 7000, unit: 'kg', sizes_kg: VEG_PACK_KG, active: true },
  { code: 'CLU', name: 'Goru chikkudu', name_te: 'గోరుచిక్కుడు', category: 'vegetables', meal: 'both', price_paise: 5500, unit: 'kg', sizes_kg: VEG_PACK_KG, active: true },
  { code: 'BRB', name: 'Pedda chikkudu (Broad beans)', name_te: 'పెద్ద చిక్కుడు', category: 'vegetables', meal: 'both', price_paise: 6000, unit: 'kg', sizes_kg: VEG_PACK_KG, active: true },
  { code: 'IVY', name: 'Ivy gourd', name_te: 'దొండకాయ', category: 'vegetables', meal: 'both', price_paise: 4500, unit: 'kg', sizes_kg: VEG_PACK_KG, active: true },
  { code: 'SNA', name: 'Snake gourd', name_te: 'పొట్లకాయ', category: 'vegetables', meal: 'both', price_paise: 4000, unit: 'pc', active: true, note: 'Per piece' },
  { code: 'BEE', name: 'Beetroot', name_te: 'బీట్‌రూట్', category: 'vegetables', meal: 'both', price_paise: 4500, unit: 'kg', sizes_kg: VEG_PACK_KG, active: true },
  { code: 'CHA', name: 'Chamadumpa', name_te: 'చామదుంప', category: 'vegetables', meal: 'both', price_paise: 4000, unit: 'kg', sizes_kg: VEG_PACK_KG_BULK, active: true },
  { code: 'SWP', name: 'Sweet potato', name_te: 'చిలకడదుంప', category: 'vegetables', meal: 'both', price_paise: 4000, unit: 'kg', sizes_kg: VEG_PACK_KG_BULK, active: true },
  { code: 'LEM', name: 'Lemon (12 pcs)', name_te: 'నిమ్మకాయ (12 కాయలు)', category: 'vegetables', meal: 'both', price_paise: 10000, unit: 'pc', active: true, note: '12 pcs pack' },
  { code: 'RAW', name: 'Raw banana', name_te: 'పచ్చి అరటికాయ', category: 'vegetables', meal: 'both', price_paise: 4000, unit: 'pc', active: true, note: 'Per piece' },

  // ── Fruits (price_paise = per kg unless unit pc) ──
  { code: 'BAN', name: 'Banana (ripe)', name_te: 'అరటిపండు', category: 'fruits', meal: 'both', price_paise: 5000, unit: 'kg', sizes_kg: [0.5, 1], active: true },
  { code: 'PAP', name: 'Papaya', name_te: 'బొప్పాయి', category: 'fruits', meal: 'both', price_paise: 4000, unit: 'kg', sizes_kg: [0.5, 1], active: true },
  { code: 'WML', name: 'Watermelon', name_te: 'పుచ్చకాయ', category: 'fruits', meal: 'both', price_paise: 2500, unit: 'kg', sizes_kg: [1, 2, 3], active: true, note: 'Per slice/piece weight' },
  { code: 'MOS', name: 'Sweet lime (Mosambi)', name_te: 'బత్తాయి', category: 'fruits', meal: 'both', price_paise: 6000, unit: 'kg', sizes_kg: [0.5, 1], active: true },
  { code: 'MAN', name: 'Mango', name_te: 'మామిడి', category: 'fruits', meal: 'both', price_paise: 12000, unit: 'kg', sizes_kg: [0.5, 1], active: true },
  { code: 'POM', name: 'Pomegranate', name_te: 'దానిమ్మ', category: 'fruits', meal: 'both', price_paise: 15000, unit: 'kg', sizes_kg: [0.5, 1], active: true },
  { code: 'GRA', name: 'Grapes', name_te: 'ద్రాక్ష', category: 'fruits', meal: 'both', price_paise: 8000, unit: 'kg', sizes_kg: [0.25, 0.5, 1], active: true },
  { code: 'APP', name: 'Apple', name_te: 'ఆపిల్', category: 'fruits', meal: 'both', price_paise: 18000, unit: 'kg', sizes_kg: [0.5, 1], active: true },
  { code: 'ORG', name: 'Orange', name_te: 'నారింజ', category: 'fruits', meal: 'both', price_paise: 7000, unit: 'kg', sizes_kg: [0.5, 1], active: true },
  { code: 'COC', name: 'Coconut', name_te: 'కొబ్బరి కాయ', category: 'fruits', meal: 'both', price_paise: 3500, unit: 'pc', active: true, note: 'Per piece' },

  // ── Off-menu (admin / phone order only — not in customer picker) ──
  { code: 'MIL1', name: 'Fresh milk 500 ml', name_te: 'పాలు 500 మి.లీ', category: 'milk', meal: 'both', price_paise: 3000, unit: 'L', active: false, emergency: true },
  { code: 'MIL2', name: 'Fresh milk 1 L', name_te: 'పాలు 1 లీటర్', category: 'milk', meal: 'both', price_paise: 5500, unit: 'L', active: false, emergency: true },
  { code: 'CURD', name: 'Curd 400 g', name_te: 'పెరుగు 400 గ్రా', category: 'milk', meal: 'both', price_paise: 3500, unit: 'pack', active: false, emergency: true },
  { code: 'BUTT', name: 'Butter 100 g', name_te: 'వెన్న 100 గ్రా', category: 'milk', meal: 'both', price_paise: 6000, unit: 'pack', active: false, emergency: true },
  { code: 'RIC1', name: 'Rice 1 kg', name_te: 'బియ్యం 1 కేజీ', category: 'staples', meal: 'both', price_paise: 6000, unit: 'kg', active: false, emergency: true },
  { code: 'TOOR', name: 'Toor dal 500 g', name_te: 'కందిపప్పు 500 గ్రా', category: 'staples', meal: 'both', price_paise: 9000, unit: 'pack', active: false, emergency: true },
  { code: 'OIL1', name: 'Cooking oil 500 ml', name_te: 'నూనె 500 మి.లీ', category: 'staples', meal: 'both', price_paise: 8500, unit: 'L', active: false, emergency: true },
  { code: 'SALT', name: 'Salt 1 kg', name_te: 'ఉప్పు 1 కేజీ', category: 'staples', meal: 'both', price_paise: 2500, unit: 'kg', active: false, emergency: true },
  { code: 'SUGR', name: 'Sugar 1 kg', name_te: 'చక్కెర 1 కేజీ', category: 'staples', meal: 'both', price_paise: 5000, unit: 'kg', active: false, emergency: true },
  { code: 'ATTA', name: 'Atta 1 kg', name_te: 'ఆటా 1 కేజీ', category: 'staples', meal: 'both', price_paise: 5500, unit: 'kg', active: false, emergency: true },
  { code: 'GASL', name: 'Gas lighter', name_te: 'గ్యాస్ లైటర్', category: 'utilities', meal: 'both', price_paise: 4000, unit: 'pc', active: false, emergency: true },
  { code: 'MATCH', name: 'Matchbox', name_te: 'అగ్గిపెట్టె', category: 'utilities', meal: 'both', price_paise: 1500, unit: 'pc', active: false, emergency: true },
  { code: 'FOIL', name: 'Aluminium foil (small)', name_te: 'అల్యూమినియం ఫాయిల్', category: 'utilities', meal: 'both', price_paise: 5000, unit: 'pack', active: false, emergency: true },
  { code: 'BAGS', name: 'Garbage bags (roll)', name_te: 'గార్బేజ్ బ్యాగ్స్', category: 'utilities', meal: 'both', price_paise: 4500, unit: 'pack', active: false, emergency: true },
];

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
  { id: 'z1', title: '0–3 km', fee_paise: 2000 },
  { id: 'z2', title: '3–6 km', fee_paise: 3500 },
  { id: 'z3', title: 'Above 6 km', fee_paise: 5000 },
];

/** Admin / English category title. */
export function categoryLabel(id) {
  return CATEGORIES.find((c) => c.id === id)?.title || id;
}

/** Customer-facing category title (Telugu when available). */
export function categoryCustomerTitle(id) {
  const cat = CATEGORIES.find((c) => c.id === id);
  if (!cat) return String(id || '');
  return cat.title_te || cat.title;
}

/** Customer Telugu name; admin uses English `name`. */
export function dishCustomerName(dish, { forAdmin = false } = {}) {
  if (!dish) return '—';
  if (forAdmin) return String(dish.name || dish.code || '—').trim();
  if (typeof dish === 'string') {
    const seed = MENU_DISHES.find((d) => d.code === dish || d.name === dish);
    if (seed) return String(seed.name_te || seed.name || dish).trim();
    return String(dish).trim() || '—';
  }
  return String(dish.name_te || dish.name || dish.code || '—').trim() || '—';
}

export function deliveryFeePaise(zoneId, foodPaise, freeAbovePaise = 30000) {
  const threshold = Number(freeAbovePaise);
  if (Number.isFinite(threshold) && foodPaise >= threshold) return 0;
  const zone = DELIVERY_ZONES.find((z) => z.id === zoneId);
  return zone ? zone.fee_paise : 3500;
}

/** Format pack for labels: 0.25 → 250 g, 0.5 → 500 g, 1 → 1 kg */
export function formatKgPack(kg) {
  const n = Number(kg);
  if (!Number.isFinite(n) || n <= 0) return String(kg);
  const grams = Math.round(n * 1000);
  // Prefer gram wording for sub-kg packs (clearer than ¼ / ½ kg).
  if (grams > 0 && grams < 1000) return `${grams} g`;
  if (Number.isInteger(n)) return `${n} kg`;
  if (Math.abs(n * 1000 - grams) < 0.5) {
    if (grams % 1000 === 0) return `${grams / 1000} kg`;
  }
  return `${n} kg`;
}

/**
 * Small-pack uplift on top of proportional kg price (covers packing labour / wastage).
 * Full kg and above stay at exact pro-rata. Tunable here only — used by web + WA + Flow.
 */
export const SMALL_PACK_MARGIN_PCT = {
  0.25: 20, // 250 g → +20%
  0.5: 12, // 500 g → +12%
  0.75: 6, // 750 g → +6%
};

/** Margin % for a pack size (0 if 1 kg+ or unknown). */
export function smallPackMarginPct(kg) {
  const n = Number(kg);
  if (!Number.isFinite(n) || n <= 0 || n >= 1) return 0;
  if (Object.prototype.hasOwnProperty.call(SMALL_PACK_MARGIN_PCT, n))
    return SMALL_PACK_MARGIN_PCT[n];
  // Nearest known step for odd sizes (e.g. 0.3 ≈ 250g band).
  if (n <= 0.3) return SMALL_PACK_MARGIN_PCT[0.25];
  if (n <= 0.6) return SMALL_PACK_MARGIN_PCT[0.5];
  return SMALL_PACK_MARGIN_PCT[0.75];
}

/**
 * Price for a kg pack from per-kg rate.
 * Sub-kg packs get SMALL_PACK_MARGIN_PCT, then round up to the next rupee.
 */
export function packPricePaise(pricePerKgPaise, kg) {
  const rate = Number(pricePerKgPaise) || 0;
  const size = Number(kg) || 0;
  if (rate <= 0 || size <= 0) return 0;
  const base = rate * size;
  const marginPct = smallPackMarginPct(size);
  const withMargin = base * (1 + marginPct / 100);
  // Round up to next rupee for small packs so margin is not lost to rounding.
  if (marginPct > 0) return Math.ceil(withMargin / 100) * 100;
  return Math.round(withMargin / 100) * 100;
}

export function dishHasKgPacks(dish) {
  return dish?.unit === 'kg' && Array.isArray(dish.sizes_kg) && dish.sizes_kg.length > 0;
}

/** Line code for a sized veg pack (keeps cart lines distinct). */
export function packLineCode(baseCode, kg) {
  const grams = Math.round(Number(kg) * 1000);
  return `${String(baseCode).toUpperCase()}-${grams}`;
}
