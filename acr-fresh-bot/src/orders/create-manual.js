/**
 * Admin / offline Fresh order create — same shape as WhatsApp finalizeOrder.
 */
import { getDb } from '../db.js';
import {
  DELIVERY_ZONES,
  dishCustomerName,
  dishHasKgPacks,
  formatKgPack,
  packLineCode,
  packPricePaise,
} from '../menu.js';
import { applyOffers, applyWalletCredit } from '../offers.js';
import { captureReferral, referralWelcomeFor, walletUseFor } from '../referrals.js';
import { applyOrderStatus } from './status.js';
import {
  MAX_LINE_QTY,
  addToCart,
  cartFoodPaise,
  cartLineFromDish,
  cartTotalQty,
  dishSummaryName,
  formatLinesText,
  formatPaise,
} from './cart.js';
import {
  dayFromIso,
  mealTitle,
  nowIst,
  parseSlotId,
  planSlotCandidates,
  slotId,
  slotLabel,
} from '../cutoffs.js';
import { notifyAdmins, formatUnpaidOrderAlert, sendOrderToRiders } from '../ops-notify.js';
import { sendText } from '../whatsapp.js';
import { config } from '../config.js';

function normalizePhone(raw) {
  let p = String(raw || '').replace(/\D/g, '');
  if (p.length === 10) p = `91${p}`;
  return p;
}

function zoneOk(id) {
  return DELIVERY_ZONES.some((z) => z.id === id) || id === 'flat';
}

export function formatOfflineCustomerOrderMessage(order) {
  const lines = formatLinesText(order.items || [], { withPrices: true });
  const due = Number(order.cod_due_paise) || 0;
  const slot = order.delivery_slot || order.meta?.delivery_slot || '';
  const parsed = parseSlotId(slot);
  const slotTxt = parsed
    ? `${parsed.isoDate} · ${slotLabel(parsed.hour)}`
    : order.service_label || order.service_date || '';
  const pay =
    due > 0
      ? `💵 Pay on delivery ${formatPaise(due)}` +
        (Number(order.prepaid_paise) > 0
          ? ` (already paid ${formatPaise(order.prepaid_paise)})`
          : '')
      : order.status === 'pending_payment'
        ? `💳 Amount due ${formatPaise(order.total_paise)}`
        : `✅ Paid · Total ${formatPaise(order.total_paise)}`;
  return (
    `Order ${order.order_ref} · ${mealTitle('fresh')}\n` +
    `${slotTxt}\n` +
    `${lines}\n` +
    `Items ${formatPaise(order.food_paise || 0)}` +
    (Number(order.discount_paise) > 0 ? ` · −${formatPaise(order.discount_paise)}` : '') +
    ` · Del ${formatPaise(order.delivery_fee_paise || 0)}\n` +
    `Total ${formatPaise(order.total_paise)}\n` +
    `${pay}\n` +
    `Delivery: ${order.address || '—'}\n` +
    `— ${config.businessName}`
  );
}

async function buildFreshLine(db, row) {
  const code = String(row.code || row.dish_code || row.base_code || '')
    .toUpperCase()
    .trim();
  const qty = Math.round(Number(row.qty) || 0);
  if (!code || qty < 1) return { error: 'Invalid item' };
  if (qty > MAX_LINE_QTY) return { error: `Max ${MAX_LINE_QTY} of ${code}` };

  let dish = await db.getDish(code);
  let packKg = row.pack_kg != null ? Number(row.pack_kg) : null;
  const packMatch = code.match(/^([A-Z0-9]+)-(\d+)$/i);
  if (!dish && packMatch) {
    dish = await db.getDish(packMatch[1]);
    packKg = Number(packMatch[2]) / 1000;
  }
  if (!dish || dish.active === false) {
    return { error: `Item ${code} not found or inactive` };
  }

  if (dishHasKgPacks(dish)) {
    if (packKg == null || !Number.isFinite(packKg) || packKg <= 0) {
      return {
        error: `${dish.code} needs pack_kg (e.g. ${dish.sizes_kg.join(', ')})`,
      };
    }
    const allowed = dish.sizes_kg.map(Number);
    if (!allowed.some((s) => Math.abs(s - packKg) < 1e-9)) {
      return {
        error: `${dish.code} pack_kg must be one of ${allowed.join(', ')}`,
      };
    }
    const lineCode = packLineCode(dish.code, packKg);
    return {
      line: {
        code: lineCode,
        name: `${dishCustomerName(dish)} (${formatKgPack(packKg)})`,
        base_name: dish.name,
        qty,
        unit_price_paise: packPricePaise(dish.price_paise, packKg),
        category: dish.category || null,
        cook_name: dish.cook_name || null,
        amma_id: dish.amma_id || null,
        pack_kg: packKg,
        base_code: dish.code,
      },
    };
  }

  return { line: cartLineFromDish(dish, qty) };
}

export async function createManualOrder(body = {}) {
  const db = getDb();
  const phone = normalizePhone(body.phone);
  if (phone.length < 12) return { ok: false, error: 'Valid customer phone required (10 digits)' };

  let deliverySlot = String(body.delivery_slot || '').trim();
  if (!deliverySlot && body.service_date && body.slot_hour != null) {
    deliverySlot = slotId(String(body.service_date).slice(0, 10), body.slot_hour);
  }
  const parsed = parseSlotId(deliverySlot);
  if (!parsed) {
    return { ok: false, error: 'delivery_slot required (YYYY-MM-DDTHH) or service_date + slot_hour' };
  }
  const serviceDate = parsed.isoDate;
  const serviceDay = dayFromIso(serviceDate);
  const serviceLabel =
    String(body.service_label || '').trim() ||
    `${serviceDay.dayDateLabel} · ${slotLabel(parsed.hour)}`;

  let deliveryZone = String(body.delivery_zone || 'z1').toLowerCase().trim();
  if (!zoneOk(deliveryZone)) {
    return { ok: false, error: 'delivery_zone must be z1, z2, z3, or flat' };
  }

  const address = String(body.address || '').trim();
  if (address.length < 5) return { ok: false, error: 'Delivery address required' };

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (!rawItems.length) return { ok: false, error: 'Add at least one item' };

  let cart = [];
  for (const row of rawItems) {
    const built = await buildFreshLine(db, row);
    if (built.error) return { ok: false, error: built.error };
    cart = addToCart(cart, built.line);
    // addToCart drops pack_kg — restore for order items
    if (built.line.pack_kg != null) {
      const hit = cart.find((c) => String(c.code).toUpperCase() === String(built.line.code).toUpperCase());
      if (hit) {
        hit.pack_kg = built.line.pack_kg;
        hit.base_code = built.line.base_code;
        hit.unit_price_paise = built.line.unit_price_paise;
        hit.name = built.line.name;
      }
    }
  }
  if (!cart.length) return { ok: false, error: 'No valid items' };

  const foodPaise = cartFoodPaise(cart);
  const skipMin = body.skip_min_order === true;
  if (!skipMin) {
    const minOrder = Number(await db.getMinOrderPaise(serviceDate)) || 0;
    if (minOrder > 0 && foodPaise < minOrder) {
      return {
        ok: false,
        error: `Items ${formatPaise(foodPaise)} below min ${formatPaise(minOrder)} (set skip_min_order to bypass)`,
      };
    }
  }

  const offers = body.apply_offers === false ? [] : await db.listOffers();
  const deliverySettings = await db.getDeliverySettings();
  const referral = await applyReferralCode(phone, body);
  const referralWelcome = body.apply_offers === false ? null : await referralWelcomeFor(phone);
  let pricing = applyOffers({
    foodPaise,
    zoneId: deliveryZone,
    offers,
    deliverySettings,
    dayIso: serviceDate,
    referralWelcome,
  });

  if (body.delivery_fee_paise != null && body.delivery_fee_paise !== '') {
    const fee = Math.max(0, Math.round(Number(body.delivery_fee_paise)));
    pricing = {
      ...pricing,
      delivery_fee_paise: fee,
      total_paise: Math.max(0, foodPaise - (pricing.discount_paise || 0) + fee),
      free_delivery: fee === 0,
    };
  }
  if (body.discount_paise != null && body.discount_paise !== '') {
    const disc = Math.max(0, Math.round(Number(body.discount_paise)));
    pricing = {
      ...pricing,
      discount_paise: disc,
      total_paise: Math.max(0, foodPaise - disc + (pricing.delivery_fee_paise || 0)),
    };
  }
  if (body.use_wallet === true) {
    pricing = applyWalletCredit(pricing, await walletUseFor(phone, pricing));
  }

  const fee = pricing.delivery_fee_paise;
  const total = pricing.total_paise;
  const discount = pricing.discount_paise;
  const storeZone = pricing.zone_id || deliveryZone;
  const orderRef = await db.nextOrderRef('fresh', serviceDate);
  const primary = cart[0];
  const items = cart.map((i) => ({
    code: i.code,
    name: i.name,
    base_name: i.base_name || null,
    qty: i.qty,
    unit_price_paise: i.unit_price_paise,
    line_paise: (Number(i.unit_price_paise) || 0) * (Number(i.qty) || 0),
    category: i.category,
    cook_name: i.cook_name || null,
    amma_id: i.amma_id || null,
    ...(i.pack_kg != null ? { pack_kg: i.pack_kg } : {}),
    ...(i.base_code ? { base_code: i.base_code } : {}),
  }));

  const customerName = String(body.customer_name || '').trim() || null;
  if (customerName) {
    try {
      await db.setCustomerName(phone, customerName);
    } catch {
      /* ignore */
    }
  }
  const cust = await db.getCustomer(phone);
  try {
    const pinLat = body.lat != null ? Number(body.lat) : null;
    const pinLng = body.lng != null ? Number(body.lng) : null;
    await db.saveCustomerAddress(phone, {
      text: address,
      zone: storeZone === 'flat' ? undefined : storeZone,
      lat: Number.isFinite(pinLat) ? pinLat : undefined,
      lng: Number.isFinite(pinLng) ? pinLng : undefined,
      location_name: body.location_name ? String(body.location_name).slice(0, 80) : undefined,
    });
  } catch {
    /* ignore */
  }
  await db.noteCustomerOrder(phone);

  const payment = String(body.payment || 'unpaid').toLowerCase();
  const pinLat = body.lat != null ? Number(body.lat) : null;
  const pinLng = body.lng != null ? Number(body.lng) : null;
  const viaWeb = body.created_via === 'web_storefront' || body.source === 'web';
  const meta = {
    discount_paise: discount,
    free_delivery: pricing.free_delivery,
    offers_applied: pricing.applied,
    delivery_mode: pricing.delivery_mode,
    delivery_settings_source: pricing.delivery_settings_source,
    delivery_slot: deliverySlot,
    created_via: viaWeb ? 'web_storefront' : 'admin_manual',
    offline: !viaWeb,
    ...(pricing.applied?.some((a) => a.id === 'referral_welcome')
      ? { referral_code: referralWelcome.code }
      : {}),
    ...(pricing.wallet_paise > 0 ? { wallet_paise: pricing.wallet_paise } : {}),
    ...(Number.isFinite(pinLat) ? { delivery_lat: pinLat } : {}),
    ...(Number.isFinite(pinLng) ? { delivery_lng: pinLng } : {}),
  };

  await db.createOrder({
    order_ref: orderRef,
    phone,
    customer_name: customerName || cust?.name || null,
    meal: 'fresh',
    service_date: serviceDate,
    service_label: serviceLabel,
    delivery_slot: deliverySlot,
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
    address,
    status: 'pending_payment',
    source: viaWeb ? 'web' : 'admin',
    meta,
  });

  let order = await db.findOrderByRef(orderRef);
  const notifies = { customer: false, ops: false, riders: false, errors: [] };

  if (payment === 'cod') {
    const due =
      body.cod_due_paise != null
        ? Math.max(0, Math.round(Number(body.cod_due_paise)))
        : total;
    const prepaid = Math.max(0, total - due);
    const result = await applyOrderStatus(orderRef, 'paid', {
      notifyCustomer: body.notify_customer === true,
      notifyOps: body.notify_ops !== false,
      extra: {
        paid_via: 'cod_pending',
        payment_method: 'cod',
        cod_due_paise: due,
        prepaid_paise: prepaid,
        cod_allowed_at: new Date().toISOString(),
        cod_allowed_by: viaWeb ? 'web_storefront' : 'admin_manual',
      },
    });
    if (!result.ok) return { ok: false, error: result.error || 'COD mark paid failed' };
    order = result.order;
    if (body.notify_ops !== false) notifies.ops = true;
    if (body.notify_customer === true) notifies.customer = true;
  } else if (payment === 'prepaid' || payment === 'paid') {
    const result = await applyOrderStatus(orderRef, 'paid', {
      notifyCustomer: false,
      notifyOps: body.notify_ops !== false,
      extra: { paid_via: 'admin', payment_method: 'prepaid' },
    });
    if (!result.ok) return { ok: false, error: result.error || 'Mark paid failed' };
    order = result.order;
    if (body.notify_ops !== false) notifies.ops = true;
  } else if (body.notify_ops !== false) {
    // Do not block checkout / pay redirect on WhatsApp Graph latency.
    notifies.ops = true;
    const alert = formatUnpaidOrderAlert(order);
    void notifyAdmins(alert).catch((err) => {
      console.error('[createManualOrder] ops notify', err?.message || err);
    });
  }

  const customerMessage = formatOfflineCustomerOrderMessage(order);

  // COD / prepaid already notified via applyOrderStatus when notify_customer was true.
  if (body.notify_customer === true && payment !== 'cod' && payment !== 'prepaid' && payment !== 'paid') {
    try {
      await sendText(phone, customerMessage);
      notifies.customer = true;
    } catch (err) {
      notifies.errors.push(err.message || 'customer WhatsApp failed');
    }
  }

  if (body.send_to_riders === true) {
    try {
      await sendOrderToRiders(order);
      notifies.riders = true;
    } catch (err) {
      notifies.errors.push(err.message || 'rider WhatsApp failed');
    }
  }

  return {
    ok: true,
    order,
    customer_message: customerMessage,
    notifies,
    slot_options_hint: planSlotCandidates({ daysAhead: 2 }).slice(0, 8).map((s) => s.id),
    ...(referral ? { referral } : {}),
  };
}

/** Optional `referral_code` on admin / web orders — same capture rules as WhatsApp. */
async function applyReferralCode(phone, body) {
  const code = String(body.referral_code || '').trim().toUpperCase();
  if (!code) return null;
  try {
    return await captureReferral({
      phone,
      code,
      source: body.source === 'web' ? 'web' : 'admin',
    });
  } catch (err) {
    console.error('[referrals] manual capture failed', err.message || err);
    return null;
  }
}
