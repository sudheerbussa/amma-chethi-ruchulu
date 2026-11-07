/**
 * Dynamic screen routing for ACR Order Flow (v2 — multi-item cart).
 * Screen IDs must match the Flow JSON published in WhatsApp Manager.
 * Cart lives in DB session (phone from flow_token) — same as button bot.
 */

import { getDb } from '../db.js';
import {
  buildSingleItemCart,
  cartViolatesSundayPartyRule,
  categoryOptionsForMeal,
  dishOptionsForFlow,
  flowMorePageFromId,
  isFlowMoreDishOption,
  resolveBooking,
  validateDishForBooking,
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
import { formatDishWithCook } from '../ammas.js';
import {
  mealTitle,
  isMealOpen,
  isSundayPartyDinnerService,
  nowIst,
  sundayPartyOrderNoticeShort,
} from '../cutoffs.js';
import { browseCategoryLabel } from '../menu.js';
import { buildReorderCart } from '../orders/reorder-cart.js';
import {
  getSlotLeadMinutes,
  isSlotTimeOpen,
  mealFromSlotId,
  parseSlotId,
  planAllMealSlotCandidates,
  serviceLabelWithSlot,
  slotLabelFromId,
  slotOptionDescription,
} from '../slots.js';

export const FLOW_SCREENS = {
  MEAL: 'MEAL',
  CATEGORY: 'CATEGORY',
  DISH: 'DISH',
  QTY: 'QTY',
  CART: 'CART',
  FULFILLMENT: 'FULFILLMENT',
  ADDRESS: 'ADDRESS',
  SLOT: 'SLOT',
  CONFIRM: 'CONFIRM',
};

const MAX_FLOW_CART_LINES = 10;
/** WhatsApp Flow RadioButtonsGroup max; continuous day has up to ~21 half-hour starts. */
const MAX_SLOT_OPTIONS = 20;
const PICKUP_ADDRESS = 'Pickup at kitchen (Tenali)';
function fulfillmentOptions() {
  return [
    {
      id: 'delivery',
      title: 'Delivery',
      description: 'Home delivery · fee by distance',
    },
    {
      id: 'pickup',
      title: 'Pickup',
      description: 'Collect at kitchen · no delivery fee',
    },
  ];
}

function fulfillmentScreen({ meal, cart, errorMessage = '' }) {
  const lines = formatLinesText(cart, { maxLines: 6 });
  return {
    version: '3.0',
    screen: FLOW_SCREENS.FULFILLMENT,
    data: {
      meal: meal || '',
      heading: 'Delivery or Pickup?',
      helper: 'Pickup = collect at kitchen (Tenali). Delivery needs address (map pin optional).',
      cart_preview: lines || ' ',
      fulfillment_options: fulfillmentOptions(),
      error_message: errorMessage || '',
    },
  };
}

/** Encode booking context into flow_token (opaque to Meta). */
export function encodeFlowToken({ phone, meal = '', serviceDate = '', dishCode = '' }) {
  const parts = [
    'acr1',
    String(phone || '').replace(/\D/g, ''),
    meal || '',
    serviceDate || '',
    String(dishCode || '').toUpperCase(),
    String(Date.now()),
  ];
  return Buffer.from(parts.join('|')).toString('base64url');
}

export function decodeFlowToken(token) {
  try {
    const raw = Buffer.from(String(token || ''), 'base64url').toString('utf8');
    const [ver, phone, meal, serviceDate, dishCode] = raw.split('|');
    if (ver !== 'acr1') return null;
    return {
      phone: phone || '',
      meal: meal === 'dinner' || meal === 'lunch' ? meal : '',
      serviceDate: serviceDate || '',
      dishCode: dishCode || '',
    };
  } catch {
    return null;
  }
}

async function loadCart(phone) {
  if (!phone) return [];
  const session = await getDb().getSession(phone);
  return Array.isArray(session?.cart) ? session.cart : [];
}

async function saveCart(phone, { cart, meal, serviceDate, serviceLabel }) {
  if (!phone) return;
  await getDb().setSession(phone, {
    state: 'await_flow_cart',
    cart,
    meal: meal || null,
    service_date: serviceDate || null,
    service_label: serviceLabel || null,
    dish_code: null,
    qty: null,
    category: null,
  });
}

function flowSundayHeading(meal, serviceDay, baseHeading) {
  if (!isSundayPartyDinnerService(meal, serviceDay)) return baseHeading.slice(0, 80);
  const short = sundayPartyOrderNoticeShort();
  const merged = `${baseHeading}\n${short}`;
  return merged.slice(0, 120);
}

/** Prefer lunch while open; else dinner. Used when Flow skips Lunch/Dinner radios. */
function pickBrowseMeal() {
  if (isMealOpen('lunch')) return 'lunch';
  if (isMealOpen('dinner')) return 'dinner';
  return '';
}

/**
 * First Flow screen: service date only (no Lunch/Dinner radios).
 * Meal is auto-picked from open windows; delivery time at SLOT finalizes lunch vs dinner.
 */
async function mealScreenData(tokenCtx = {}, phone = '') {
  void phone;
  const today = nowIst();
  const preset = tokenCtx.meal === 'lunch' || tokenCtx.meal === 'dinner' ? tokenCtx.meal : '';
  let defaultMeal = preset || pickBrowseMeal();
  if (preset && !tokenCtx.serviceDate && !isMealOpen(preset)) {
    defaultMeal = pickBrowseMeal();
  }

  let heading = defaultMeal
    ? `${today.dayDateLabel}\nContinue నొక్కి menu చూడండి — time చివర pick చేస్తారు`
    : `${today.dayDateLabel}\nOnline order లేదు — Help line కి call చేయండి`;

  if (defaultMeal === 'dinner') {
    const dinnerBooking = resolveBooking('dinner', tokenCtx.serviceDate || today.isoDate);
    if (dinnerBooking.ok) {
      heading = flowSundayHeading('dinner', dinnerBooking.serviceDay, heading);
    }
  }

  // meal_options kept for older published Flow JSON that still has a Meal radio.
  const meal_options = defaultMeal
    ? [{ id: defaultMeal, title: 'Continue' }]
    : [{ id: '_none', title: 'Closed today' }];

  return {
    version: '3.0',
    screen: FLOW_SCREENS.MEAL,
    data: {
      default_meal: defaultMeal || '_none',
      meal_options,
      heading: heading.slice(0, 120),
      error_message: '',
    },
  };
}

/** INIT → date screen (MEAL id) then categories. */
async function initFlowScreen(tokenCtx, phone) {
  if (tokenCtx.dishCode && tokenCtx.meal) {
    const booking = resolveBooking(tokenCtx.meal, tokenCtx.serviceDate || null);
    if (!booking.ok) return mealScreenData(tokenCtx, phone);
    return qtyScreen({ meal: booking.meal, code: tokenCtx.dishCode });
  }
  if (tokenCtx.meal && tokenCtx.serviceDate && phone) {
    try {
      const booking = resolveBooking(tokenCtx.meal, tokenCtx.serviceDate);
      if (booking.ok) {
        const sess = await getDb().getSession(phone);
        await getDb().setSession(phone, {
          meal: booking.meal,
          service_date: booking.serviceDay.isoDate,
          service_label: sess?.service_label || booking.serviceDay.dayDateLabel,
        });
      }
    } catch {
      /* ignore */
    }
  }
  return mealScreenData(tokenCtx, phone);
}

async function categoryScreen({ meal, serviceDay, errorMessage = '' }) {
  const opts = categoryOptionsForMeal(meal, serviceDay);
  const base = `Menu · ${serviceDay.dayDateLabel}`;
  return {
    version: '3.0',
    screen: FLOW_SCREENS.CATEGORY,
    data: {
      meal,
      service_label: serviceDay.dayDateLabel,
      heading: flowSundayHeading(meal, serviceDay, base),
      category_options: opts.length
        ? opts
        : [{ id: '_none', title: 'No categories open' }],
      error_message: errorMessage || '',
    },
  };
}

async function dishScreen({ meal, category, serviceDay = null, errorMessage = '', page = 0 }) {
  const rows = await dishOptionsForFlow({ meal, category, page });
  const base = browseCategoryLabel(category);
  const pageBit = page > 0 ? ` · p${page + 1}` : '';
  return {
    version: '3.0',
    screen: FLOW_SCREENS.DISH,
    data: {
      meal,
      category,
      heading: serviceDay
        ? flowSundayHeading(meal, serviceDay, `${base}${pageBit}`)
        : `${base}${pageBit}`,
      dish_options: rows.length
        ? rows
        : [{ id: '_none', title: 'No dishes in this category', description: ' ' }],
      error_message: errorMessage || '',
    },
  };
}

async function qtyScreen({ meal, code, category = '', serviceDay = null }) {
  const booking = serviceDay
    ? { ok: true, serviceDay }
    : resolveBooking(meal);
  const checked = booking.ok
    ? await validateDishForBooking(code, meal, booking.serviceDay)
    : await validateDishForMeal(code, meal);
  if (!checked.ok) {
    const fallback = resolveBooking(meal);
    return categoryScreen({
      meal,
      serviceDay: fallback.ok ? fallback.serviceDay : nowIst(),
      errorMessage: checked.error || 'Dish unavailable',
    });
  }
  const dish = checked.dish;
  return {
    version: '3.0',
    screen: FLOW_SCREENS.QTY,
    data: {
      meal,
      category: category || dish.category || '',
      dish_code: dish.code,
      dish_label: formatDishWithCook(dish),
      price_label: `${formatPaise(dish.price_paise)} each`,
      note: dish.note || '',
      max_qty: 30,
      error_message: '',
    },
  };
}

function cartScreen({ meal, cart, errorMessage = '' }) {
  const lines = formatLinesText(cart, { maxLines: 8 });
  const food = cartFoodPaise(cart);
  const n = cartTotalQty(cart);
  return {
    version: '3.0',
    screen: FLOW_SCREENS.CART,
    data: {
      meal: meal || '',
      heading: n ? `Cart · ${n} item(s)` : 'Cart is empty',
      summary: n
        ? `${lines}\nFood ${formatPaise(food)}`
        : 'Add a dish to continue',
      next_options: [
        { id: 'add_more', title: 'Add another item' },
        { id: 'checkout', title: 'Checkout' },
      ],
      error_message: errorMessage || '',
    },
  };
}

async function addressScreen({
  meal,
  cart,
  phone = '',
  fulfillmentType = 'delivery',
  errorMessage = '',
}) {
  const lines = formatLinesText(cart, { maxLines: 6 });
  const pickup = String(fulfillmentType || '').toLowerCase() === 'pickup';

  if (pickup) {
    return {
      version: '3.0',
      screen: FLOW_SCREENS.ADDRESS,
      data: {
        meal: meal || '',
        fulfillment_type: 'pickup',
        heading: 'Pickup location',
        helper: 'Collect from kitchen in Tenali — no delivery fee.',
        cart_preview: lines,
        address_options: [
          {
            id: 'pickup_kitchen',
            title: 'Kitchen pickup (Tenali)',
            description: 'Amaravathi flats · Chenchupeta',
          },
        ],
        show_address_new: false,
        error_message: errorMessage || '',
      },
    };
  }

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
      meal: meal || '',
      fulfillment_type: 'delivery',
      heading: 'Delivery address',
      helper: address_options.length > 1
        ? 'Pick a saved address (with pin if available), or type a new one. Map pin is confirmed after the form for fee.'
        : 'Enter tower / flat / landmark — map pin optional after this',
      cart_preview: lines,
      address_options,
      show_address_new: true,
      error_message: errorMessage || '',
    },
  };
}

function confirmScreen({
  meal,
  address,
  cart,
  fulfillmentType = 'delivery',
  deliverySlot = '',
  serviceLabel = '',
}) {
  const lines = formatLinesText(cart, { maxLines: 8 });
  const food = cartFoodPaise(cart);
  const pickup = String(fulfillmentType || '').toLowerCase() === 'pickup';
  const slotLine =
    !pickup && deliverySlot
      ? `Time: ${slotLabelFromId(deliverySlot)}\n`
      : serviceLabel
        ? `Service: ${serviceLabel}\n`
        : '';
  return {
    version: '3.0',
    screen: FLOW_SCREENS.CONFIRM,
    data: {
      meal: meal || '',
      address: address || '',
      fulfillment_type: pickup ? 'pickup' : 'delivery',
      delivery_slot: deliverySlot || '',
      summary:
        `${lines}\n` +
        `Food ${formatPaise(food)}\n` +
        slotLine +
        `${pickup ? 'Pickup' : 'Delivery'}: ${address}\n` +
        (pickup
          ? '(No delivery fee)'
          : '(Delivery fee calculated after confirm)'),
    },
  };
}

async function slotScreen({
  meal,
  address,
  serviceDate,
  fulfillmentType = 'delivery',
  errorMessage = '',
}) {
  const m = meal === 'dinner' ? 'dinner' : meal === 'lunch' ? 'lunch' : '';
  const pickup = fulfillmentType === 'pickup';
  // All open windows today (lunch + dinner) — picking a slot sets the meal.
  const candidates = planAllMealSlotCandidates().slice(0, MAX_SLOT_OPTIONS);
  const options = candidates.map((s) => ({
    id: s.id,
    title: String(s.label).slice(0, 30),
    description: slotOptionDescription(s),
  }));
  return {
    version: '3.0',
    screen: FLOW_SCREENS.SLOT,
    data: {
      meal: m || (candidates[0]?.meal === 'dinner' ? 'dinner' : 'lunch'),
      address: address || (pickup ? PICKUP_ADDRESS : ''),
      fulfillment_type: pickup ? 'pickup' : 'delivery',
      heading: options.length
        ? pickup
          ? `Pick pickup window (${getSlotLeadMinutes()} min lead)`
          : `Pick delivery window (${getSlotLeadMinutes()} min lead)`
        : 'No slots open — try later or call ACR',
      slot_options: options.length
        ? options
        : [{ id: '_none', title: 'No slots open', description: 'Try again later' }],
      error_message: errorMessage || '',
    },
  };
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
    return initFlowScreen(tokenCtx, phone);
  }

  if (action === 'BACK') {
    if (screen === FLOW_SCREENS.CATEGORY) return mealScreenData(tokenCtx, phone);
    if (screen === FLOW_SCREENS.DISH) {
      const booking = resolveBooking(data.meal || tokenCtx.meal, tokenCtx.serviceDate || null);
      if (!booking.ok) return mealScreenData(tokenCtx, phone);
      return categoryScreen({ meal: booking.meal, serviceDay: booking.serviceDay });
    }
    if (screen === FLOW_SCREENS.QTY) {
      const booking = resolveBooking(data.meal || tokenCtx.meal, tokenCtx.serviceDate || null);
      return dishScreen({
        meal: data.meal,
        category: data.category,
        serviceDay: booking.ok ? booking.serviceDay : null,
      });
    }
    if (screen === FLOW_SCREENS.CART) {
      const booking = resolveBooking(data.meal || tokenCtx.meal, tokenCtx.serviceDate || null);
      if (!booking.ok) return mealScreenData(tokenCtx, phone);
      return categoryScreen({ meal: booking.meal, serviceDay: booking.serviceDay });
    }
    if (screen === FLOW_SCREENS.FULFILLMENT) {
      const cart = await loadCart(phone);
      return cartScreen({ meal: data.meal || tokenCtx.meal, cart });
    }
    if (screen === FLOW_SCREENS.ADDRESS) {
      const cart = await loadCart(phone);
      return fulfillmentScreen({ meal: data.meal || tokenCtx.meal, cart });
    }
    if (screen === FLOW_SCREENS.SLOT) {
      const cart = await loadCart(phone);
      let fulfillmentType = 'delivery';
      if (phone) {
        try {
          const sess = await getDb().getSession(phone);
          if (sess?.fulfillment_type) fulfillmentType = sess.fulfillment_type;
        } catch {
          /* ignore */
        }
      }
      if (fulfillmentType === 'pickup') {
        return fulfillmentScreen({ meal: data.meal || tokenCtx.meal, cart });
      }
      return addressScreen({
        meal: data.meal || tokenCtx.meal,
        cart,
        phone,
        fulfillmentType,
      });
    }
    if (screen === FLOW_SCREENS.CONFIRM) {
      const cart = await loadCart(phone);
      let fulfillmentType = String(data.fulfillment_type || 'delivery').toLowerCase();
      let serviceDate = tokenCtx.serviceDate || null;
      if (phone) {
        try {
          const sess = await getDb().getSession(phone);
          if (sess?.fulfillment_type) fulfillmentType = sess.fulfillment_type;
          if (sess?.service_date) serviceDate = sess.service_date;
        } catch {
          /* ignore */
        }
      }
      if (fulfillmentType === 'pickup') {
        return slotScreen({
          meal: data.meal || tokenCtx.meal,
          address: data.address || PICKUP_ADDRESS,
          serviceDate: serviceDate || nowIst().isoDate,
          fulfillmentType: 'pickup',
        });
      }
      return slotScreen({
        meal: data.meal || tokenCtx.meal,
        address: data.address || '',
        serviceDate: serviceDate || nowIst().isoDate,
        fulfillmentType: 'delivery',
      });
    }
    return mealScreenData(tokenCtx, phone);
  }

  if (screen === FLOW_SCREENS.MEAL) {
    const rawMeal = String(data.meal || data.default_meal || '').trim();
    if (rawMeal === '_none' || !rawMeal) {
      const base = await mealScreenData(tokenCtx, phone);
      return {
        version: '3.0',
        screen: FLOW_SCREENS.MEAL,
        data: {
          ...base.data,
          error_message: 'Online order లేదు — Help line కి call చేయండి',
        },
      };
    }
    const meal = rawMeal === 'dinner' ? 'dinner' : 'lunch';
    if (!tokenCtx.serviceDate && !isMealOpen(meal)) {
      const base = await mealScreenData(tokenCtx, phone);
      return {
        version: '3.0',
        screen: FLOW_SCREENS.MEAL,
        data: {
          ...base.data,
          error_message: 'Online order లేదు — Help line కి call చేయండి',
        },
      };
    }
    const booking = resolveBooking(meal, tokenCtx.serviceDate || nowIst().isoDate);
    if (!booking.ok) {
      const base = await mealScreenData(tokenCtx, phone);
      return {
        version: '3.0',
        screen: FLOW_SCREENS.MEAL,
        data: { error_message: booking.error, ...base.data },
      };
    }
    if (phone) {
      let cart = [];
      let pendingReorder = false;
      try {
        const sess = await getDb().getSession(phone);
        pendingReorder = sess?.pending_action === 'reorder';
      } catch {
        /* ignore */
      }
      if (pendingReorder) {
        const built = await buildReorderCart({
          phone,
          meal: booking.meal,
          serviceDay: booking.serviceDay,
        });
        if (built.partyNotice) {
          await getDb().setSession(phone, { pending_action: null });
          return categoryScreen({
            meal: booking.meal,
            serviceDay: booking.serviceDay,
            errorMessage: built.partyNotice.slice(0, 180),
          });
        }
        if (built.cart.length) {
          cart = built.cart;
          await saveCart(phone, {
            cart,
            meal: booking.meal,
            serviceDate: booking.serviceDay.isoDate,
            serviceLabel: booking.serviceDay.dayDateLabel,
          });
          await getDb().setSession(phone, { pending_action: null });
          return cartScreen({ meal: booking.meal, cart });
        }
        await getDb().setSession(phone, { pending_action: null });
      }
      await saveCart(phone, {
        cart,
        meal: booking.meal,
        serviceDate: booking.serviceDay.isoDate,
        serviceLabel: booking.serviceDay.dayDateLabel,
      });
    }
    return categoryScreen({ meal: booking.meal, serviceDay: booking.serviceDay });
  }

  if (screen === FLOW_SCREENS.CATEGORY) {
    const meal = data.meal === 'dinner' ? 'dinner' : 'lunch';
    const category = String(data.category || '').trim();
    const booking = resolveBooking(meal, tokenCtx.serviceDate || null);
    if (!booking.ok) {
      const base = await mealScreenData(tokenCtx, phone);
      return {
        version: '3.0',
        screen: FLOW_SCREENS.MEAL,
        data: { error_message: booking.error, ...base.data },
      };
    }
    if (!category || category === '_none') {
      return categoryScreen({
        meal,
        serviceDay: booking.serviceDay,
        errorMessage: 'Pick a category',
      });
    }
    if (isSundayPartyDinnerService(meal, booking.serviceDay) && category !== 'packs') {
      return categoryScreen({
        meal,
        serviceDay: booking.serviceDay,
        errorMessage: sundayPartyOrderNoticeShort(),
      });
    }
    return dishScreen({ meal, category, serviceDay: booking.serviceDay });
  }

  if (screen === FLOW_SCREENS.DISH) {
    const meal = data.meal === 'dinner' ? 'dinner' : 'lunch';
    const category = String(data.category || '').trim();
    const code = String(data.dish_code || data.dish || '').toUpperCase();
    const booking = resolveBooking(meal, tokenCtx.serviceDate || null);
    if (!code || code === '_NONE') {
      return dishScreen({
        meal,
        category,
        serviceDay: booking.ok ? booking.serviceDay : null,
        errorMessage: 'Pick a dish to continue',
      });
    }
    if (isFlowMoreDishOption(code) || isFlowMoreDishOption(data.dish_code || data.dish)) {
      const nextPage = flowMorePageFromId(data.dish_code || data.dish || code);
      return dishScreen({
        meal,
        category,
        serviceDay: booking.ok ? booking.serviceDay : null,
        page: nextPage,
      });
    }
    return qtyScreen({ meal, code, category, serviceDay: booking.ok ? booking.serviceDay : null });
  }

  if (screen === FLOW_SCREENS.QTY) {
    const meal = data.meal === 'dinner' ? 'dinner' : 'lunch';
    const qty = clampQty(data.qty);
    if (!qty) {
      return {
        version: '3.0',
        screen: FLOW_SCREENS.QTY,
        data: {
          meal: data.meal || '',
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
    const booking = resolveBooking(meal, tokenCtx.serviceDate || null);
    const built = await buildSingleItemCart({
      meal,
      code: data.dish_code,
      qty,
      serviceDay: booking.ok ? booking.serviceDay : null,
    });
    if (!built.ok) {
      return {
        version: '3.0',
        screen: FLOW_SCREENS.QTY,
        data: {
          meal: data.meal || '',
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
    let cart = await loadCart(phone);
    if (cart.length >= MAX_FLOW_CART_LINES) {
      return cartScreen({
        meal,
        cart,
        errorMessage: `Max ${MAX_FLOW_CART_LINES} different dishes — checkout or edit via buttons`,
      });
    }
    cart = addToCart(cart, built.cart[0]);
    await saveCart(phone, {
      cart,
      meal: booking.ok ? booking.meal : meal,
      serviceDate: booking.ok ? booking.serviceDay.isoDate : tokenCtx.serviceDate,
      serviceLabel: booking.ok ? booking.serviceDay.dayDateLabel : '',
    });
    return cartScreen({ meal, cart });
  }

  if (screen === FLOW_SCREENS.CART) {
    const meal = data.meal === 'dinner' ? 'dinner' : data.meal === 'lunch' ? 'lunch' : tokenCtx.meal || 'lunch';
    const next = String(data.next_step || '').trim();
    const cart = await loadCart(phone);
    if (next === 'add_more') {
      const booking = resolveBooking(meal, tokenCtx.serviceDate || null);
      if (!booking.ok) {
        return cartScreen({ meal, cart, errorMessage: booking.error || 'Meal closed' });
      }
      return categoryScreen({ meal: booking.meal, serviceDay: booking.serviceDay });
    }
    if (next === 'checkout') {
      if (!cart.length) {
        return cartScreen({ meal, cart, errorMessage: 'Add at least one item first' });
      }
      const booking = resolveBooking(meal, tokenCtx.serviceDate || null);
      if (booking.ok && cartViolatesSundayPartyRule(cart, meal, booking.serviceDay)) {
        return cartScreen({ meal, cart, errorMessage: sundayPartyOrderNoticeShort() });
      }
      return fulfillmentScreen({ meal, cart });
    }
    return cartScreen({ meal, cart, errorMessage: 'Choose Add another or Checkout' });
  }

  if (screen === FLOW_SCREENS.FULFILLMENT) {
    const meal = data.meal === 'dinner' ? 'dinner' : data.meal === 'lunch' ? 'lunch' : tokenCtx.meal || 'lunch';
    const choice = String(data.fulfillment || data.fulfillment_type || '').toLowerCase();
    const cart = await loadCart(phone);
    if (choice !== 'delivery' && choice !== 'pickup') {
      return fulfillmentScreen({
        meal,
        cart,
        errorMessage: 'Pick Delivery or Pickup',
      });
    }
    if (!cart.length) {
      return cartScreen({ meal, cart, errorMessage: 'Cart empty — add items first' });
    }
    if (phone) {
      const patch = { fulfillment_type: choice };
      if (choice === 'pickup') {
        patch.address = PICKUP_ADDRESS;
        patch.address_lat = null;
        patch.address_lng = null;
        patch.delivery_distance_km = null;
        patch.flow_prefill_lat = null;
        patch.flow_prefill_lng = null;
        patch.flow_prefill_name = null;
      }
      await getDb().setSession(phone, patch);
    }
    // Pickup: skip address → SLOT (or CONFIRM if slot already chosen)
    if (choice === 'pickup') {
      let deliverySlot = '';
      let serviceLabel = '';
      if (phone) {
        try {
          const sess = await getDb().getSession(phone);
          deliverySlot = String(sess?.delivery_slot || '').trim();
          serviceLabel = String(sess?.service_label || '').trim();
        } catch {
          /* ignore */
        }
      }
      if (deliverySlot) {
        return confirmScreen({
          meal,
          address: PICKUP_ADDRESS,
          cart,
          fulfillmentType: 'pickup',
          deliverySlot,
          serviceLabel,
        });
      }
      const booking = resolveBooking(meal, tokenCtx.serviceDate || nowIst().isoDate);
      const serviceDate = booking.ok
        ? booking.serviceDay.isoDate
        : tokenCtx.serviceDate || nowIst().isoDate;
      return slotScreen({
        meal,
        address: PICKUP_ADDRESS,
        serviceDate,
        fulfillmentType: 'pickup',
      });
    }
    return addressScreen({ meal, cart, phone, fulfillmentType: choice });
  }

  if (screen === FLOW_SCREENS.ADDRESS) {
    const meal = data.meal === 'dinner' ? 'dinner' : data.meal === 'lunch' ? 'lunch' : tokenCtx.meal || 'lunch';
    const choice = String(data.address_choice || '').trim();
    const typed = String(data.address_new || data.address || '').trim();
    const cart = await loadCart(phone);
    let fulfillmentType = String(data.fulfillment_type || '').toLowerCase();
    if (phone && !fulfillmentType) {
      try {
        const sess = await getDb().getSession(phone);
        fulfillmentType = String(sess?.fulfillment_type || 'delivery').toLowerCase();
      } catch {
        fulfillmentType = 'delivery';
      }
    }
    if (fulfillmentType !== 'pickup') fulfillmentType = 'delivery';

    let address = '';
    let prefillLat = null;
    let prefillLng = null;
    let prefillName = null;

    if (choice === 'pickup_kitchen' || fulfillmentType === 'pickup') {
      address = PICKUP_ADDRESS;
      fulfillmentType = 'pickup';
    } else if (choice.startsWith('saved_') && phone) {
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

    if (fulfillmentType !== 'pickup' && address.length < 8) {
      return addressScreen({
        meal,
        cart,
        phone,
        fulfillmentType,
        errorMessage: choice === 'new' || !choice
          ? 'Please enter a fuller address (tower / flat / landmark)'
          : 'Could not load that saved address — type a new one',
      });
    }
    if (!cart.length) {
      const booking = resolveBooking(meal, tokenCtx.serviceDate || null);
      return categoryScreen({
        meal,
        serviceDay: booking.serviceDay,
        errorMessage: 'Cart empty — pick a dish',
      });
    }
    if (phone) {
      await getDb().setSession(phone, {
        address,
        fulfillment_type: fulfillmentType,
        flow_prefill_lat: fulfillmentType === 'pickup' ? null : prefillLat,
        flow_prefill_lng: fulfillmentType === 'pickup' ? null : prefillLng,
        flow_prefill_name: fulfillmentType === 'pickup' ? null : prefillName,
      });
    }
    if (fulfillmentType === 'pickup') {
      let deliverySlot = '';
      let serviceLabel = '';
      if (phone) {
        try {
          const sess = await getDb().getSession(phone);
          deliverySlot = String(sess?.delivery_slot || '').trim();
          serviceLabel = String(sess?.service_label || '').trim();
        } catch {
          /* ignore */
        }
      }
      if (deliverySlot) {
        return confirmScreen({
          meal,
          address: PICKUP_ADDRESS,
          cart,
          fulfillmentType: 'pickup',
          deliverySlot,
          serviceLabel,
        });
      }
      const booking = resolveBooking(meal, tokenCtx.serviceDate || nowIst().isoDate);
      return slotScreen({
        meal,
        address: PICKUP_ADDRESS,
        serviceDate: booking.ok
          ? booking.serviceDay.isoDate
          : tokenCtx.serviceDate || nowIst().isoDate,
        fulfillmentType: 'pickup',
      });
    }
    // Slot already chosen (legacy chat path) — skip in-Flow SLOT when present
    let deliverySlot = '';
    let serviceLabel = '';
    if (phone) {
      try {
        const sess = await getDb().getSession(phone);
        deliverySlot = String(sess?.delivery_slot || '').trim();
        serviceLabel = String(sess?.service_label || '').trim();
      } catch {
        /* ignore */
      }
    }
    if (deliverySlot) {
      return confirmScreen({
        meal,
        address,
        cart,
        fulfillmentType: 'delivery',
        deliverySlot,
        serviceLabel,
      });
    }
    const booking = resolveBooking(meal, tokenCtx.serviceDate || nowIst().isoDate);
    const serviceDate = booking.ok
      ? booking.serviceDay.isoDate
      : tokenCtx.serviceDate || nowIst().isoDate;
    return slotScreen({ meal, address, serviceDate, fulfillmentType: 'delivery' });
  }

  if (screen === FLOW_SCREENS.SLOT) {
    const address = String(data.address || '').trim();
    const slotRaw = String(data.delivery_slot || '').trim();
    let fulfillmentType = String(data.fulfillment_type || '').toLowerCase();
    if (fulfillmentType !== 'pickup') fulfillmentType = 'delivery';
    const cart = await loadCart(phone);
    const fallbackMeal =
      data.meal === 'dinner' ? 'dinner' : data.meal === 'lunch' ? 'lunch' : tokenCtx.meal || 'lunch';

    if (!slotRaw || slotRaw === '_none') {
      return slotScreen({
        meal: fallbackMeal,
        address,
        serviceDate: tokenCtx.serviceDate || nowIst().isoDate,
        fulfillmentType,
        errorMessage: fulfillmentType === 'pickup' ? 'Pick a pickup window' : 'Pick a delivery window',
      });
    }
    const parsed = parseSlotId(slotRaw);
    if (!parsed || !isSlotTimeOpen(parsed.isoDate, parsed.startMin)) {
      return slotScreen({
        meal: fallbackMeal,
        address,
        serviceDate: parsed?.isoDate || tokenCtx.serviceDate || nowIst().isoDate,
        fulfillmentType,
        errorMessage: 'That window closed — pick another',
      });
    }
    const slotMeal = mealFromSlotId(slotRaw) || fallbackMeal;
    const serviceDate = parsed.isoDate;
    const label = serviceLabelWithSlot(serviceDate, slotRaw);
    if (phone) {
      await getDb().setSession(phone, {
        meal: slotMeal,
        delivery_slot: slotRaw,
        service_date: parsed.isoDate,
        service_label: label,
        address: address || (fulfillmentType === 'pickup' ? PICKUP_ADDRESS : ''),
        fulfillment_type: fulfillmentType,
      });
    }
    return confirmScreen({
      meal: slotMeal,
      address: address || (fulfillmentType === 'pickup' ? PICKUP_ADDRESS : ''),
      cart,
      fulfillmentType,
      deliverySlot: slotRaw,
      serviceLabel: label,
    });
  }

  if (screen === FLOW_SCREENS.CONFIRM) {
    const meal = data.meal === 'dinner' ? 'dinner' : data.meal === 'lunch' ? 'lunch' : tokenCtx.meal || 'lunch';
    const address = String(data.address || '').trim();
    let fulfillmentType = String(data.fulfillment_type || '').toLowerCase();
    let deliverySlot = String(data.delivery_slot || '').trim();
    const cart = await loadCart(phone);
    const booking = resolveBooking(meal, tokenCtx.serviceDate || null);
    if (phone) {
      try {
        const sess = await getDb().getSession(phone);
        if (!fulfillmentType && sess?.fulfillment_type) {
          fulfillmentType = String(sess.fulfillment_type).toLowerCase();
        }
        if (!deliverySlot && sess?.delivery_slot) deliverySlot = String(sess.delivery_slot);
      } catch {
        /* ignore */
      }
    }
    if (fulfillmentType !== 'pickup') fulfillmentType = 'delivery';
    if (phone && cart.length) {
      await saveCart(phone, {
        cart,
        meal: booking.ok ? booking.meal : meal,
        serviceDate: booking.ok ? booking.serviceDay.isoDate : tokenCtx.serviceDate,
        serviceLabel: booking.ok
          ? deliverySlot
            ? serviceLabelWithSlot(booking.serviceDay, deliverySlot)
            : booking.serviceDay.dayDateLabel
          : '',
      });
      await getDb().setSession(phone, {
        address: address || (fulfillmentType === 'pickup' ? PICKUP_ADDRESS : ''),
        fulfillment_type: fulfillmentType,
        ...(deliverySlot ? { delivery_slot: deliverySlot } : {}),
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
            service_date: booking.ok ? booking.serviceDay.isoDate : '',
            service_label: booking.ok
              ? deliverySlot
                ? serviceLabelWithSlot(booking.serviceDay, deliverySlot)
                : booking.serviceDay.dayDateLabel
              : '',
            address: address || (fulfillmentType === 'pickup' ? PICKUP_ADDRESS : ''),
            fulfillment_type: fulfillmentType,
            delivery_slot: deliverySlot || '',
            cart_count: String(cartTotalQty(cart)),
          },
        },
      },
    };
  }

  return mealScreenData(tokenCtx, phone);
}
