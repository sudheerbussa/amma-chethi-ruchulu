/**
 * Admin / offline order create — same createOrder shape as WhatsApp finalizeOrder.
 */
import { getDb } from '../db.js';
import { DELIVERY_ZONES } from '../menu.js';
import { applyOffers, applyWalletCredit } from '../offers.js';
import { captureReferral, referralWelcomeFor, walletUseFor } from '../referrals.js';
import { applyPickupPricing } from './fulfillment-pay.js';
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
import { dayFromIso, mealTitle, nowIst } from '../cutoffs.js';
import {
  parseSlotId,
  serviceLabelWithSlot,
  slotId,
} from '../slots.js';
import { notifyAdmins, formatUnpaidOrderAlert, sendOrderToRiders } from '../ops-notify.js';
import { sendText } from '../whatsapp.js';
import { config } from '../config.js';

function normalizePhone(raw) {
  let p = String(raw || '').replace(/\D/g, '');
  if (p.length === 10) p = `91${p}`;
  return p;
}

function zoneOk(id) {
  return DELIVERY_ZONES.some((z) => z.id === id) || id === 'pickup' || id === 'flat';
}

/** Draft WhatsApp text for offline / phone-order customers. */
export function formatOfflineCustomerOrderMessage(order) {
  const pickup = String(order.fulfillment_type || '').toLowerCase() === 'pickup';
  const lines = formatLinesText(order.items || []);
  const due = Number(order.cod_due_paise) || 0;
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
    `Order ${order.order_ref} · ${mealTitle(order.meal)}\n` +
    `${order.service_label || order.service_date || ''}\n` +
    `${lines}\n` +
    `Food ${formatPaise(order.food_paise || 0)}` +
    (Number(order.discount_paise) > 0 ? ` · −${formatPaise(order.discount_paise)}` : '') +
    ` · Del ${formatPaise(order.delivery_fee_paise || 0)}\n` +
    `Total ${formatPaise(order.total_paise)}\n` +
    `${pay}\n` +
    `${pickup ? 'Pickup' : 'Delivery'}: ${order.address || '—'}\n` +
    `— ${config.businessName}`
  );
}

/**
 * @param {object} body
 * @returns {Promise<{ ok: true, order, customer_message, rider_message?, notifies } | { ok: false, error }>}
 */
export async function createManualOrder(body = {}) {
  const db = getDb();
  const phone = normalizePhone(body.phone);
  if (phone.length < 12) return { ok: false, error: 'Valid customer phone required (10 digits)' };

  const meal = body.meal === 'dinner' ? 'dinner' : body.meal === 'lunch' ? 'lunch' : null;
  if (!meal) return { ok: false, error: 'meal must be lunch or dinner' };

  const serviceDate = String(body.service_date || nowIst().isoDate).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
    return { ok: false, error: 'service_date must be YYYY-MM-DD' };
  }
  const serviceDay = dayFromIso(serviceDate);
  let deliverySlot = String(body.delivery_slot || '').trim() || null;
  if (!deliverySlot && body.slot_time != null) {
    // Accept "12:30" / "1230" / 12.5 hour
    const t = String(body.slot_time).trim();
    const hm = t.match(/^(\d{1,2}):(\d{2})$/) || t.match(/^(\d{2})(\d{2})$/);
    if (hm) {
      deliverySlot = slotId(serviceDate, Number(hm[1]) * 60 + Number(hm[2]));
    }
  }
  if (deliverySlot && !parseSlotId(deliverySlot)) {
    return { ok: false, error: 'delivery_slot must look like YYYY-MM-DDTHHMM (e.g. 2026-09-12T1230)' };
  }
  const serviceLabel =
    String(body.service_label || '').trim() ||
    (deliverySlot
      ? serviceLabelWithSlot(serviceDay, deliverySlot)
      : serviceDay.dayDateLabel);

  const fulfillmentType =
    String(body.fulfillment_type || '').toLowerCase() === 'pickup' ? 'pickup' : 'delivery';
  let deliveryZone = String(body.delivery_zone || (fulfillmentType === 'pickup' ? 'pickup' : 'z1'))
    .toLowerCase()
    .trim();
  if (fulfillmentType === 'pickup') deliveryZone = 'pickup';
  if (!zoneOk(deliveryZone)) {
    return { ok: false, error: 'delivery_zone must be z1, z2, z3, flat, or pickup' };
  }

  const address =
    fulfillmentType === 'pickup'
      ? String(body.address || '').trim() || 'Pickup at kitchen (Tenali)'
      : String(body.address || '').trim();
  if (fulfillmentType === 'delivery' && address.length < 5) {
    return { ok: false, error: 'Delivery address required' };
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (!rawItems.length) return { ok: false, error: 'Add at least one item' };

  let cart = [];
  for (const row of rawItems) {
    const code = String(row.code || row.dish_code || '').toUpperCase().trim();
    const qty = Math.round(Number(row.qty) || 0);
    if (!code || qty < 1) continue;
    if (qty > MAX_LINE_QTY) {
      return { ok: false, error: `Max ${MAX_LINE_QTY} of ${code} per order` };
    }
    const dish = await db.getDish(code);
    if (!dish || dish.active === false) {
      return { ok: false, error: `Dish ${code} not found or inactive` };
    }
    cart = addToCart(cart, cartLineFromDish(dish, qty));
  }
  if (!cart.length) return { ok: false, error: 'No valid items' };

  const foodPaise = cartFoodPaise(cart);
  const skipMin = body.skip_min_order === true;
  if (!skipMin) {
    const minOrder = Number(await db.getMinOrderPaise(serviceDate)) || 0;
    if (minOrder > 0 && foodPaise < minOrder) {
      return {
        ok: false,
        error: `Food total ${formatPaise(foodPaise)} below min ${formatPaise(minOrder)} (set skip_min_order to bypass)`,
      };
    }
  }

  const offers = body.apply_offers === false ? [] : await db.listOffers();
  const deliverySettings = await db.getDeliverySettings();
  let isFirstOrderCustomer = true;
  try {
    const cust0 = await db.getCustomer(phone);
    isFirstOrderCustomer = !(cust0 && (Number(cust0.order_count) || 0) > 0);
  } catch {
    /* ignore */
  }
  const pickup = fulfillmentType === 'pickup';
  const referral = await applyReferralCode(phone, body);
  const referralWelcome = body.apply_offers === false ? null : await referralWelcomeFor(phone);
  let pricing = applyOffers({
    foodPaise,
    zoneId: pickup ? 'z1' : deliveryZone,
    offers,
    deliverySettings,
    dayIso: serviceDate,
    cart,
    isFirstOrderCustomer,
    referralWelcome,
  });
  if (pickup) pricing = applyPickupPricing(pricing, foodPaise);

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
  const storeZone = pickup ? 'pickup' : pricing.zone_id || deliveryZone;
  const orderRef = await db.nextOrderRef(meal, serviceDate);
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

  const customerName = String(body.customer_name || '').trim() || null;
  if (customerName) {
    try {
      await db.setCustomerName(phone, customerName);
    } catch {
      /* ignore */
    }
  }
  const cust = await db.getCustomer(phone);

  if (!pickup) {
    try {
      const lat = body.lat != null ? Number(body.lat) : null;
      const lng = body.lng != null ? Number(body.lng) : null;
      await db.saveCustomerAddress(phone, {
        text: address,
        zone: storeZone === 'flat' ? undefined : storeZone,
        lat: Number.isFinite(lat) ? lat : undefined,
        lng: Number.isFinite(lng) ? lng : undefined,
        location_name: body.location_name ? String(body.location_name).slice(0, 80) : undefined,
      });
    } catch {
      /* ignore */
    }
  }
  await db.noteCustomerOrder(phone);

  const payment = String(body.payment || 'unpaid').toLowerCase();
  // unpaid | prepaid | cod
  let status = 'pending_payment';
  const pinLat = body.lat != null ? Number(body.lat) : null;
  const pinLng = body.lng != null ? Number(body.lng) : null;
  const meta = {
    discount_paise: discount,
    free_delivery: pricing.free_delivery,
    offers_applied: pricing.applied,
    delivery_mode: pricing.delivery_mode,
    delivery_settings_source: pricing.delivery_settings_source,
    fulfillment_type: pickup ? 'pickup' : 'delivery',
    created_via: body.created_via === 'web_storefront' ? 'web_storefront' : 'admin_manual',
    offline: body.created_via === 'web_storefront' ? false : true,
    ...(pricing.applied?.some((a) => a.id === 'referral_welcome')
      ? { referral_code: referralWelcome.code }
      : {}),
    ...(pricing.wallet_paise > 0 ? { wallet_paise: pricing.wallet_paise } : {}),
    ...(deliverySlot ? { delivery_slot: deliverySlot } : {}),
    ...(Number.isFinite(pinLat) ? { delivery_lat: pinLat } : {}),
    ...(Number.isFinite(pinLng) ? { delivery_lng: pinLng } : {}),
  };

  const orderSource = body.source === 'web' ? 'web' : 'admin';

  await db.createOrder({
    order_ref: orderRef,
    phone,
    customer_name: customerName || cust?.name || null,
    meal,
    service_date: serviceDate,
    service_label: serviceLabel,
    delivery_slot: pickup ? null : deliverySlot,
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
    status,
    source: orderSource,
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
      notifyCustomer: false,
      notifyOps: body.notify_ops !== false,
      extra: {
        paid_via: 'cod_pending',
        payment_method: 'cod',
        cod_due_paise: due,
        prepaid_paise: prepaid,
        cod_allowed_at: new Date().toISOString(),
        cod_allowed_by: 'admin_manual',
      },
    });
    if (!result.ok) return { ok: false, error: result.error || 'COD mark paid failed' };
    order = result.order;
    if (body.notify_ops !== false) notifies.ops = true;
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

  if (body.notify_customer === true) {
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
