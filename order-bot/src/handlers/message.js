import { getDb } from '../db.js';
import { config } from '../config.js';
import { isDinnerOpen, isLunchOpen, mealStatusText } from '../cutoffs.js';
import { buildUpiPayUri, sendButtons, sendList, sendText, sendUpiQr } from '../whatsapp.js';
import { tryHandleAdmin } from './admin.js';
import { applyOrderStatus, paymentThanksMessage } from '../orders/status.js';
import { CATEGORIES, categoryLabel, deliveryFeePaise, DELIVERY_ZONES } from '../menu.js';

function formatPaise(paise) {
  return `₹${(paise / 100).toFixed(0)}`;
}

function welcomeBody() {
  return (
    `Welcome to ${config.businessName}\n` +
    `Tenali homely Andhra food — freshly cooked daily.\n\n` +
    `${mealStatusText()}\n\n` +
    `Min order ${formatPaise(config.minOrderPaise)} · Free delivery above ${formatPaise(config.freeDeliveryAbovePaise)}\n` +
    `Delivery: Tenali local (charges by distance).\n\n` +
    `Tap Lunch / Dinner to order, or Status for your last order.`
  );
}

async function sendMainMenu(phone) {
  await sendButtons(phone, welcomeBody(), [
    { id: 'lunch', title: 'Lunch' },
    { id: 'dinner', title: 'Dinner' },
    { id: 'status', title: 'My status' },
  ], { footer: 'Type Menu or Cancel anytime' });
}

async function sendCategoryPicker(phone, meal) {
  await sendList(phone, {
    header: meal === 'lunch' ? 'Lunch menu' : 'Dinner menu',
    body:
      `${config.businessName} — choose a category\n` +
      `${mealStatusText()}\n\n` +
      `Portions are for 1 person. Homely Andhra style.`,
    button: 'Categories',
    footer: 'Or type VEG / NONVEG / MEALS / COMBOS / EXTRAS',
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
  const dishes = getDb().listDishes(meal, category);
  if (!dishes.length) {
    await sendText(phone, `No ${categoryLabel(category)} items available right now.`);
    await sendCategoryPicker(phone, meal);
    return;
  }

  // WhatsApp list max 10 rows — paginate with a "More" row when needed
  const pageSize = 9;
  const start = page * pageSize;
  const slice = dishes.slice(start, start + pageSize);
  const hasMore = start + pageSize < dishes.length;

  const rows = slice.map((d) => {
    const left = Math.max(0, d.max_portions - d.portions_sold);
    const soldOut = left <= 0;
    const desc = [
      formatPaise(d.price_paise),
      soldOut ? 'Sold out' : `${left} left`,
      d.advance_only ? 'Advance' : null,
      d.note || null,
    ]
      .filter(Boolean)
      .join(' · ')
      .slice(0, 72);
    return {
      id: d.code,
      title: d.name.slice(0, 24),
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
      `\nSelect an item (or type its code, e.g. ${dishes[0].code}).`,
    button: 'Choose item',
    footer: 'Type BACK for categories',
    sections: [{ title: 'Available', rows }],
  });
}

async function sendQtyPrompt(phone, dish, left) {
  const max = Math.min(5, left);
  const buttons = [];
  for (let n = 1; n <= Math.min(3, max); n++) {
    buttons.push({ id: `qty_${n}`, title: String(n) });
  }
  const body =
    `How many of ${dish.name}?\n` +
    `${formatPaise(dish.price_paise)} each · 1–${max} available` +
    (dish.note ? `\n(${dish.note})` : '') +
    (dish.advance_only ? `\nNote: advance order item — we will confirm availability.` : '');

  if (buttons.length) await sendButtons(phone, body, buttons, { footer: 'Or type Cancel' });
  else await sendText(phone, body);
}

async function sendDeliveryPicker(phone, foodPaise) {
  if (foodPaise >= config.freeDeliveryAbovePaise) {
    return false;
  }
  await sendButtons(
    phone,
    `Food total: ${formatPaise(foodPaise)}\n\n` +
      `Delivery (Tenali):\n` +
      `• 0–3 km — ₹30\n` +
      `• 3–6 km — ₹45\n` +
      `• Above 6 km — ₹60\n` +
      `Free delivery on food above ${formatPaise(config.freeDeliveryAbovePaise)}.\n\n` +
      `How far is your address?`,
    [
      { id: 'z1', title: '0–3 km' },
      { id: 'z2', title: '3–6 km' },
      { id: 'z3', title: 'Above 6 km' },
    ],
  );
  return true;
}

function nextOrderRef(meal) {
  const prefix = meal === 'lunch' ? 'L' : 'D';
  return `${prefix}${Date.now().toString().slice(-6)}`;
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

async function startMeal(phone, meal) {
  const open = meal === 'lunch' ? isLunchOpen() : isDinnerOpen();
  if (!open) {
    if (meal === 'lunch') {
      await sendText(
        phone,
        `Lunch ordering is closed for today.\n` +
          (isDinnerOpen() ? 'Dinner is still open — tap Dinner.' : 'Both meals closed. Try tomorrow.'),
      );
      if (isDinnerOpen()) await sendMainMenu(phone);
      return;
    }
    await sendText(phone, 'Dinner ordering is closed for today. Reply Menu tomorrow for lunch.');
    return;
  }

  getDb().setSession(phone, {
    state: 'await_category',
    meal,
    category: null,
    dish_code: null,
    qty: null,
    address: null,
    delivery_zone: null,
  });
  await sendCategoryPicker(phone, meal);
}

async function pickDish(phone, session, code) {
  const db = getDb();
  const dish = db.getDish(code);
  if (!dish || !dish.active) {
    await sendText(phone, 'Unknown or unavailable item. Pick from the list or type BACK.');
    if (session.category) await sendDishList(phone, session.meal, session.category);
    else await sendCategoryPicker(phone, session.meal);
    return;
  }
  if (session.meal && dish.meal !== 'both' && dish.meal !== session.meal) {
    await sendText(phone, `${dish.name} is not available for ${session.meal}.`);
    return;
  }
  const left = dish.max_portions - dish.portions_sold;
  if (left <= 0) {
    await sendText(phone, `${dish.name} is sold out. Pick another item.`);
    await sendDishList(phone, session.meal, dish.category);
    return;
  }
  db.setSession(phone, {
    state: 'await_qty',
    category: dish.category,
    dish_code: dish.code,
  });
  await sendQtyPrompt(phone, dish, left);
}

async function finalizeOrder(phone, session, deliveryZone) {
  const db = getDb();
  const dish = db.getDish(session.dish_code);
  if (!dish) {
    await sendText(phone, 'Order expired. Please start again with Lunch or Dinner.');
    db.setSession(phone, { state: 'idle' });
    return;
  }

  const foodPaise = dish.price_paise * session.qty;
  if (foodPaise < config.minOrderPaise) {
    await sendText(
      phone,
      `Minimum order is ${formatPaise(config.minOrderPaise)} (food only).\n` +
        `Your selection is ${formatPaise(foodPaise)}. Add a meal/combo or more portions.\n` +
        `Type Menu to continue.`,
    );
    db.setSession(phone, { state: 'idle', dish_code: null, qty: null, address: null });
    await sendMainMenu(phone);
    return;
  }

  const fee = deliveryFeePaise(deliveryZone, foodPaise);
  const total = foodPaise + fee;
  const orderRef = nextOrderRef(session.meal);
  const zone = DELIVERY_ZONES.find((z) => z.id === deliveryZone);

  db.upsertCustomer(phone, session.address);
  db.createOrder({
    order_ref: orderRef,
    phone,
    meal: session.meal,
    dish_code: dish.code,
    dish_name: dish.name,
    category: dish.category,
    qty: session.qty,
    unit_price_paise: dish.price_paise,
    food_paise: foodPaise,
    delivery_zone: deliveryZone,
    delivery_fee_paise: fee,
    total_paise: total,
    address: session.address,
    status: 'pending_payment',
    source: 'whatsapp',
  });

  db.setSession(phone, {
    state: 'idle',
    meal: null,
    category: null,
    dish_code: null,
    qty: null,
    address: null,
    delivery_zone: null,
  });

  await sendOrderPayment(phone, {
    orderRef,
    qty: session.qty,
    dishName: dish.name,
    foodPaise,
    deliveryFeePaise: fee,
    deliveryLabel: fee === 0 ? 'FREE' : zone?.title || deliveryZone,
    totalPaise: total,
    address: session.address,
  });
}

async function sendOrderPayment(phone, {
  orderRef,
  qty,
  dishName,
  foodPaise,
  deliveryFeePaise: fee,
  deliveryLabel,
  totalPaise,
  address,
}) {
  const amountRupees = totalPaise / 100;
  const upiUri = buildUpiPayUri({ amountRupees, orderRef });

  await sendButtons(
    phone,
    `Order ${orderRef} noted\n` +
      `${qty}x ${dishName}\n` +
      `Food: ${formatPaise(foodPaise)}\n` +
      `Delivery (${deliveryLabel}): ${formatPaise(fee)}\n` +
      `Total: ${formatPaise(totalPaise)}\n` +
      `Address: ${address}\n\n` +
      `Pay via UPI:\n` +
      `UPI ID: ${config.upiId}\n` +
      `Name: ${config.upiPayeeName}\n` +
      `Amount: ${formatPaise(totalPaise)}\n` +
      `Note: ${orderRef}\n\n` +
      `Scan the QR next. After paying, reply PAID ${orderRef}`,
    [
      { id: 'status', title: 'My status' },
      { id: 'lunch', title: 'Order lunch' },
      { id: 'dinner', title: 'Order dinner' },
    ],
  );

  try {
    await sendUpiQr(
      phone,
      `Scan & pay ${formatPaise(totalPaise)} for order ${orderRef}\nUPI: ${config.upiId}`,
    );
  } catch (err) {
    console.error('UPI QR send failed', err);
    await sendText(
      phone,
      `Could not send QR image.\nPay ${formatPaise(totalPaise)} to ${config.upiId}\nOrder: ${orderRef}\n\n${upiUri}`,
    );
  }
}

async function sendStatus(phone) {
  const order = getDb().findLatestOrder(phone);
  if (!order) {
    await sendText(phone, 'No orders found yet. Tap Lunch or Dinner to start.');
    await sendMainMenu(phone);
    return;
  }
  const fee = order.delivery_fee_paise ?? 0;
  await sendText(
    phone,
    `Your latest order ${order.order_ref}\n` +
      `Status: ${order.status}\n` +
      `${order.qty}x ${order.dish_name}\n` +
      `Food: ${formatPaise(order.food_paise ?? order.total_paise - fee)}\n` +
      `Delivery: ${formatPaise(fee)}\n` +
      `Total: ${formatPaise(order.total_paise)}\n` +
      `Address: ${order.address}\n` +
      `Meal: ${order.meal}`,
  );
}

export async function handleIncoming({ from, text }) {
  const phone = String(from).replace(/\D/g, '');
  const raw = String(text || '').trim();
  const lower = raw.toLowerCase();
  const db = getDb();
  const session = db.getSession(phone);

  if (await tryHandleAdmin({ from: phone, text: raw })) return;

  if (['hi', 'hello', 'hii', 'hey', 'start', 'help'].includes(lower)) {
    db.setSession(phone, { state: 'idle', meal: null, category: null, dish_code: null, qty: null });
    await sendMainMenu(phone);
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
      ? db.findOrderByRef(refFromMsg)
      : db.findLatestPendingOrder(phone);

    if (refFromMsg && order && order.phone !== phone) {
      await sendText(phone, 'That order ID does not belong to this WhatsApp number.');
      return;
    }
    if (!order) {
      await sendText(
        phone,
        refFromMsg
          ? `Order ${refFromMsg.toUpperCase()} not found. Try PAID L123456.`
          : 'No pending payment order found. Reply PAID with your order ID.',
      );
      return;
    }
    if (order.status === 'paid') {
      await sendText(phone, `Already marked paid.\n\n${paymentThanksMessage(order)}`);
      return;
    }
    const result = await applyOrderStatus(order.order_ref, 'paid', { notifyCustomer: true });
    if (!result.ok) await sendText(phone, result.error || 'Could not update payment.');
    return;
  }

  if (lower === 'cancel' || lower === 'stop') {
    db.setSession(phone, { state: 'idle', meal: null, category: null, dish_code: null, qty: null });
    await sendButtons(phone, 'Order cancelled. What next?', [
      { id: 'lunch', title: 'Lunch' },
      { id: 'dinner', title: 'Dinner' },
      { id: 'status', title: 'My status' },
    ]);
    return;
  }

  if (lower === 'menu') {
    await sendText(
      phone,
      `${welcomeBody()}\n\n` +
        `Categories: Veg · Non-veg · Rice & meals · Combos · Extras\n` +
        `Popular first orders: Veg Combo (C01) · Egg Combo (C02) · Chicken Combo (C03)`,
    );
    await sendMainMenu(phone);
    return;
  }

  if (lower === 'lunch') {
    await startMeal(phone, 'lunch');
    return;
  }

  if (lower === 'dinner') {
    await startMeal(phone, 'dinner');
    return;
  }

  if (lower === 'back' && (session.state === 'await_dish' || session.state === 'await_category')) {
    db.setSession(phone, { state: 'await_category', category: null, dish_code: null });
    await sendCategoryPicker(phone, session.meal || 'lunch');
    return;
  }

  if (session.state === 'await_category') {
    const cat = parseCategory(raw);
    if (!cat) {
      await sendText(phone, 'Please pick a category from the list (Veg, Non-veg, Meals, Combos, Extras).');
      await sendCategoryPicker(phone, session.meal);
      return;
    }
    db.setSession(phone, { state: 'await_dish', category: cat });
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
      db.setSession(phone, { category: cat });
      await sendDishList(phone, session.meal, cat);
      return;
    }
    await pickDish(phone, session, raw.toUpperCase());
    return;
  }

  if (session.state === 'await_qty') {
    const qtyRaw = lower.startsWith('qty_') ? lower.slice(4) : raw;
    const qty = Number(qtyRaw);
    const dish = db.getDish(session.dish_code);
    const left = dish ? dish.max_portions - dish.portions_sold : 0;
    if (!Number.isInteger(qty) || qty < 1 || qty > Math.min(5, left)) {
      await sendText(phone, `Enter a number from 1 to ${Math.min(5, left)}.`);
      if (dish) await sendQtyPrompt(phone, dish, left);
      return;
    }
    db.setSession(phone, { state: 'await_address', qty });
    await sendText(
      phone,
      `Got it — ${qty}x ${dish.name} (${formatPaise(dish.price_paise * qty)}).\n\n` +
        `Type your Tenali delivery address (area / landmark / door no).\n\n` +
        `To stop, type Cancel.`,
    );
    return;
  }

  if (session.state === 'await_address') {
    const address = raw;
    if (address.length < 8) {
      await sendText(phone, 'Please send a fuller address (area + landmark).');
      return;
    }
    const dish = db.getDish(session.dish_code);
    const foodPaise = dish.price_paise * session.qty;
    db.setSession(phone, { state: 'await_delivery', address });

    if (foodPaise >= config.freeDeliveryAbovePaise) {
      await finalizeOrder(phone, { ...session, address }, 'z1');
      return;
    }
    await sendDeliveryPicker(phone, foodPaise);
    return;
  }

  if (session.state === 'await_delivery') {
    const zone = ['z1', 'z2', 'z3'].includes(lower) ? lower : null;
    if (!zone) {
      await sendText(phone, 'Please tap a delivery distance button (0–3 / 3–6 / Above 6 km).');
      const dish = db.getDish(session.dish_code);
      await sendDeliveryPicker(phone, dish.price_paise * session.qty);
      return;
    }
    await finalizeOrder(phone, session, zone);
    return;
  }

  await sendMainMenu(phone);
}
