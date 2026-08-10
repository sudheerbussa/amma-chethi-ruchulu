import { getDb } from '../db.js';
import { config } from '../config.js';
import {
  mealStatusText,
  canCustomerCancelOrder,
  isSessionBookingValid,
  isMealOpen,
  orderDayForMeal,
  nextServiceDayForMeal,
  advanceSlotPrompt,
  otherMealOpenToday,
  mealTitle,
  mealCutoffLabel,
  mealServeLabel,
  nowIst,
  dayFromIso,
} from '../cutoffs.js';
import { getLaunchIso, isBeforeLaunch } from '../ops-settings.js';
import { buildUpiPayUri, sendButtons, sendCtaUrl, sendList, sendText, sendUpiQr } from '../whatsapp.js';
import { tryHandleAdmin } from './admin.js';
import {
  applyOrderStatus,
  paymentThanksMessage,
  tryHandleFeedbackReply,
  tryNudgePendingFeedback,
} from '../orders/status.js';
import { CATEGORIES, categoryLabel, DELIVERY_ZONES } from '../menu.js';
import {
  addToCart,
  cartFoodPaise,
  cartLineFromDish,
  cartTotalQty,
  dishSummaryName,
  formatCartMessage,
  formatLinesText,
  formatPaise,
  getOrderLines,
  maxQtyForCartLine,
  remainingForDish,
  setCartLineQty,
} from '../orders/cart.js';
import { formatDishLabel, formatDishListDescription, formatDishListTitle } from '../ammas.js';
import * as copy from '../copy.js';
import { isRazorpayReady, publicPayUrl } from '../razorpay.js';
import {
  applyOffers,
  formatOffersPublicLines,
  freeDeliveryThresholdPaise,
  qualifiesFreeDelivery,
  DELIVERY_MODES,
} from '../offers.js';

const MAX_CART_LINES = 10;

/** UPI QR / manual PAID: always if no Razorpay; only if UPI_FALLBACK=1 when Razorpay is on */
function useUpiPayment() {
  return !isRazorpayReady() || config.upiFallback;
}

/** Admin-managed min food total (paise) for a service day / session. */
async function minOrderPaiseForDay(dayIso) {
  return getDb().getMinOrderPaise(dayIso || nowIst().isoDate);
}

async function minOrderPaiseForSession(session) {
  return minOrderPaiseForDay(session?.service_date || nowIst().isoDate);
}

/** WhatsApp button title ≤20 chars for next available service day */
function nextSlotButtonTitle(meal, day) {
  const today = nowIst();
  if (day.isoDate === today.isoDate) {
    return meal === 'dinner' ? 'Dinner today' : 'Lunch today';
  }
  if (isBeforeLaunch(today.isoDate) && day.isoDate === getLaunchIso()) {
    return meal === 'dinner' ? 'Open day dinner' : 'Open day lunch';
  }
  const wd = String(day.weekday || '').slice(0, 3);
  const m = meal === 'dinner' ? 'dinner' : 'lunch';
  return `${wd} ${m}`.slice(0, 20);
}

function advanceSlotButtons(meal) {
  const info = orderDayForMeal(meal);
  const other = otherMealOpenToday(meal);
  const buttons = [
    {
      id: `slot_next_${meal}`,
      title: nextSlotButtonTitle(meal, info.serviceDay),
    },
  ];
  if (other) {
    buttons.push({
      id: `slot_today_${other}`,
      title: other === 'dinner' ? 'Dinner today' : 'Lunch today',
    });
  }
  buttons.push({ id: 'menu', title: 'Main menu' });
  return buttons.slice(0, 3);
}

async function notifyAdmins(body) {
  const phones = config.adminPhones || [];
  for (const admin of phones) {
    try {
      await sendText(admin, body);
    } catch (err) {
      console.error('Admin notify failed', admin, err);
    }
  }
}

async function customerName(phone) {
  return (await getDb().getCustomer(phone))?.name || null;
}

async function welcomeBody(phone) {
  const offers = await getDb().listOffers();
  const freeTh = freeDeliveryThresholdPaise(offers);
  const offerLines = formatOffersPublicLines(offers);
  const minOrder = await minOrderPaiseForDay(nowIst().isoDate);
  return copy.welcomeBody({
    businessName: config.businessName,
    mealStatus: mealStatusText(),
    minOrder: formatPaise(minOrder),
    freeDelivery: formatPaise(freeTh ?? config.freeDeliveryAbovePaise),
    offerLines,
    name: await customerName(phone),
  });
}

async function sendMainMenu(phone) {
  const db = getDb();
  const last = await db.findLatestOrder(phone);
  const canReorder =
    last &&
    ['paid', 'preparing', 'out_for_delivery', 'delivered'].includes(last.status) &&
    (getOrderLines(last).length > 0);

  const buttons = canReorder
    ? [
        { id: 'lunch', title: 'Lunch' },
        { id: 'dinner', title: 'Dinner' },
        { id: 'reorder', title: 'Order again' },
      ]
    : [
        { id: 'lunch', title: 'Lunch' },
        { id: 'dinner', title: 'Dinner' },
        { id: 'help', title: 'Help' },
      ];

  await sendButtons(phone, await welcomeBody(phone), buttons, {
    footer: 'STATUS · HELP · MENU',
  });
}

/** If no name on file, confirm WhatsApp profile name or ask to type */
async function ensureCustomerName(phone, nextAction, profileName) {
  const db = getDb();
  const cust = await db.getCustomer(phone);
  if (cust?.name) return true;

  const waName = String(profileName || '').trim().slice(0, 40);
  if (waName.length >= 2) {
    await db.setSession(phone, {
      state: 'await_name_confirm',
      pending_action: nextAction || 'menu',
      suggested_name: waName,
    });
    await sendButtons(phone, copy.confirmWaNameText(waName), [
      { id: 'name_yes', title: 'Yes' },
      { id: 'name_change', title: 'Change name' },
      { id: 'help', title: 'Help' },
    ]);
    return false;
  }

  await db.setSession(phone, {
    state: 'await_name',
    pending_action: nextAction || 'menu',
    suggested_name: null,
  });
  await sendText(phone, copy.askNameText());
  return false;
}

async function continueAfterName(phone, action) {
  const a = action || 'menu';
  if (a === 'lunch') {
    await startMeal(phone, 'lunch');
    return;
  }
  if (a === 'dinner') {
    await startMeal(phone, 'dinner');
    return;
  }
  if (a === 'reorder') {
    await tryReorderLast(phone);
    return;
  }
  await sendMainMenu(phone);
}

async function sendHelpMenu(phone) {
  const db = getDb();
  const latest = await db.findLatestOrder(phone);
  const pending = await db.findLatestPendingOrder(phone);
  let context = 'How can we help?';
  if (pending) {
    context =
      `Your order ${pending.order_ref} is waiting for payment (${formatPaise(pending.total_paise)}).\n` +
      `Pick an option below.`;
  } else if (latest?.status === 'cancelled') {
    context =
      `Order ${latest.order_ref} was cancelled.\n` +
      `We can rebook, check a refund, or answer payment questions.`;
  } else if (latest) {
    context = `Latest order ${latest.order_ref} · ${latest.status}\nWhat do you need help with?`;
  }

  await sendList(phone, {
    header: 'Help & support',
    body: context,
    button: 'Choose topic',
    footer: 'Someone from kitchen will respond',
    sections: [
      {
        title: 'Support',
        rows: [
          {
            id: 'help_payment',
            title: 'Payment failed / paid',
            description: 'Paid but not confirmed, UPI issues',
          },
          {
            id: 'help_cancel',
            title: 'Cancelled order',
            description: 'Refund, re-order, cancel confusion',
          },
          {
            id: 'help_status',
            title: 'Order / delivery status',
            description: 'Where is my food?',
          },
          {
            id: 'help_other',
            title: 'Other issue',
            description: 'Address, taste, packing…',
          },
        ],
      },
    ],
  });
  await db.setSession(phone, { state: 'await_help_topic' });
}

async function handleHelpTopic(phone, topicId) {
  const db = getDb();
  const map = {
    help_payment: 'payment',
    help_cancel: 'cancelled',
    help_status: 'status',
    help_other: 'other',
    payment: 'payment',
    cancelled: 'cancelled',
    status: 'status',
    other: 'other',
  };
  const topic = map[String(topicId || '').toLowerCase()] || 'other';
  const pending = await db.findLatestPendingOrder(phone);
  const latest = await db.findLatestOrder(phone);

  if (topic === 'payment' && pending) {
    await db.setSession(phone, { state: 'idle', help_topic: null });
    // Resend full payment card (Pay now button + summary)
    await sendOrderPayment(phone, {
      orderRef: pending.order_ref,
      itemsText: formatLinesText(getOrderLines(pending)),
      foodPaise: pending.food_paise ?? pending.total_paise - (pending.delivery_fee_paise || 0),
      deliveryFeePaise: pending.delivery_fee_paise || 0,
      deliveryLabel: pending.delivery_zone || 'Tenali',
      totalPaise: pending.total_paise,
      address: pending.address,
      customerName: pending.customer_name,
      serviceLabel: pending.service_label,
      meal: pending.meal,
    });
    return;
  }

  if (topic === 'cancelled' && latest?.status === 'cancelled') {
    await db.setSession(phone, { state: 'await_help_detail', help_topic: 'cancelled' });
    await sendButtons(
      phone,
      `Order ${latest.order_ref} was cancelled.\n` +
        `${formatLinesText(getOrderLines(latest))} · ${formatPaise(latest.total_paise)}\n\n` +
        `Reply with what you need (refund check / re-order / other).\n` +
        `Or tap Lunch / Dinner to place a fresh order.`,
      [
        { id: 'lunch', title: 'Order lunch' },
        { id: 'dinner', title: 'Order dinner' },
        { id: 'help', title: 'Help again' },
      ],
    );
    return;
  }

  if (topic === 'status' && latest) {
    await db.setSession(phone, { state: 'idle', help_topic: null });
    await sendStatus(phone);
    return;
  }

  await db.setSession(phone, { state: 'await_help_detail', help_topic: topic });
  await sendText(
    phone,
    `Got it — ${topic === 'payment' ? 'payment issue' : topic === 'cancelled' ? 'cancelled order' : 'support'}.\n\n` +
      `Please type a short message (order ID if any, what went wrong).\n` +
      `We will message you from the kitchen number.\n\n` +
      `Type Cancel to go back.`,
  );
}

async function submitHelpTicket(phone, topic, message) {
  const db = getDb();
  const pending = await db.findLatestPendingOrder(phone);
  const latest = await db.findLatestOrder(phone);
  const orderRef = pending?.order_ref || latest?.order_ref || null;
  const ticket = await db.saveHelpTicket({
    phone,
    topic,
    message: String(message || '').slice(0, 800),
    order_ref: orderRef,
    order_status: pending?.status || latest?.status || null,
  });

  await db.setSession(phone, { state: 'idle', help_topic: null });

  await notifyAdmins(
    `HELP #${ticket.id} · ${topic}\n` +
      `From: ${phone}\n` +
      (orderRef ? `Order: ${orderRef} (${ticket.order_status || '—'})\n` : '') +
      `Msg: ${ticket.message}\n\n` +
      `Reply on WhatsApp to the customer number.`,
  );

  await sendButtons(
    phone,
    `Thanks — we received your request (#${ticket.id}).\n` +
      `Kitchen will check and reply on this chat soon.\n\n` +
      `Support contact: +${config.supportPhone}`,
    [
      { id: 'status', title: 'My status' },
      { id: 'lunch', title: 'Lunch' },
      { id: 'dinner', title: 'Dinner' },
    ],
  );
}

function sessionServiceLabel(session) {
  if (session?.service_label) return session.service_label;
  if (session?.service_date) return session.service_date;
  return nowIst().dayDateLabel;
}

async function sendCategoryPicker(phone, meal, session = null) {
  const day = sessionServiceLabel(session || await getDb().getSession(phone));
  const title = mealTitle(meal);
  await sendList(phone, {
    header: `${title} menu`.slice(0, 60),
    body:
      `${config.businessName}\n` +
      `📅 ${title} · ${day}\n` +
      `Portions for 1 person. Add multiple items before checkout.`,
    button: 'Categories',
    footer: 'VEG / NONVEG / MEALS / COMBOS / EXTRAS',
    sections: [
      {
        title: 'Menu',
        rows: CATEGORIES.map((c) => ({
          id: `cat_${c.id}`,
          title: `${c.emoji} ${c.title}`.slice(0, 24),
          description: 'Tap to view items',
        })),
      },
    ],
  });
}

async function sendDishList(phone, meal, category, page = 0) {
  const dishes = await getDb().listDishes(meal, category);
  if (!dishes.length) {
    await sendText(phone, `No ${categoryLabel(category)} items available right now.`);
    await sendCategoryPicker(phone, meal);
    return;
  }

  // Leave room for "More" when paginating (WhatsApp max 10 rows)
  const pageSize = 9;
  const start = page * pageSize;
  const slice = dishes.slice(start, start + pageSize);
  const hasMore = start + pageSize < dishes.length;
  const day = sessionServiceLabel(await getDb().getSession(phone));

  const rows = slice.map((d) => {
    const left = Math.max(0, d.max_portions - d.portions_sold);
    const soldOut = left <= 0;
    const desc = formatDishListDescription(d, [
      formatPaise(d.price_paise),
      soldOut ? 'Sold out' : `${left} left`,
      d.advance_only ? 'Advance' : null,
      d.note || null,
    ]);
    return {
      id: d.code,
      title: formatDishListTitle(d),
      description: desc,
    };
  });

  if (hasMore) {
    rows.push({
      id: `more_${category}_${page + 1}`,
      title: 'More items…',
      description: `Page ${page + 2}`,
    });
  }

  await sendList(phone, {
    header: categoryLabel(category).slice(0, 60),
    body:
      `${categoryLabel(category)}` +
      (page > 0 ? ` (page ${page + 1})` : '') +
      `\n📅 ${day}\nSelect an item (or type code e.g. ${dishes[0].code}).`,
    button: 'Choose item',
    footer: 'Type BACK for categories',
    sections: [{ title: 'Available', rows }],
  });
}

async function sendQtyPrompt(phone, dish, left) {
  // Hard cap avoids typos / spam; stock is always the real limit
  const max = Math.max(0, Math.min(Number(left) || 0, 30));
  if (max < 1) {
    await sendText(phone, `${formatDishLabel(dish)} is sold out. Pick another item.`);
    return;
  }

  /** Meta reply buttons: max 3. 1–3 as buttons when max≤3; else 1, 2 + “Other”. */
  const buttons = [];
  if (max <= 3) {
    for (let n = 1; n <= max; n++) {
      buttons.push({ id: `qty_${n}`, title: String(n) });
    }
  } else {
    buttons.push({ id: 'qty_1', title: '1' });
    buttons.push({ id: 'qty_2', title: '2' });
    buttons.push({ id: 'qty_other', title: 'Other qty' });
  }

  const body =
    `How many of ${formatDishLabel(dish)}?\n` +
    `${formatPaise(dish.price_paise)} each · up to ${max} available` +
    (max > 3
      ? `\n\nTap 1 or 2, or tap Other qty then type a number 1–${max}.`
      : `\n\nTap a quantity (1–${max}), or type the number.`) +
    (dish.note ? `\n(${dish.note})` : '') +
    (dish.advance_only ? `\nNote: advance order item — we will confirm availability.` : '');

  if (buttons.length) {
    await sendButtons(phone, body, buttons, { footer: `Max ${max} · or type Cancel` });
  } else {
    await sendText(phone, body);
  }
}

/** Block any further ordering steps if cutoff passed while browsing */
/** Block cart if same-day window closed mid-order (advance bookings stay open) */
async function guardSessionMealOpen(phone, session) {
  if (isSessionBookingValid(session)) return true;

  await getDb().setSession(phone, {
    state: 'idle',
    meal: null,
    service_date: null,
    service_label: null,
    category: null,
    dish_code: null,
    qty: null,
    address: null,
    delivery_zone: null,
    cart: [],
  });
  await sendText(
    phone,
    `Today's ${mealTitle(session.meal)} ordering window closed while you were browsing.\n` +
      `Start again — you can pre-order for tomorrow.`,
  );
  await sendMainMenu(phone);
  return false;
}

async function sendDeliveryPicker(phone, foodPaise, offers) {
  const list = offers || (await getDb().listOffers());
  if (qualifiesFreeDelivery(foodPaise, list)) {
    return false;
  }
  const freeTh = freeDeliveryThresholdPaise(list);
  const freeLine =
    freeTh != null
      ? `Free delivery on food above ${formatPaise(freeTh)} (launch offer).`
      : 'Delivery fee by distance.';
  const discLines = formatOffersPublicLines(list).filter((l) => l.includes('off'));
  await sendButtons(
    phone,
    `Food total: ${formatPaise(foodPaise)}\n\n` +
      `Delivery (Tenali):\n` +
      `• 0–3 km — ₹30\n` +
      `• 3–6 km — ₹45\n` +
      `• Above 6 km — ₹60\n` +
      `${freeLine}\n` +
      (discLines.length ? `${discLines.join('\n')}\n` : '') +
      `\nHow far is your address?`,
    [
      { id: 'z1', title: '0–3 km' },
      { id: 'z2', title: '3–6 km' },
      { id: 'z3', title: 'Above 6 km' },
    ],
  );
  return true;
}

function parseCategory(raw) {
  const t = String(raw || '').trim().toLowerCase();
  if (t.startsWith('cat_')) return t.slice(4);
  const map = {
    veg: 'veg',
    'veg curries': 'veg',
    nonveg: 'nonveg',
    'non-veg': 'nonveg',
    'non veg': 'nonveg',
    meals: 'meals',
    rice: 'meals',
    combos: 'combos',
    combo: 'combos',
    extras: 'extras',
    extra: 'extras',
  };
  return map[t] || null;
}

/** Start browsing menu for a resolved service day */
async function beginMealOrdering(phone, meal, serviceDay) {
  const day = serviceDay || orderDayForMeal(meal).serviceDay;
  await getDb().setSession(phone, {
    state: 'await_category',
    meal,
    service_date: day.isoDate,
    service_label: day.dayDateLabel,
    category: null,
    dish_code: null,
    qty: null,
    address: null,
    delivery_zone: null,
    cart: [],
    pending_action: null,
    pending_meal: null,
  });
  const today = nowIst();
  const isAdvance = day.isoDate !== today.isoDate;
  await sendText(
    phone,
    isAdvance
      ? `Booking ${mealTitle(meal)} for ${day.dayDateLabel}\nServe ~${mealServeLabel(meal)}. Choose from the menu.`
      : `Booking ${mealTitle(meal)} for today (${day.dayDateLabel})\nOrder by ${mealCutoffLabel(meal)} · serve ~${mealServeLabel(meal)}.`,
  );
  await sendCategoryPicker(phone, meal);
}

function preLaunchFooter() {
  // WhatsApp footer ≤60 chars
  const launch = dayFromIso(getLaunchIso());
  return `Opens ${launch.dateLabel} · pre-book`.slice(0, 60);
}

/** After same-day cutoff / closed day / pre-launch: next service day or other open meal */
async function offerAdvanceOrToday(phone, meal) {
  await getDb().setSession(phone, {
    state: 'await_slot_confirm',
    pending_meal: meal,
    meal: null,
    cart: [],
  });

  const footer = isBeforeLaunch(nowIst().isoDate)
    ? preLaunchFooter()
    : 'Pre-order or same-day slot';

  await sendButtons(phone, advanceSlotPrompt(meal), advanceSlotButtons(meal), {
    footer,
  });
}

async function startMeal(phone, meal, profileName) {
  if (!(await ensureCustomerName(phone, meal, profileName))) return;

  if (isMealOpen(meal)) {
    await beginMealOrdering(phone, meal, nowIst());
    return;
  }

  await offerAdvanceOrToday(phone, meal);
}

/** Re-load last successful order lines into cart for same meal window */
async function tryReorderLast(phone, profileName) {
  if (!(await ensureCustomerName(phone, 'reorder', profileName))) return;

  const db = getDb();
  const last = await db.findLatestOrder(phone);
  if (!last) {
    await sendText(phone, 'No previous order found. Tap Lunch or Dinner.');
    await sendMainMenu(phone);
    return;
  }
  const lines = getOrderLines(last);
  if (!lines.length) {
    await sendText(phone, 'Could not re-add previous order. Please order again.');
    await sendMainMenu(phone);
    return;
  }

  const meal = last.meal === 'dinner' ? 'dinner' : 'lunch';

  // Resolve service day (today if open, else next kitchen day after confirm)
  if (!isMealOpen(meal)) {
    await db.setSession(phone, {
      state: 'await_slot_confirm',
      pending_meal: meal,
      pending_action: 'reorder',
      meal: null,
      cart: [],
    });
    const buttons = advanceSlotButtons(meal);
    await sendButtons(
      phone,
      advanceSlotPrompt(meal) + '\n\nAfter you pick a slot, we will re-add your previous dishes if available.',
      buttons,
      {
        footer: isBeforeLaunch(nowIst().isoDate)
          ? preLaunchFooter()
          : 'Pre-order or same-day slot',
      },
    );
    return;
  }

  await fillReorderCart(phone, meal, nowIst());
}

async function fillReorderCart(phone, meal, serviceDay) {
  const db = getDb();
  const last = await db.findLatestOrder(phone);
  const lines = last ? getOrderLines(last) : [];
  if (!lines.length) {
    await beginMealOrdering(phone, meal, serviceDay);
    return;
  }

  let cart = [];
  const missing = [];
  for (const line of lines) {
    const dish = await db.getDish(line.code);
    if (!dish || !dish.active) {
      missing.push(line.name || line.code);
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
    const qty = Math.min(Number(line.qty) || 1, left, 30);
    cart = addToCart(cart, cartLineFromDish(dish, qty));
  }

  if (!cart.length) {
    await sendText(phone, 'Previous items are not available. Please order fresh from the menu.');
    await beginMealOrdering(phone, meal, serviceDay);
    return;
  }

  await db.setSession(phone, {
    state: 'await_cart',
    meal,
    service_date: serviceDay.isoDate,
    service_label: serviceDay.dayDateLabel,
    cart,
    dish_code: null,
    qty: null,
    category: null,
    pending_action: null,
    pending_meal: null,
  });

  const food = cartFoodPaise(cart);
  await sendText(
    phone,
    `📅 Service: ${serviceDay.dayDateLabel} · ${mealTitle(meal)}\n` +
      copy.reorderConfirm(formatLinesText(cart), formatPaise(food)) +
      (missing.length ? `\n\nNote: ${missing.slice(0, 3).join(', ')} unavailable.` : ''),
  );
  await sendCartActions(phone, { ...await db.getSession(phone), cart, meal });
}

async function pickDish(phone, session, code) {
  const db = getDb();
  const cart = Array.isArray(session.cart) ? session.cart : [];
  const dish = await db.getDish(code);
  if (!dish || !dish.active) {
    await sendText(phone, 'Unknown or unavailable item. Pick from the list or type BACK.');
    if (session.category) await sendDishList(phone, session.meal, session.category);
    else await sendCategoryPicker(phone, session.meal);
    return;
  }
  if (session.meal && dish.meal !== 'both' && dish.meal !== session.meal) {
    await sendText(phone, `${formatDishLabel(dish)} is not available for ${session.meal}.`);
    return;
  }
  if (cart.length >= MAX_CART_LINES) {
    await sendText(
      phone,
      `Cart can hold up to ${MAX_CART_LINES} different items. Checkout or remove items (CLEAR).`,
    );
    await sendCartActions(phone, session);
    return;
  }
  const left = remainingForDish(dish, cart);
  if (left <= 0) {
    await sendText(phone, `${formatDishLabel(dish)} is sold out (or already maxed in your cart). Pick another.`);
    await sendDishList(phone, session.meal, dish.category);
    return;
  }
  await db.setSession(phone, {
    state: 'await_qty',
    category: dish.category,
    dish_code: dish.code,
  });
  await sendQtyPrompt(phone, dish, left);
}

async function sendCartActions(phone, session) {
  const cart = Array.isArray(session.cart) ? session.cart : [];
  const minOrder = await minOrderPaiseForSession(session);
  const food = cartFoodPaise(cart);
  const canCheckout = food >= minOrder && cart.length > 0;
  const hasItems = cart.length > 0;
  const offers = await getDb().listOffers();
  const offerLines = formatOffersPublicLines(offers);

  let buttons;
  if (canCheckout) {
    buttons = [
      { id: 'cart_add', title: 'Add more' },
      { id: 'cart_checkout', title: 'Checkout' },
      { id: 'cart_edit', title: 'Edit cart' },
    ];
  } else if (hasItems) {
    buttons = [
      { id: 'cart_add', title: 'Add more' },
      { id: 'cart_edit', title: 'Edit cart' },
      { id: 'cart_clear', title: 'Clear all' },
    ];
  } else {
    buttons = [
      { id: 'cart_add', title: 'Add items' },
      { id: 'lunch', title: 'Lunch' },
      { id: 'dinner', title: 'Dinner' },
    ];
  }

  await sendButtons(
    phone,
    `${formatCartMessage(cart, { minOrderPaise: minOrder, offerLines })}\n\n` +
      `📅 Service: ${sessionServiceLabel(session)} · ${mealTitle(session.meal || 'lunch')}\n` +
      (canCheckout
        ? 'Add more, edit lines (qty/remove), or checkout.'
        : hasItems
          ? minOrder > 0
            ? `Add more or edit cart. Min order ${formatPaise(minOrder)}.`
            : 'Edit cart or add items to continue.'
          : 'Cart empty — add dishes to continue.'),
    buttons,
    { footer: 'EDIT · CLEAR · Cancel' },
  );
  await getDb().setSession(phone, { state: 'await_cart', edit_code: null });
}

/** Pick a cart line to change qty or remove (list, max 9 lines + Done) */
async function sendCartEditList(phone, session) {
  const cart = Array.isArray(session.cart) ? session.cart : [];
  if (!cart.length) {
    await sendText(phone, 'Cart is empty — nothing to edit.');
    await sendCartActions(phone, { ...session, cart: [] });
    return;
  }

  const rows = cart.slice(0, 9).map((i) => {
    const lineTotal = formatPaise((i.unit_price_paise || 0) * (i.qty || 0));
    return {
      id: `editline_${i.code}`,
      title: `${i.qty}x ${(i.name || i.code)}`.slice(0, 24),
      description: `${lineTotal} · tap to change/remove`.slice(0, 72),
    };
  });
  rows.push({
    id: 'edit_done',
    title: 'Done',
    description: 'Back to cart options',
  });

  await sendList(phone, {
    header: 'Edit cart',
    body:
      `${formatCartMessage(cart, { minOrderPaise: await minOrderPaiseForSession(session), numbered: true })}\n\n` +
      `Select a line to change quantity or remove.`,
    button: 'Choose line',
    footer: 'Or type BACK',
    sections: [{ title: 'Your items', rows }],
  });
  await getDb().setSession(phone, { state: 'await_cart_edit', edit_code: null });
}

async function sendCartLineEditor(phone, session, code) {
  const db = getDb();
  const cart = Array.isArray(session.cart) ? session.cart : [];
  const line = cart.find((i) => String(i.code).toUpperCase() === String(code).toUpperCase());
  if (!line) {
    await sendText(phone, 'That item is not in your cart.');
    await sendCartEditList(phone, session);
    return;
  }

  const dish = await db.getDish(line.code);
  const maxQ = maxQtyForCartLine(dish || { max_portions: line.qty, portions_sold: 0, code: line.code }, cart, line.code);
  const cap = Math.max(1, maxQ || line.qty || 1);

  const rows = [];
  // WhatsApp list: max 10 rows. Use 1–8 qty + type-custom note + remove + back
  const listCap = Math.min(8, cap);
  for (let n = 1; n <= listCap; n++) {
    rows.push({
      id: `setqty_${n}`,
      title: n === line.qty ? `${n} (current)` : `Set qty ${n}`,
      description: formatPaise((line.unit_price_paise || 0) * n),
    });
  }
  if (cap > 8) {
    rows.push({
      id: 'setqty_type',
      title: 'Type a number',
      description: `Enter 1–${cap} as text`,
    });
  }
  rows.push({
    id: 'setremove',
    title: 'Remove item',
    description: `Remove ${line.name || line.code}`,
  });
  rows.push({
    id: 'edit_back',
    title: 'Back to lines',
    description: 'Pick another item',
  });

  await sendList(phone, {
    header: 'Change line',
    body:
      `${line.qty}x ${line.name || line.code}\n` +
      `Unit: ${formatPaise(line.unit_price_paise)}\n` +
      `Max available now: ${cap}\n` +
      (cap > 8
        ? `\nPick 1–${listCap} below, or Type a number then reply with 1–${cap}.`
        : `\nPick new quantity, or remove.`),
    button: 'Change',
    footer: 'Or type 0 to remove',
    sections: [{ title: 'Options', rows: rows.slice(0, 10) }],
  });
  await db.setSession(phone, { state: 'await_cart_line', edit_code: line.code });
}

async function applyCartLineChange(phone, session, qtyOrRemove) {
  const db = getDb();
  const cart = Array.isArray(session.cart) ? session.cart : [];
  const code = session.edit_code;
  if (!code) {
    await sendCartEditList(phone, session);
    return;
  }

  const dish = await db.getDish(code);
  const line = cart.find((i) => String(i.code).toUpperCase() === String(code).toUpperCase());
  const name = line?.name || code;

  if (qtyOrRemove === 'remove' || qtyOrRemove === 0) {
    const { cart: next } = setCartLineQty(cart, code, 0);
    await db.setSession(phone, { cart: next, edit_code: null });
    await sendText(phone, `Removed ${name} from cart.`);
    if (!next.length) {
      await sendCartActions(phone, { ...session, cart: next });
      return;
    }
    await sendCartEditList(phone, { ...session, cart: next });
    return;
  }

  const qty = Number(qtyOrRemove);
  const maxQ = maxQtyForCartLine(
    dish || { max_portions: qty, portions_sold: 0, code },
    cart,
    code,
  );
  if (!Number.isInteger(qty) || qty < 1 || qty > maxQ) {
    await sendText(phone, `Choose a quantity from 1 to ${Math.max(1, maxQ)} (or remove).`);
    await sendCartLineEditor(phone, session, code);
    return;
  }

  const { cart: next, error } = setCartLineQty(cart, code, qty);
  if (error) {
    await sendText(phone, error);
    await sendCartEditList(phone, session);
    return;
  }
  await db.setSession(phone, { cart: next, edit_code: null });
  await sendText(phone, `Updated: ${qty}x ${name}.`);
  await sendCartEditList(phone, { ...session, cart: next });
}

async function beginCheckout(phone, session) {
  if (!(await guardSessionMealOpen(phone, session))) return;
  const cart = Array.isArray(session.cart) ? session.cart : [];
  const foodPaise = cartFoodPaise(cart);
  const minOrder = await minOrderPaiseForSession(session);
  if (!cart.length) {
    await sendText(phone, 'Cart is empty. Tap Lunch or Dinner to start.');
    await sendMainMenu(phone);
    return;
  }
  if (foodPaise < minOrder) {
    await sendText(
      phone,
      `Minimum order is ${formatPaise(minOrder)} (food).\n` +
        `Your cart is ${formatPaise(foodPaise)}. Add more items.`,
    );
    await sendCartActions(phone, session);
    return;
  }

  const cust = await getDb().getCustomer(phone);
  const saved = (cust?.addresses || []).slice().sort((a, b) =>
    String(b.last_used_at || '').localeCompare(String(a.last_used_at || '')),
  );

  if (saved.length) {
    await getDb().setSession(phone, {
      state: 'await_address_pick',
      dish_code: null,
      qty: null,
    });
    const rows = saved.slice(0, 8).map((a, i) => ({
      id: `addr_${a.id}`,
      title: `${i + 1}. ${(a.text || '').slice(0, 20)}`,
      description: (a.text || '').slice(0, 72),
    }));
    rows.push({
      id: 'addr_new',
      title: 'New address',
      description: 'Type a new delivery address',
    });
    await sendList(phone, {
      header: 'Delivery address',
      body: copy.savedAddressPrompt(formatCartMessage(cart, { minOrderPaise: minOrder })),
      button: 'Addresses',
      footer: 'Saved on this WhatsApp number',
      sections: [{ title: 'Addresses', rows }],
    });
    return;
  }

  await getDb().setSession(phone, {
    state: 'await_address',
    dish_code: null,
    qty: null,
  });
  await sendText(
    phone,
    copy.askAddressNewText(formatCartMessage(cart, { minOrderPaise: minOrder })),
  );
}

async function proceedWithAddress(phone, session, addressText, preferredZone) {
  const db = getDb();
  const address = String(addressText || '').trim();
  if (address.length < 8) {
    await sendText(phone, 'Please send a fuller address (area + landmark).');
    return;
  }
  const cart = Array.isArray(session.cart) ? session.cart : [];
  const foodPaise = cartFoodPaise(cart);
  const offers = await db.listOffers();
  const dayIso = session.service_date || nowIst().isoDate;
  const deliv = await db.getEffectiveDeliverySettings(dayIso);
  await db.setSession(phone, { state: 'await_delivery', address });

  // Free-delivery offer OR flat admin mode → no km picker
  if (qualifiesFreeDelivery(foodPaise, offers)) {
    await finalizeOrder(phone, { ...session, address }, preferredZone || 'z1');
    return;
  }
  if (deliv.mode === DELIVERY_MODES.flat) {
    await sendText(
      phone,
      `Delivery today is a flat rate of ${formatPaise(deliv.flat_paise)} to all Tenali addresses` +
        (deliv.source === 'day_override' ? ' (today’s admin setting)' : '') +
        `.`,
    );
    await finalizeOrder(phone, { ...session, address }, 'flat');
    return;
  }
  if (preferredZone && ['z1', 'z2', 'z3'].includes(preferredZone)) {
    await finalizeOrder(phone, { ...session, address }, preferredZone);
    return;
  }

  const custZone = (await db.getCustomer(phone))?.default_zone;
  if (custZone && ['z1', 'z2', 'z3'].includes(custZone)) {
    await sendButtons(
      phone,
      `Use last delivery distance, or change it?\n` +
        `Food ${formatPaise(foodPaise)}`,
      [
        { id: custZone, title: 'Same zone' },
        { id: 'z_pick', title: 'Change km' },
        { id: 'help', title: 'Help' },
      ],
    );
    await db.setSession(phone, { state: 'await_delivery', address, suggest_zone: custZone });
    return;
  }

  await sendDeliveryPicker(phone, foodPaise, offers);
}

async function finalizeOrder(phone, session, deliveryZone) {
  if (!(await guardSessionMealOpen(phone, session))) return;
  const db = getDb();
  const cart = Array.isArray(session.cart) ? session.cart : [];
  if (!cart.length) {
    await sendText(phone, 'Order expired. Start again with Lunch or Dinner.');
    await db.setSession(phone, { state: 'idle', cart: [] });
    return;
  }

  for (const line of cart) {
    const dish = await db.getDish(line.code);
    if (!dish || !dish.active) {
      await sendText(phone, `${line.name || line.code} is unavailable. Update your cart.`);
      await sendCartActions(phone, { ...session, cart });
      return;
    }
    const left = remainingForDish(dish, cart.filter((c) => c.code !== line.code));
    if (line.qty > left) {
      await sendText(
        phone,
        `Only ${left} left of ${formatDishLabel(dish)}. Adjust cart.`,
      );
      await sendCartActions(phone, session);
      return;
    }
  }

  const foodPaise = cartFoodPaise(cart);
  const minOrder = await minOrderPaiseForSession(session);
  if (foodPaise < minOrder) {
    await sendText(
      phone,
      `Minimum order is ${formatPaise(minOrder)}. Cart is ${formatPaise(foodPaise)}.`,
    );
    await sendCartActions(phone, session);
    return;
  }

  const offers = await db.listOffers();
  const dayIso = session.service_date || nowIst().isoDate;
  const deliverySettings = await db.getDeliverySettings();
  const pricing = applyOffers({
    foodPaise,
    zoneId: deliveryZone,
    offers,
    deliverySettings,
    dayIso,
  });
  const fee = pricing.delivery_fee_paise;
  const total = pricing.total_paise;
  const discount = pricing.discount_paise;
  const serviceDate = session.service_date || nowIst().isoDate;
  const orderRef = await db.nextOrderRef(session.meal, serviceDate);
  const zone = DELIVERY_ZONES.find((z) => z.id === deliveryZone);
  const storeZone = pricing.zone_id || deliveryZone;
  const primary = cart[0];
  const items = cart.map((i) => ({
    code: i.code,
    name: i.name,
    base_name: i.base_name || null,
    qty: i.qty,
    unit_price_paise: i.unit_price_paise,
    category: i.category,
    cook_name: i.cook_name || null,
    amma_id: i.amma_id || null,
  }));
  const cust = await db.getCustomer(phone);

  await db.saveCustomerAddress(phone, {
    text: session.address,
    zone: storeZone === 'flat' ? undefined : storeZone,
  });
  await db.noteCustomerOrder(phone);
  await db.createOrder({
    order_ref: orderRef,
    phone,
    customer_name: cust?.name || null,
    meal: session.meal,
    service_date: serviceDate,
    service_label: session.service_label || nowIst().dayDateLabel,
    items,
    dish_code: primary.code,
    dish_name: dishSummaryName(cart),
    category: primary.category,
    qty: cartTotalQty(cart),
    unit_price_paise: primary.unit_price_paise,
    food_paise: foodPaise,
    delivery_zone: storeZone,
    delivery_fee_paise: fee,
    discount_paise: discount,
    free_delivery: pricing.free_delivery,
    offers_applied: pricing.applied,
    total_paise: total,
    address: session.address,
    status: 'pending_payment',
    source: 'whatsapp',
    meta: {
      discount_paise: discount,
      free_delivery: pricing.free_delivery,
      offers_applied: pricing.applied,
      delivery_mode: pricing.delivery_mode,
      delivery_settings_source: pricing.delivery_settings_source,
    },
  });

  await db.setSession(phone, {
    state: 'idle',
    meal: null,
    service_date: null,
    service_label: null,
    category: null,
    dish_code: null,
    qty: null,
    address: null,
    delivery_zone: null,
    cart: [],
    suggest_zone: null,
  });

  await sendOrderPayment(phone, {
    orderRef,
    itemsText: formatLinesText(items),
    foodPaise,
    deliveryFeePaise: fee,
    deliveryLabel:
      pricing.delivery_label ||
      (fee === 0 ? 'FREE' : zone?.title || deliveryZone),
    discountPaise: discount,
    offersApplied: pricing.applied,
    totalPaise: total,
    address: session.address,
    customerName: cust?.name,
    serviceLabel: session.service_label || nowIst().dayDateLabel,
    meal: session.meal,
  });
}

async function sendOrderPayment(phone, {
  orderRef,
  itemsText,
  foodPaise,
  deliveryFeePaise: fee,
  deliveryLabel,
  discountPaise = 0,
  offersApplied = [],
  totalPaise,
  address,
  customerName: cname,
  serviceLabel,
  meal,
}) {
  const amountRupees = totalPaise / 100;
  const upiUri = buildUpiPayUri({ amountRupees, orderRef });
  const who = cname ? `${cname}, ` : '';
  const when =
    serviceLabel || meal
      ? `Service: ${mealTitle(meal || 'lunch')} · ${serviceLabel || 'today'}\n`
      : '';
  const payLink = isRazorpayReady() ? publicPayUrl(orderRef) : null;
  const withUpi = useUpiPayment();

  let payBlock;
  if (payLink && withUpi) {
    payBlock =
      `Tap Pay now below for secure online payment (recommended).\n\n` +
      `Or UPI:\n` +
      `UPI: ${config.upiId}\n` +
      `Name: ${config.upiPayeeName}\n` +
      `Amount: ${formatPaise(totalPaise)}\n` +
      `Note: ${orderRef}\n\n` +
      `After online pay, status updates automatically.\n` +
      `After UPI only, reply: PAID ${orderRef}`;
  } else if (payLink) {
    payBlock =
      `Tap Pay now below to pay ${formatPaise(totalPaise)} securely online.\n` +
      `Status updates automatically after payment.`;
  } else {
    payBlock =
      `Pay via UPI:\n` +
      `UPI: ${config.upiId}\n` +
      `Name: ${config.upiPayeeName}\n` +
      `Amount: ${formatPaise(totalPaise)}\n` +
      `Note: ${orderRef}\n\n` +
      `Scan the QR next. After paying, reply: PAID ${orderRef}`;
  }

  const discountLine =
    discountPaise > 0
      ? `Discount: −${formatPaise(discountPaise)}\n` +
        (offersApplied?.length
          ? `  (${offersApplied.map((a) => a.title).join('; ')})\n`
          : '')
      : offersApplied?.length
        ? `Offers: ${offersApplied.map((a) => a.title).join('; ')}\n`
        : '';

  const summary =
    `${who}Order ${orderRef} noted ✅\n` +
    when +
    `${itemsText}\n` +
    `Food: ${formatPaise(foodPaise)}\n` +
    discountLine +
    `Delivery (${deliveryLabel}): ${formatPaise(fee)}\n` +
    `Total: ${formatPaise(totalPaise)}\n` +
    `Address: ${address}\n\n` +
    payBlock;

  if (payLink) {
    // CTA URL = opens browser; cannot mix with reply buttons on same message
    await sendCtaUrl(phone, summary, { displayText: 'Pay now', url: payLink }, {
      footer: 'Safe checkout · status auto-updates',
    });
    await sendButtons(phone, 'After paying (or if you need help):', [
      { id: 'status', title: 'My status' },
      { id: 'help', title: 'Help' },
      { id: 'menu', title: 'Main menu' },
    ]);
  } else {
    await sendButtons(
      phone,
      summary,
      [
        { id: 'status', title: 'My status' },
        { id: 'help', title: 'Help' },
        { id: 'menu', title: 'Main menu' },
      ],
    );
  }

  if (!withUpi) return;

  try {
    await sendUpiQr(
      phone,
      payLink
        ? `UPI fallback · ${formatPaise(totalPaise)} · ${orderRef}\nOr use Pay now above`
        : `Scan & pay ${formatPaise(totalPaise)} · ${orderRef}\nUPI: ${config.upiId}`,
    );
  } catch (err) {
    console.error('UPI QR send failed', err);
    if (!payLink) {
      await sendText(
        phone,
        `Could not send QR.\nPay ${formatPaise(totalPaise)} to ${config.upiId}\nOrder: ${orderRef}\n\n${upiUri}`,
      );
    }
  }
}

async function sendStatus(phone) {
  const order = await getDb().findLatestOrder(phone);
  if (!order) {
    await sendText(phone, 'No orders yet. Tap Lunch or Dinner to start.');
    await sendMainMenu(phone);
    return;
  }
  const fee = order.delivery_fee_paise ?? 0;
  const disc = order.discount_paise ?? 0;
  const name = order.customer_name || await customerName(phone);
  let extra = '';
  let pendingPayUrl = null;
  if (order.status === 'pending_payment') {
    pendingPayUrl = isRazorpayReady() ? publicPayUrl(order.order_ref) : null;
    if (pendingPayUrl && useUpiPayment()) {
      extra = `\n\nTap Pay now below, or UPI then reply PAID ${order.order_ref} · Help.`;
    } else if (pendingPayUrl) {
      extra = `\n\nTap Pay now below (status updates after payment) · Help.`;
    } else {
      extra = `\n\nAfter UPI, reply: PAID ${order.order_ref} · or Help.`;
    }
  } else if (order.status === 'cancelled') {
    extra = '\n\nRefund / re-order — type HELP.';
  } else if (order.status === 'delivered' && !await getDb().getFeedbackByOrder(order.order_ref)) {
    extra = '\n\nRate your food: reply RATE.';
  }

  const statusBody =
    (name ? `${name} · ` : '') +
    `Order ${order.order_ref}\n` +
    `Status: ${order.status}\n` +
    `${formatLinesText(getOrderLines(order))}\n` +
    `Food: ${formatPaise(order.food_paise ?? order.total_paise - fee + disc)}\n` +
    (disc > 0 ? `Discount: −${formatPaise(disc)}\n` : '') +
    `Delivery: ${formatPaise(fee)}\n` +
    `Total: ${formatPaise(order.total_paise)}\n` +
    `Address: ${order.address}\n` +
    `Meal: ${order.meal}` +
    (order.service_label || order.service_date
      ? `\nService: ${order.service_label || order.service_date}`
      : '') +
    extra;

  if (pendingPayUrl) {
    await sendCtaUrl(phone, statusBody, { displayText: 'Pay now', url: pendingPayUrl }, {
      footer: 'Safe checkout',
    });
    await sendButtons(phone, 'More options:', [
      { id: 'help', title: 'Help' },
      { id: 'lunch', title: 'Lunch' },
      { id: 'dinner', title: 'Dinner' },
    ]);
  } else {
    await sendButtons(phone, statusBody, [
      { id: 'help', title: 'Help' },
      { id: 'lunch', title: 'Lunch' },
      { id: 'dinner', title: 'Dinner' },
    ]);
  }
}

async function clearOrderingSession(db, phone, extra = {}) {
  await db.setSession(phone, {
    state: 'idle',
    meal: null,
    service_date: null,
    service_label: null,
    pending_meal: null,
    category: null,
    dish_code: null,
    qty: null,
    address: null,
    delivery_zone: null,
    cart: [],
    help_topic: null,
    ...extra,
  });
}

async function handleSlotConfirm(phone, lower, session) {
  const db = getDb();
  const wantReorder = session.pending_action === 'reorder';

  if (lower === 'menu' || lower === 'cancel' || lower === 'stop') {
    await clearOrderingSession(db, phone);
    await sendMainMenu(phone);
    return;
  }

  let meal = null;
  let serviceDay = null;

  if (lower.startsWith('slot_next_')) {
    meal = lower === 'slot_next_dinner' ? 'dinner' : 'lunch';
    serviceDay = nextServiceDayForMeal(meal, 0);
  } else if (lower.startsWith('slot_today_')) {
    meal = lower === 'slot_today_dinner' ? 'dinner' : 'lunch';
    if (!isMealOpen(meal)) {
      await sendText(phone, `${mealTitle(meal)} is no longer open for today. Pick another option.`);
      await offerAdvanceOrToday(phone, session.pending_meal || meal);
      return;
    }
    serviceDay = nowIst();
  } else if (
    [
      'tomorrow',
      'yes',
      'y',
      'ok',
      'order tomorrow',
      'preorder',
      'pre-order',
      'open day',
      'opening day',
      'book opening',
      'first day',
    ].includes(lower)
  ) {
    meal = session.pending_meal === 'dinner' ? 'dinner' : 'lunch';
    serviceDay = nextServiceDayForMeal(meal, 0);
  } else if (lower === 'dinner' || lower === 'lunch') {
    meal = lower;
    if (isMealOpen(meal)) serviceDay = nowIst();
    else serviceDay = nextServiceDayForMeal(meal, 0);
  } else {
    await offerAdvanceOrToday(phone, session.pending_meal || 'lunch');
    return;
  }

  await db.setSession(phone, { pending_meal: null, pending_action: null });

  if (wantReorder) {
    await fillReorderCart(phone, meal, serviceDay);
    return;
  }
  await beginMealOrdering(phone, meal, serviceDay);
}

export async function handleIncoming({ from, text, profileName }) {
  const phone = String(from).replace(/\D/g, '');
  const raw = String(text || '').trim();
  const lower = raw.toLowerCase();
  const profile = String(profileName || '').trim().slice(0, 40);
  const db = getDb();
  const session = await db.getSession(phone);

  if (await tryHandleAdmin({ from: phone, text: raw })) return;

  // Post-delivery item feedback (ratings for ordered dishes only)
  if (await tryHandleFeedbackReply({ phone, text: raw })) return;

  // After cut-off: confirm tomorrow pre-order or open same-day slot
  if (session.state === 'await_slot_confirm') {
    await handleSlotConfirm(phone, lower, session);
    return;
  }

  // HELP — payment stuck, cancelled, delivery questions
  if (lower === 'help' || lower === 'support') {
    await sendHelpMenu(phone);
    return;
  }

  if (session.state === 'await_help_topic') {
    const topicKey = lower.startsWith('help_')
      ? lower
      : `help_${lower === 'cancelled' || lower === 'cancel' ? 'cancel' : lower}`;
    await handleHelpTopic(phone, topicKey);
    return;
  }

  if (session.state === 'await_help_detail') {
    if (lower === 'cancel' || lower === 'stop') {
      await db.setSession(phone, { state: 'idle', help_topic: null });
      await sendMainMenu(phone);
      return;
    }
    if (lower === 'help') {
      await sendHelpMenu(phone);
      return;
    }
    if (lower === 'lunch' || lower === 'dinner') {
      await db.setSession(phone, { state: 'idle', help_topic: null });
    } else {
      await submitHelpTicket(phone, session.help_topic || 'other', raw);
      return;
    }
  }

  // Confirm WhatsApp profile display name
  if (session.state === 'await_name_confirm') {
    if (lower === 'name_yes' || lower === 'yes' || lower === 'y' || lower === 'అవును' || lower === 'sare' || lower === 'ok') {
      const name = session.suggested_name || profile;
      const saved = await db.setCustomerName(phone, name);
      const next = session.pending_action || 'menu';
      await db.setSession(phone, { state: 'idle', pending_action: null, suggested_name: null });
      if (saved) await sendText(phone, copy.nameSavedText(saved.name));
      await continueAfterName(phone, next);
      return;
    }
    if (lower === 'name_change' || lower === 'change' || lower === 'change name' || lower === 'no') {
      await db.setSession(phone, { state: 'await_name' });
      await sendText(phone, copy.askNameText());
      return;
    }
    // Typed a different name directly
    if (raw.length >= 2 && !['hi', 'hello', 'help', 'lunch', 'dinner'].includes(lower)) {
      const saved = await db.setCustomerName(phone, raw);
      if (!saved) {
        await sendText(phone, 'Please enter a valid name (at least 2 characters).');
        return;
      }
      const next = session.pending_action || 'menu';
      await db.setSession(phone, { state: 'idle', pending_action: null, suggested_name: null });
      await sendText(phone, copy.nameSavedText(saved.name));
      await continueAfterName(phone, next);
      return;
    }
    await sendButtons(
      phone,
      copy.confirmWaNameText(session.suggested_name || profile || '…'),
      [
        { id: 'name_yes', title: 'Yes' },
        { id: 'name_change', title: 'Change name' },
        { id: 'help', title: 'Help' },
      ],
    );
    return;
  }

  // First-time name capture (type)
  if (session.state === 'await_name') {
    if (['cancel', 'stop'].includes(lower)) {
      await clearOrderingSession(db, phone);
      await sendMainMenu(phone);
      return;
    }
    const saved = await db.setCustomerName(phone, raw);
    if (!saved) {
      await sendText(phone, 'Please enter a valid name (at least 2 characters).');
      return;
    }
    const next = session.pending_action || 'menu';
    await db.setSession(phone, { state: 'idle', pending_action: null });
    await sendText(phone, copy.nameSavedText(saved.name));
    await continueAfterName(phone, next);
    return;
  }

  if (['hi', 'hello', 'hii', 'hey', 'start', 'నమస్కారం'].includes(lower)) {
    await clearOrderingSession(db, phone);
    if (!(await db.getCustomer(phone))?.name) {
      await ensureCustomerName(phone, 'menu', profile);
      return;
    }
    await sendMainMenu(phone);
    await tryNudgePendingFeedback(phone);
    return;
  }

  if (lower === 'status' || lower === 'my status') {
    await sendStatus(phone);
    return;
  }

  const paidMatch = raw.match(/^paid(?:\s+([A-Za-z0-9_-]+))?$/i);
  if (paidMatch) {
    const refFromMsg = paidMatch[1];
    let order = refFromMsg
      ? await db.findOrderByRef(refFromMsg)
      : await db.findLatestPendingOrder(phone);

    if (refFromMsg && order && order.phone !== phone) {
      await sendText(phone, 'That order ID does not belong to this WhatsApp number.');
      return;
    }
    if (!order) {
      await sendButtons(
        phone,
        refFromMsg
          ? `Order ${refFromMsg.toUpperCase()} not found. Try PAID L123456, or tap Help.`
          : 'No pending payment order found. Reply PAID with your order ID, or tap Help if you already paid.',
        [
          { id: 'help', title: 'Help' },
          { id: 'status', title: 'My status' },
          { id: 'lunch', title: 'Lunch' },
        ],
      );
      return;
    }
    if (order.status === 'paid' || order.status === 'preparing' || order.status === 'out_for_delivery' || order.status === 'delivered') {
      await sendText(phone, `Already marked paid / in kitchen.\n\n${paymentThanksMessage(order)}`);
      return;
    }
    if (order.status !== 'pending_payment') {
      await sendButtons(
        phone,
        `Order ${order.order_ref} is ${order.status}. Cannot mark PAID from here.`,
        [
          { id: 'help', title: 'Help' },
          { id: 'status', title: 'My status' },
          { id: 'lunch', title: 'Lunch' },
        ],
      );
      return;
    }
    const result = await applyOrderStatus(order.order_ref, 'paid', { notifyCustomer: true });
    if (!result.ok) await sendText(phone, result.error || 'Could not update payment.');
    return;
  }

  if (lower === 'cancel' || lower === 'stop') {
    const pending = await db.findLatestPendingOrder(phone);
    if (pending) {
      const cancelOk = canCustomerCancelOrder(pending);
      if (!cancelOk.ok) {
        await sendButtons(phone, cancelOk.message, [
          { id: 'help', title: 'Help' },
          { id: 'status', title: 'Status' },
          { id: 'menu', title: 'Menu' },
        ]);
        return;
      }
      await applyOrderStatus(pending.order_ref, 'cancelled', { notifyCustomer: false });
      await clearOrderingSession(db, phone);
      await sendButtons(
        phone,
        `Order ${pending.order_ref} cancelled.\nIf money already left your account, tap Help for a refund check.`,
        [
          { id: 'help', title: 'Help' },
          { id: 'lunch', title: 'Lunch' },
          { id: 'dinner', title: 'Dinner' },
        ],
      );
      return;
    }
    // Cancel mid-browse cart/session — always OK (no kitchen order yet)
    await clearOrderingSession(db, phone);
    await sendButtons(phone, 'OK — cart cleared. What next?', [
      { id: 'lunch', title: 'Lunch' },
      { id: 'dinner', title: 'Dinner' },
      { id: 'help', title: 'Help' },
    ]);
    return;
  }

  if (lower === 'menu') {
    await sendText(
      phone,
      `${await welcomeBody(phone)}\n\n` +
        `Categories: Veg · Non-veg · Rice & meals · Combos · Extras\n` +
        `Popular: Veg Combo (C01) · Egg Combo (C02) · Chicken Combo (C03)\n` +
        `Payment issue? HELP`,
    );
    await sendMainMenu(phone);
    return;
  }

  if (lower === 'lunch') {
    await startMeal(phone, 'lunch', profile);
    return;
  }

  if (lower === 'dinner') {
    await startMeal(phone, 'dinner', profile);
    return;
  }

  if (lower === 'reorder' || lower === 'again' || lower === 'order again' || lower === 'మళ్లీ') {
    await tryReorderLast(phone, profile);
    return;
  }

  if (lower === 'back' && (session.state === 'await_dish' || session.state === 'await_category')) {
    if (!(await guardSessionMealOpen(phone, session))) return;
    await db.setSession(phone, { state: 'await_category', category: null, dish_code: null });
    await sendCategoryPicker(phone, session.meal || 'lunch');
    return;
  }

  // Mid-order / cart after cutover → block
  if (
    [
      'await_category',
      'await_dish',
      'await_qty',
      'await_cart',
      'await_cart_edit',
      'await_cart_line',
      'await_address_pick',
      'await_address',
      'await_delivery',
    ].includes(session.state)
  ) {
    if (!(await guardSessionMealOpen(phone, session))) return;
  }

  // Cart actions (after adding an item, or typed CART)
  if (
    session.state === 'await_cart' ||
    session.state === 'await_cart_edit' ||
    session.state === 'await_cart_line' ||
    [
      'cart',
      'view cart',
      'cart_view',
      'cart_add',
      'cart_checkout',
      'cart_clear',
      'cart_edit',
      'edit',
      'edit cart',
      'checkout',
      'add more',
      'clear',
      'clear cart',
      'clear all',
      'edit_done',
      'edit_back',
      'setremove',
    ].includes(lower) ||
    lower.startsWith('editline_') ||
    lower.startsWith('setqty_')
  ) {
    // Line qty / remove
    if (session.state === 'await_cart_line') {
      if (lower === 'edit_back' || lower === 'back') {
        await sendCartEditList(phone, session);
        return;
      }
      if (lower === 'setremove' || lower === 'remove' || lower === '0') {
        await applyCartLineChange(phone, session, 'remove');
        return;
      }
      if (lower === 'setqty_type' || lower === 'type' || lower === 'other') {
        const dish = await db.getDish(session.edit_code);
        const cart = Array.isArray(session.cart) ? session.cart : [];
        const maxQ = maxQtyForCartLine(
          dish || { max_portions: 30, portions_sold: 0, code: session.edit_code },
          cart,
          session.edit_code,
        );
        await sendText(
          phone,
          `Type a quantity from 1 to ${maxQ} for this line.\nOr type 0 to remove.`,
        );
        return;
      }
      const setm = lower.match(/^setqty_(\d+)$/) || lower.match(/^qty_(\d+)$/);
      if (setm || /^\d+$/.test(lower)) {
        const qty = setm ? Number(setm[1]) : Number(lower);
        await applyCartLineChange(phone, session, qty);
        return;
      }
      await sendText(phone, 'Pick a quantity from the list, type a number, or 0 to remove.');
      await sendCartLineEditor(phone, session, session.edit_code);
      return;
    }

    // Pick which line to edit
    if (session.state === 'await_cart_edit' || lower.startsWith('editline_')) {
      if (lower === 'edit_done' || lower === 'back' || lower === 'done') {
        await sendCartActions(phone, session);
        return;
      }
      const em = lower.match(/^editline_([a-z0-9_-]+)$/i);
      if (em) {
        await sendCartLineEditor(phone, session, em[1].toUpperCase());
        return;
      }
      // typed number 1..n for line
      if (/^\d+$/.test(lower)) {
        const cart = Array.isArray(session.cart) ? session.cart : [];
        const idx = Number(lower) - 1;
        if (idx >= 0 && idx < cart.length) {
          await sendCartLineEditor(phone, session, cart[idx].code);
          return;
        }
      }
      await sendCartEditList(phone, session);
      return;
    }

    if (lower === 'cart_clear' || lower === 'clear' || lower === 'clear cart' || lower === 'clear all') {
      if (session.meal) {
        await db.setSession(phone, { cart: [], state: 'await_category', dish_code: null, qty: null, edit_code: null });
        await sendText(phone, 'Cart cleared. Pick a category to start again.');
        await sendCategoryPicker(phone, session.meal);
      } else {
        await clearOrderingSession(db, phone);
        await sendMainMenu(phone);
      }
      return;
    }
    if (lower === 'cart_edit' || lower === 'edit' || lower === 'edit cart') {
      await sendCartEditList(phone, session);
      return;
    }
    if (lower === 'cart_add' || lower === 'add more' || lower === 'add' || lower === 'add items') {
      if (!session.meal) {
        await sendMainMenu(phone);
        return;
      }
      await db.setSession(phone, { state: 'await_category', dish_code: null, qty: null, edit_code: null });
      await sendCategoryPicker(phone, session.meal);
      return;
    }
    if (lower === 'cart_checkout' || lower === 'checkout') {
      await beginCheckout(phone, session);
      return;
    }
    if (
      session.state === 'await_cart' ||
      lower === 'cart' ||
      lower === 'view cart' ||
      lower === 'cart_view'
    ) {
      if (!(Array.isArray(session.cart) && session.cart.length) && lower === 'cart') {
        await sendText(phone, 'Cart is empty. Tap Lunch or Dinner to order.');
        return;
      }
      await sendCartActions(phone, session);
      return;
    }
  }

  if (session.state === 'await_category') {
    const cat = parseCategory(raw);
    if (!cat) {
      await sendText(phone, 'Please pick a category from the list (Veg, Non-veg, Meals, Combos, Extras).');
      await sendCategoryPicker(phone, session.meal);
      return;
    }
    await db.setSession(phone, { state: 'await_dish', category: cat });
    await sendDishList(phone, session.meal, cat);
    return;
  }

  if (session.state === 'await_dish') {
    const more = raw.match(/^more_([a-z]+)_(\d+)$/i);
    if (more) {
      await sendDishList(phone, session.meal, more[1].toLowerCase(), Number(more[2]));
      return;
    }
    const cat = parseCategory(raw);
    if (cat) {
      await db.setSession(phone, { category: cat });
      await sendDishList(phone, session.meal, cat);
      return;
    }
    await pickDish(phone, session, raw.toUpperCase());
    return;
  }

  if (session.state === 'await_qty') {
    const dish = await db.getDish(session.dish_code);
    const cart = Array.isArray(session.cart) ? session.cart : [];
    const left = remainingForDish(dish, cart);
    const max = Math.max(0, Math.min(Number(left) || 0, 30));

    // Customer tapped “Other qty” — stay in this state and ask for a number
    if (lower === 'qty_other' || lower === 'other' || lower === 'other qty') {
      await sendText(
        phone,
        `Type how many of ${dish ? formatDishLabel(dish) : 'this dish'} you want (1–${max}).\n` +
          `Do not type 0 — that does not add the dish. Type Cancel to skip.`,
      );
      return;
    }

    // Explicit cancel / skip
    if (['cancel', 'stop', 'skip', 'no'].includes(lower)) {
      await sendText(phone, 'OK — item not added.');
      await db.setSession(phone, { dish_code: null, qty: null, state: 'await_category' });
      if (session.meal) await sendCategoryPicker(phone, session.meal);
      else await sendMainMenu(phone);
      return;
    }

    const qtyRaw = lower.startsWith('qty_') ? lower.slice(4) : raw;
    const qty = Number(qtyRaw);

    // 0 / negative: do not add; re-ask
    if (Number.isInteger(qty) && qty === 0) {
      await sendText(
        phone,
        `Quantity cannot be 0 — this dish will not be added.\n` +
          `Type a number from 1 to ${max}, or type Cancel to pick something else.`,
      );
      if (dish && max >= 1) await sendQtyPrompt(phone, dish, left);
      return;
    }

    if (!dish || !Number.isInteger(qty) || qty < 1 || qty > max) {
      await sendText(
        phone,
        max < 1
          ? 'This item is sold out. Pick another.'
          : `Enter a whole number from 1 to ${max} (stock available).\n0 is not allowed.`,
      );
      if (dish && max >= 1) await sendQtyPrompt(phone, dish, left);
      return;
    }
    const nextCart = addToCart(cart, cartLineFromDish(dish, qty));
    const updated = { ...session, cart: nextCart, dish_code: null, qty: null };
    await db.setSession(phone, {
      cart: nextCart,
      dish_code: null,
      qty: null,
      state: 'await_cart',
    });
    await sendText(
      phone,
      `Added ${qty}x ${formatDishLabel(dish)} (${formatPaise(dish.price_paise * qty)}).`,
    );
    await sendCartActions(phone, updated);
    return;
  }

  if (session.state === 'await_address_pick') {
    if (lower === 'addr_new' || lower === 'new' || lower === 'కొత్త') {
      await db.setSession(phone, { state: 'await_address' });
      const minOrder = await minOrderPaiseForSession(session);
      await sendText(
        phone,
        copy.askAddressNewText(formatCartMessage(session.cart || [], { minOrderPaise: minOrder })),
      );
      return;
    }
    const m = lower.match(/^addr_(.+)$/);
    const cust = await db.getCustomer(phone);
    let hit = null;
    if (m) hit = (cust?.addresses || []).find((a) => String(a.id) === m[1]);
    if (!hit && /^\d+$/.test(lower)) {
      const sorted = (cust?.addresses || [])
        .slice()
        .sort((a, b) => String(b.last_used_at || '').localeCompare(String(a.last_used_at || '')));
      hit = sorted[Number(lower) - 1];
    }
    if (!hit) {
      await beginCheckout(phone, session);
      return;
    }
    await proceedWithAddress(phone, session, hit.text, hit.zone || null);
    return;
  }

  if (session.state === 'await_address') {
    await proceedWithAddress(phone, session, raw, null);
    return;
  }

  if (session.state === 'await_delivery') {
    if (lower === 'z_pick' || lower === 'change km') {
      await sendDeliveryPicker(phone, cartFoodPaise(session.cart));
      return;
    }
    const zone = ['z1', 'z2', 'z3'].includes(lower) ? lower : null;
    if (!zone) {
      await sendText(phone, 'Please tap a delivery distance (0–3 / 3–6 / 6+ km).');
      await sendDeliveryPicker(phone, cartFoodPaise(session.cart));
      return;
    }
    await finalizeOrder(phone, session, zone);
    return;
  }

  await sendMainMenu(phone);
}
