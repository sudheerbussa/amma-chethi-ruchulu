/**
 * Dynamic screen routing for ACR-Fresh Order Flow (hourly slots + multi-item cart).
 * Screen IDs must match docs/flow-order-fresh-v1.json published in WhatsApp Manager.
 * Cart lives in DB session (phone from flow_token) — same as button bot.
 */

import { getDb } from '../db.js';
import {
  buildSingleItemCart,
  categoryOptionsForMeal,
  dishOptionsForFlow,
  resolveBooking,
  validateDishForMeal,
  clampQty,
} from '../orders/checkout-shared.js';
import {
  addToCart,
  cartFoodPaise,
  cartTotalQty,
  formatLinesText,
  formatPaise,
} from '../orders/cart.js';
import { formatDishLabel } from '../ammas.js';
import {
  dayFromIso,
  enrichSlotsWithCounts,
  parseSlotId,
  planSlotCandidates,
  slotLabel,
  slotOptionDescription,
  SLOT_OCCUPYING_STATUSES,
} from '../cutoffs.js';
import {
  CATEGORIES,
  categoryCustomerTitle,
  dishHasKgPacks,
  formatKgPack,
  packLineCode,
  packPricePaise,
} from '../menu.js';
import { config } from '../config.js';

function supportCallLine() {
  const digits = String(config.supportPhone || '').replace(/\D/g, '');
  if (!digits) return '';
  const display =
    digits.length === 12 && digits.startsWith('91')
      ? `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`
      : `+${digits}`;
  return `లిస్ట్‌లో లేని items — call ${display}`;
}

export const FLOW_SCREENS = {
  START: 'START',
  SLOT: 'SLOT',
  CATEGORY: 'CATEGORY',
  DISH: 'DISH',
  QTY: 'QTY',
  SIZE: 'SIZE',
  CART: 'CART',
  ADDRESS: 'ADDRESS',
  CONFIRM: 'CONFIRM',
};

const MAX_FLOW_CART_LINES = 10;
const MAX_SLOT_OPTIONS = 20;

/** Always fresh; map legacy lunch/dinner tokens. */
function normalizeMeal(meal) {
  if (meal === 'lunch' || meal === 'dinner' || meal === 'fresh') return 'fresh';
  return 'fresh';
}

/** Encode booking context into flow_token (opaque to Meta). Version acf1. */
export function encodeFlowToken({
  phone,
  meal = 'fresh',
  serviceDate = '',
  dishCode = '',
  deliverySlot = '',
} = {}) {
  const parts = [
    'acf1',
    String(phone || '').replace(/\D/g, ''),
    normalizeMeal(meal),
    serviceDate || '',
    String(dishCode || '').toUpperCase(),
    String(deliverySlot || ''),
    String(Date.now()),
  ];
  return Buffer.from(parts.join('|')).toString('base64url');
}

export function decodeFlowToken(token) {
  try {
    const raw = Buffer.from(String(token || ''), 'base64url').toString('utf8');
    const [ver, phone, meal, serviceDate, dishCode, deliverySlot] = raw.split('|');
    if (ver !== 'acf1') return null;
    return {
      phone: phone || '',
      meal: normalizeMeal(meal),
      serviceDate: serviceDate || '',
      dishCode: dishCode || '',
      deliverySlot: deliverySlot || '',
    };
  } catch {
    return null;
  }
}

async function countOrdersByDeliverySlotSafe(slotIds) {
  const db = getDb();
  if (typeof db.countOrdersByDeliverySlot === 'function') {
    return db.countOrdersByDeliverySlot(slotIds, SLOT_OCCUPYING_STATUSES);
  }
  return {};
}

async function loadCart(phone) {
  if (!phone) return [];
  const session = await getDb().getSession(phone);
  return Array.isArray(session?.cart) ? session.cart : [];
}

async function loadSessionMeta(phone, tokenCtx = {}) {
  const session = phone ? await getDb().getSession(phone) : null;
  return {
    meal: 'fresh',
    deliverySlot: session?.delivery_slot || tokenCtx.deliverySlot || '',
    serviceDate: session?.service_date || tokenCtx.serviceDate || '',
    serviceLabel: session?.service_label || '',
    cart: Array.isArray(session?.cart) ? session.cart : [],
  };
}

async function saveCart(phone, { cart, meal, serviceDate, serviceLabel, deliverySlot }) {
  if (!phone) return;
  await getDb().setSession(phone, {
    state: 'await_flow_cart',
    cart,
    meal: normalizeMeal(meal) || 'fresh',
    service_date: serviceDate || null,
    service_label: serviceLabel || null,
    delivery_slot: deliverySlot || null,
    dish_code: null,
    qty: null,
    category: null,
  });
}

async function slotScreenData(tokenCtx = {}, errorMessage = '') {
  const candidates = planSlotCandidates({ daysAhead: 2 });
  const ids = candidates.map((s) => s.id);
  const counts = await countOrdersByDeliverySlotSafe(ids);
  let enriched = enrichSlotsWithCounts(candidates, counts).filter((s) => s.available);

  if (tokenCtx.deliverySlot) {
    const only = enriched.filter((s) => s.id === tokenCtx.deliverySlot);
    if (only.length) enriched = only;
  }

  const options = enriched.slice(0, MAX_SLOT_OPTIONS).map((s) => ({
    id: s.id,
    title: `${s.label}`.slice(0, 30),
    description: slotOptionDescription(s),
  }));

  const callTip = supportCallLine();
  let heading;
  if (!options.length) {
    heading = 'ఇప్పుడు స్లాట్లు లేవు — తర్వాత ప్రయత్నించండి';
  } else {
    heading = 'డెలివరీ గంట ఎంచుకోండి';
  }
  return {
    version: '3.0',
    screen: FLOW_SCREENS.SLOT,
    data: {
      slot_options: options.length
        ? options
        : [{ id: '_none', title: 'No slots open', description: 'Try again later' }],
      heading: heading.slice(0, 80),
      error_message: errorMessage || '',
    },
  };
}

async function startScreen({ meal, serviceDay, serviceLabel = '', errorMessage = '' }) {
  const m = normalizeMeal(meal);
  const label = serviceLabel || serviceDay?.dayDateLabel || '';
  const callTip = supportCallLine();
  const heading = (`ACR-Fresh · ${label || 'Delivery'}`).slice(0, 80);
  const sub = (callTip || 'కూరగాయలు & పండ్లు — Choose items').slice(0, 160);
  return {
    version: '3.0',
    screen: FLOW_SCREENS.START,
    data: {
      meal: m,
      service_label: label,
      heading,
      sub,
      error_message: errorMessage || '',
    },
  };
}

async function categoryScreen({ meal, serviceDay, serviceLabel = '', errorMessage = '' }) {
  const m = normalizeMeal(meal);
  const opts = categoryOptionsForMeal(m, serviceDay);
  const label = serviceLabel || serviceDay?.dayDateLabel || '';
  const callTip = supportCallLine();
  const heading = (callTip || `ACR-Fresh · ${label || 'కేటగిరీ ఎంచుకోండి'}`).slice(0, 80);
  return {
    version: '3.0',
    screen: FLOW_SCREENS.CATEGORY,
    data: {
      meal: m,
      service_label: label,
      heading,
      category_options: opts.length
        ? opts
        : [{ id: '_none', title: 'No categories open' }],
      error_message: errorMessage || '',
    },
  };
}

async function dishScreen({ meal, category }) {
  const m = normalizeMeal(meal);
  const rows = await dishOptionsForFlow({ meal: m, category });
  const cat = CATEGORIES.find((c) => c.id === category);
  return {
    version: '3.0',
    screen: FLOW_SCREENS.DISH,
    data: {
      meal: m,
      category,
      heading: categoryCustomerTitle(cat?.id || category),
      selected_dish: '',
      dish_options: rows.length
        ? rows
        : [{ id: '_none', title: 'No items in this category', description: ' ' }],
    },
  };
}

async function qtyScreen({ meal, code, category = '' }) {
  const m = normalizeMeal(meal);
  const checked = await validateDishForMeal(code, m);
  if (!checked.ok) {
    const booking = resolveBooking(m);
    return categoryScreen({
      meal: m,
      serviceDay: booking.serviceDay,
      errorMessage: checked.error || 'Item unavailable',
    });
  }
  const dish = checked.dish;
  return {
    version: '3.0',
    screen: FLOW_SCREENS.QTY,
    data: {
      meal: m,
      category: category || dish.category || '',
      dish_code: dish.code,
      dish_label: formatDishLabel(dish),
      price_label: `${formatPaise(dish.price_paise)} each`,
      note: dish.note || '',
      max_qty: 30,
      error_message: '',
    },
  };
}

async function sizeScreen({ meal, code, category = '', errorMessage = '' }) {
  const m = normalizeMeal(meal);
  const checked = await validateDishForMeal(code, m);
  if (!checked.ok || !dishHasKgPacks(checked.dish)) {
    const booking = resolveBooking(m);
    return categoryScreen({
      meal: m,
      serviceDay: booking.serviceDay,
      errorMessage: checked.error || 'Pick an item again',
    });
  }
  const dish = checked.dish;
  const size_options = (dish.sizes_kg || []).map((kg) => ({
    id: String(kg),
    title: formatKgPack(kg).slice(0, 30),
    description: formatPaise(packPricePaise(dish.price_paise, kg)).slice(0, 72),
  }));
  return {
    version: '3.0',
    screen: FLOW_SCREENS.SIZE,
    data: {
      meal: m,
      category: category || dish.category || '',
      dish_code: dish.code,
      dish_label: formatDishLabel(dish),
      heading: `Pack size · ${formatDishLabel(dish)}`.slice(0, 80),
      size_options: size_options.length
        ? size_options
        : [{ id: '_none', title: 'No sizes', description: ' ' }],
      error_message: errorMessage || '',
    },
  };
}

async function minOrderPaiseForFlow(serviceDate = '') {
  const iso =
    String(serviceDate || '').trim() || resolveBooking('fresh').serviceDay?.isoDate || '';
  return getDb().getMinOrderPaise(iso);
}

async function cartScreen({ meal, cart, errorMessage = '', serviceDate = '' }) {
  const lines = formatLinesText(cart, { maxLines: 8 });
  const itemsTotal = cartFoodPaise(cart);
  const n = cartTotalQty(cart);
  const minOrder = await minOrderPaiseForFlow(serviceDate);
  const canCheckout = n > 0 && itemsTotal >= minOrder;
  let summary = 'Add an item to continue';
  if (n) {
    summary = `${lines}\nItems ${formatPaise(itemsTotal)}`;
    if (minOrder > 0 && itemsTotal < minOrder) {
      summary += `\nMin order ${formatPaise(minOrder)} — add more items.`;
    }
  }
  if (errorMessage) summary += `\n\n${errorMessage}`;
  const next_options = [{ id: 'add_more', title: 'Add another item' }];
  if (canCheckout) next_options.push({ id: 'checkout', title: 'Checkout' });
  return {
    version: '3.0',
    screen: FLOW_SCREENS.CART,
    data: {
      meal: normalizeMeal(meal),
      heading: n ? `Cart · ${n} item(s)` : 'Cart is empty',
      summary,
      next_options,
      error_message: errorMessage || '',
    },
  };
}

async function addressScreen({ meal, cart, phone = '', errorMessage = '' }) {
  const lines = formatLinesText(cart, { maxLines: 6 });
  const address_options = [];
  if (phone) {
    try {
      const cust = await getDb().getCustomer(phone);
      const saved = (cust?.addresses || [])
        .slice()
        .sort((a, b) =>
          String(b.last_used_at || '').localeCompare(String(a.last_used_at || '')),
        )
        .slice(0, 5);
      for (const a of saved) {
        const hasPin = a.lat != null && a.lng != null && Number.isFinite(Number(a.lat));
        const label = String(a.location_name || a.text || 'Saved address').trim();
        address_options.push({
          id: `saved_${a.id}`,
          title: label.slice(0, 30),
          description: `${hasPin ? '📍 Pin saved · ' : ''}${String(a.text || '').slice(0, 55)}`.slice(
            0,
            72,
          ),
        });
      }
    } catch {
      /* ignore */
    }
  }
  address_options.push({
    id: 'new',
    title: 'Type a new address',
    description: 'Enter tower / flat / landmark below',
  });
  return {
    version: '3.0',
    screen: FLOW_SCREENS.ADDRESS,
    data: {
      meal: normalizeMeal(meal),
      heading: 'Delivery address',
      helper: address_options.length > 1
        ? 'Pick a saved address (with pin if available), or type a new one. Map pin comes next for delivery fee.'
        : 'Enter tower / flat / landmark — map pin optional after this',
      cart_preview: lines,
      address_options,
      error_message: errorMessage || '',
    },
  };
}

function confirmScreen({ meal, address, cart, serviceLabel = '' }) {
  const lines = formatLinesText(cart, { maxLines: 8 });
  const itemsTotal = cartFoodPaise(cart);
  const slotLine = serviceLabel ? `Delivery: ${serviceLabel}\n` : '';
  return {
    version: '3.0',
    screen: FLOW_SCREENS.CONFIRM,
    data: {
      meal: normalizeMeal(meal),
      address: address || '',
      summary:
        `${lines}\n` +
        `Items ${formatPaise(itemsTotal)}\n` +
        slotLine +
        `Address: ${address}\n` +
        `(Delivery fee: map pin optional, or pick distance)`,
    },
  };
}

async function afterDishPicked({ meal, code, category }) {
  const m = normalizeMeal(meal);
  const checked = await validateDishForMeal(code, m);
  if (!checked.ok) {
    return dishScreen({ meal: m, category });
  }
  if (dishHasKgPacks(checked.dish)) {
    return sizeScreen({ meal: m, code, category });
  }
  return qtyScreen({ meal: m, code, category });
}

/**
 * Handle decrypted Flow data-exchange payload → next screen JSON.
 */
export async function handleFlowDataExchange(decrypted) {
  const action = decrypted?.action;
  const screen = decrypted?.screen;
  const data = decrypted?.data || {};
  const tokenCtx = decodeFlowToken(decrypted?.flow_token) || {};
  const phone = tokenCtx.phone || '';

  if (action === 'ping') {
    return { data: { status: 'active' } };
  }

  if (action === 'INIT') {
    const meta = await loadSessionMeta(phone, tokenCtx);
    const booking = resolveBooking('fresh', meta.serviceDate || tokenCtx.serviceDate || null);
    const day = booking.serviceDay || resolveBooking('fresh').serviceDay;
    if (tokenCtx.dishCode) {
      return afterDishPicked({
        meal: 'fresh',
        code: tokenCtx.dishCode,
        category: '',
      });
    }
    // START has no incoming routing edges — required by Meta for INIT entry.
    // CATEGORY is reachable from CART (add more), so it cannot be the first screen.
    return startScreen({
      meal: 'fresh',
      serviceDay: day,
      serviceLabel: meta.serviceLabel || day.dayDateLabel,
    });
  }

  if (action === 'BACK') {
    const meta = await loadSessionMeta(phone, tokenCtx);
    if (screen === FLOW_SCREENS.START || screen === FLOW_SCREENS.CATEGORY) {
      const day = dayFromIso(meta.serviceDate) || resolveBooking('fresh').serviceDay;
      return startScreen({
        meal: 'fresh',
        serviceDay: day,
        serviceLabel: meta.serviceLabel || day.dayDateLabel,
      });
    }
    if (screen === FLOW_SCREENS.DISH) {
      const day = dayFromIso(meta.serviceDate) || resolveBooking('fresh').serviceDay;
      return categoryScreen({
        meal: 'fresh',
        serviceDay: day,
        serviceLabel: meta.serviceLabel,
      });
    }
    if (screen === FLOW_SCREENS.QTY || screen === FLOW_SCREENS.SIZE) {
      return dishScreen({ meal: 'fresh', category: String(data.category || '').trim() });
    }
    if (screen === FLOW_SCREENS.CART) {
      const day = dayFromIso(meta.serviceDate) || resolveBooking('fresh').serviceDay;
      return categoryScreen({
        meal: 'fresh',
        serviceDay: day,
        serviceLabel: meta.serviceLabel,
      });
    }
    if (screen === FLOW_SCREENS.ADDRESS) {
      const cart = await loadCart(phone);
      return cartScreen({ meal: 'fresh', cart, serviceDate: meta.serviceDate });
    }
    if (screen === FLOW_SCREENS.SLOT) {
      const cart = await loadCart(phone);
      return addressScreen({ meal: 'fresh', cart, phone });
    }
    if (screen === FLOW_SCREENS.CONFIRM) {
      return slotScreenData(tokenCtx);
    }
    const day = dayFromIso(meta.serviceDate) || resolveBooking('fresh').serviceDay;
    return startScreen({
      meal: 'fresh',
      serviceDay: day,
      serviceLabel: meta.serviceLabel || day.dayDateLabel,
    });
  }

  if (screen === FLOW_SCREENS.SLOT) {
    const slotRaw = String(data.delivery_slot || data.slot || '').trim();
    if (!slotRaw || slotRaw === '_none') {
      return slotScreenData(tokenCtx, 'Pick a delivery hour');
    }
    const parsed = parseSlotId(slotRaw);
    if (!parsed) {
      return slotScreenData(tokenCtx, 'Invalid slot — pick again');
    }
    const id = `${parsed.isoDate}T${String(parsed.hour).padStart(2, '0')}`;
    const candidates = planSlotCandidates({ daysAhead: 2 });
    const counts = await countOrdersByDeliverySlotSafe([id]);
    const enriched = enrichSlotsWithCounts(
      candidates.filter((s) => s.id === id),
      counts,
    );
    const hit = enriched[0];
    if (!hit?.available) {
      return slotScreenData(tokenCtx, 'That hour just filled or closed — pick another');
    }
    const day = dayFromIso(parsed.isoDate);
    const serviceLabel = `${day.dayDateLabel} · ${slotLabel(parsed.hour)}`;
    const meta = await loadSessionMeta(phone, tokenCtx);
    const cart = meta.cart;
    const session = phone ? await getDb().getSession(phone) : null;
    const address = String(session?.address || data.address || '').trim();
    if (phone) {
      await saveCart(phone, {
        cart,
        meal: 'fresh',
        serviceDate: parsed.isoDate,
        serviceLabel,
        deliverySlot: id,
      });
      if (address) {
        await getDb().setSession(phone, { address });
      }
    }
    return confirmScreen({
      meal: 'fresh',
      address,
      cart,
      serviceLabel,
    });
  }

  if (screen === FLOW_SCREENS.START) {
    const meta = await loadSessionMeta(phone, tokenCtx);
    const day = dayFromIso(meta.serviceDate) || resolveBooking('fresh').serviceDay;
    return categoryScreen({
      meal: 'fresh',
      serviceDay: day,
      serviceLabel: meta.serviceLabel || day.dayDateLabel,
    });
  }

  if (screen === FLOW_SCREENS.CATEGORY) {
    const meal = 'fresh';
    const category = String(data.category || '').trim();
    const meta = await loadSessionMeta(phone, tokenCtx);
    if (!category || category === '_none') {
      const day = dayFromIso(meta.serviceDate) || resolveBooking(meal).serviceDay;
      return categoryScreen({
        meal,
        serviceDay: day,
        serviceLabel: meta.serviceLabel,
        errorMessage: 'Pick a category',
      });
    }
    return dishScreen({ meal, category });
  }

  if (screen === FLOW_SCREENS.DISH) {
    const meal = 'fresh';
    const code = String(data.dish_code || data.dish || '').toUpperCase();
    const category = String(data.category || '').trim();
    if (!code || code === '_NONE') {
      return dishScreen({ meal, category });
    }
    return afterDishPicked({ meal, code, category });
  }

  if (screen === FLOW_SCREENS.SIZE) {
    const meal = 'fresh';
    const code = String(data.dish_code || '').toUpperCase();
    const category = String(data.category || '').trim();
    const kg = Number(data.pack_kg || data.size || data.size_kg);
    const checked = await validateDishForMeal(code, meal);
    if (!checked.ok || !dishHasKgPacks(checked.dish)) {
      return sizeScreen({
        meal,
        code,
        category,
        errorMessage: checked.error || 'Pick a pack size',
      });
    }
    const dish = checked.dish;
    if (!dish.sizes_kg.some((s) => Number(s) === kg)) {
      return sizeScreen({ meal, code, category, errorMessage: 'Pick a valid pack size' });
    }
    const meta = await loadSessionMeta(phone, tokenCtx);
    let cart = meta.cart;
    if (cart.length >= MAX_FLOW_CART_LINES) {
      return cartScreen({
        meal,
        cart,
        serviceDate: meta.serviceDate,
        errorMessage: `Max ${MAX_FLOW_CART_LINES} different items — checkout or edit via buttons`,
      });
    }
    const line = {
      code: packLineCode(dish.code, kg),
      name: `${formatDishLabel(dish)} (${formatKgPack(kg)})`,
      base_name: dish.name,
      qty: 1,
      unit_price_paise: packPricePaise(dish.price_paise, kg),
      category: dish.category || null,
      cook_name: dish.cook_name || null,
      amma_id: dish.amma_id || null,
      pack_kg: kg,
      base_code: dish.code,
    };
    cart = addToCart(cart, line);
    await saveCart(phone, {
      cart,
      meal: 'fresh',
      serviceDate: meta.serviceDate,
      serviceLabel: meta.serviceLabel,
      deliverySlot: meta.deliverySlot,
    });
    return cartScreen({ meal, cart, serviceDate: meta.serviceDate });
  }

  if (screen === FLOW_SCREENS.QTY) {
    const meal = 'fresh';
    const qty = clampQty(data.qty);
    if (!qty) {
      return {
        version: '3.0',
        screen: FLOW_SCREENS.QTY,
        data: {
          meal,
          category: data.category || '',
          dish_code: data.dish_code || '',
          dish_label: data.dish_label || '',
          price_label: data.price_label || '',
          note: data.note || '',
          max_qty: 30,
          error_message: 'Enter a valid quantity',
        },
      };
    }
    const built = await buildSingleItemCart({
      meal,
      code: data.dish_code,
      qty,
    });
    if (!built.ok) {
      return {
        version: '3.0',
        screen: FLOW_SCREENS.QTY,
        data: {
          meal,
          category: data.category || '',
          dish_code: data.dish_code || '',
          dish_label: data.dish_label || '',
          price_label: data.price_label || '',
          note: '',
          max_qty: 30,
          error_message: built.error || 'Could not add item',
        },
      };
    }
    const meta = await loadSessionMeta(phone, tokenCtx);
    let cart = meta.cart;
    if (cart.length >= MAX_FLOW_CART_LINES) {
      return cartScreen({
        meal,
        cart,
        serviceDate: meta.serviceDate,
        errorMessage: `Max ${MAX_FLOW_CART_LINES} different items — checkout or edit via buttons`,
      });
    }
    cart = addToCart(cart, built.cart[0]);
    await saveCart(phone, {
      cart,
      meal: 'fresh',
      serviceDate: meta.serviceDate || tokenCtx.serviceDate,
      serviceLabel: meta.serviceLabel,
      deliverySlot: meta.deliverySlot || tokenCtx.deliverySlot,
    });
    return cartScreen({ meal, cart, serviceDate: meta.serviceDate });
  }

  if (screen === FLOW_SCREENS.CART) {
    const meal = 'fresh';
    const next = String(data.next_step || '').trim();
    const meta = await loadSessionMeta(phone, tokenCtx);
    const cart = meta.cart;
    if (next === 'add_more') {
      const day = dayFromIso(meta.serviceDate) || resolveBooking(meal).serviceDay;
      return categoryScreen({
        meal,
        serviceDay: day,
        serviceLabel: meta.serviceLabel || day.dayDateLabel,
      });
    }
    if (next === 'checkout') {
      if (!cart.length) {
        return cartScreen({
          meal,
          cart,
          serviceDate: meta.serviceDate,
          errorMessage: 'Add at least one item first',
        });
      }
      const minOrder = await minOrderPaiseForFlow(meta.serviceDate);
      const itemsTotal = cartFoodPaise(cart);
      if (itemsTotal < minOrder) {
        return cartScreen({
          meal,
          cart,
          serviceDate: meta.serviceDate,
          errorMessage: `Minimum order is ${formatPaise(minOrder)} — add more items.`,
        });
      }
      return addressScreen({ meal, cart, phone });
    }
    return cartScreen({
      meal,
      cart,
      serviceDate: meta.serviceDate,
      errorMessage: 'Choose Add another or Checkout',
    });
  }

  if (screen === FLOW_SCREENS.ADDRESS) {
    const meal = 'fresh';
    const choice = String(data.address_choice || '').trim();
    const typed = String(data.address_new || data.address || '').trim();
    const meta = await loadSessionMeta(phone, tokenCtx);
    const cart = meta.cart;

    let address = '';
    let prefillLat = null;
    let prefillLng = null;
    let prefillName = null;

    if (choice.startsWith('saved_') && phone) {
      const id = choice.slice('saved_'.length);
      try {
        const cust = await getDb().getCustomer(phone);
        const hit = (cust?.addresses || []).find((a) => String(a.id) === String(id));
        if (hit) {
          address = String(hit.text || hit.location_name || '').trim();
          if (hit.lat != null && hit.lng != null && Number.isFinite(Number(hit.lat))) {
            prefillLat = Number(hit.lat);
            prefillLng = Number(hit.lng);
            prefillName = hit.location_name || null;
          }
        }
      } catch {
        /* ignore */
      }
    }
    if (!address) address = typed;

    if (address.length < 8) {
      return addressScreen({
        meal,
        cart,
        phone,
        errorMessage: choice === 'new' || !choice
          ? 'Please enter a fuller address (tower / flat / landmark)'
          : 'Could not load that saved address — type a new one',
      });
    }
    if (!cart.length) {
      const day = dayFromIso(meta.serviceDate) || resolveBooking(meal).serviceDay;
      return categoryScreen({
        meal,
        serviceDay: day,
        serviceLabel: meta.serviceLabel,
        errorMessage: 'Cart empty — pick an item',
      });
    }
    const minOrder = await minOrderPaiseForFlow(meta.serviceDate);
    if (cartFoodPaise(cart) < minOrder) {
      return cartScreen({
        meal,
        cart,
        serviceDate: meta.serviceDate,
        errorMessage: `Minimum order is ${formatPaise(minOrder)} — add more items.`,
      });
    }
    if (phone) {
      await getDb().setSession(phone, {
        address,
        flow_prefill_lat: prefillLat,
        flow_prefill_lng: prefillLng,
        flow_prefill_name: prefillName,
      });
    }
    // Slot last — after address, before confirm
    return slotScreenData(tokenCtx);
  }

  if (screen === FLOW_SCREENS.CONFIRM) {
    const meal = 'fresh';
    const address = String(data.address || '').trim();
    const meta = await loadSessionMeta(phone, tokenCtx);
    const cart = meta.cart;
    if (!cart.length) {
      return cartScreen({
        meal,
        cart,
        serviceDate: meta.serviceDate,
        errorMessage: 'Cart empty — add items first',
      });
    }
    if (!meta.deliverySlot && !tokenCtx.deliverySlot) {
      return slotScreenData(tokenCtx, 'Pick a delivery hour first');
    }
    const minOrder = await minOrderPaiseForFlow(meta.serviceDate);
    if (cartFoodPaise(cart) < minOrder) {
      return cartScreen({
        meal,
        cart,
        serviceDate: meta.serviceDate,
        errorMessage: `Minimum order is ${formatPaise(minOrder)} — add more items.`,
      });
    }
    if (phone && cart.length) {
      await saveCart(phone, {
        cart,
        meal: 'fresh',
        serviceDate: meta.serviceDate || tokenCtx.serviceDate,
        serviceLabel: meta.serviceLabel,
        deliverySlot: meta.deliverySlot || tokenCtx.deliverySlot,
      });
      await getDb().setSession(phone, {
        address,
      });
    }
    return {
      version: '3.0',
      screen: 'SUCCESS',
      data: {
        extension_message_response: {
          params: {
            flow_token: decrypted.flow_token,
            meal,
            service_date: meta.serviceDate || '',
            service_label: meta.serviceLabel || '',
            delivery_slot: meta.deliverySlot || '',
            address,
            cart_count: String(cartTotalQty(cart)),
          },
        },
      },
    };
  }

  const day = dayFromIso(tokenCtx.serviceDate) || resolveBooking('fresh').serviceDay;
  return categoryScreen({
    meal: 'fresh',
    serviceDay: day,
    serviceLabel: day.dayDateLabel,
  });
}
