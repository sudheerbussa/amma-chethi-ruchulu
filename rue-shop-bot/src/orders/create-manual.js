import { getDb } from '../db.js';
import { buildCartLines } from './cart.js';
import { computeShipping, FULFILLMENT } from '../shipping.js';
import { publicPayUrl } from '../razorpay.js';
import { notifyOps } from '../ops-notify.js';

function normalizePhone(raw) {
  let p = String(raw || '').replace(/\D/g, '');
  if (p.length === 10) p = `91${p}`;
  return p;
}

/**
 * Create a Decorative Lights order (web storefront).
 * Body: { name, phone, items:[{code,qty}], fulfillment, address?, town?, pincode?, city?, state? }
 */
export async function createManualOrder(body = {}) {
  const name = String(body.name || body.customer_name || '').trim();
  const phone = normalizePhone(body.phone);
  if (!name || name.length < 2) return { ok: false, error: 'Please enter your name' };
  if (phone.length < 12) return { ok: false, error: 'Please enter a valid 10-digit mobile number' };

  const cart = buildCartLines(body.items || body.cart || []);
  if (!cart.ok) return cart;

  const mode = String(body.fulfillment || body.shipping_mode || FULFILLMENT.pickup).toLowerCase();
  const town = String(body.town || body.city || '').trim();
  const address = String(body.address || '').trim();
  const pincode = String(body.pincode || body.pin || '').replace(/\D/g, '').slice(0, 6);
  const city = String(body.city || town).trim();
  const state = String(body.state || '').trim() || (mode === FULFILLMENT.local ? 'Maharashtra' : '');

  if (mode !== FULFILLMENT.pickup) {
    if (address.length < 8) return { ok: false, error: 'Please enter a full delivery address' };
    if (pincode.length !== 6) return { ok: false, error: 'Please enter a 6-digit PIN code' };
    if (!city) return { ok: false, error: 'Please enter your town / city' };
  }

  const ship = computeShipping({ mode, town: city || town, subtotalPaise: cart.food_paise });
  if (!ship.ok) return ship;

  const total_paise = cart.food_paise + ship.delivery_fee_paise;
  if (total_paise < 100) return { ok: false, error: 'Order total too low' };

  const db = getDb();
  const order_ref = await db.nextOrderRef();
  const order = await db.createOrder({
    order_ref,
    status: 'pending_payment',
    phone,
    customer_name: name,
    items: cart.items,
    food_paise: cart.food_paise,
    delivery_fee_paise: ship.delivery_fee_paise,
    discount_paise: 0,
    free_delivery: ship.free_delivery,
    total_paise,
    fulfillment: ship.mode,
    delivery_zone: ship.zone,
    delivery_label: ship.label,
    address: mode === FULFILLMENT.pickup ? null : address,
    town: city || town || null,
    pincode: mode === FULFILLMENT.pickup ? null : pincode,
    city: city || null,
    state: state || null,
    created_via: body.created_via || 'web_storefront',
    payment_method: 'online',
    category: 'decorative-lights',
  });

  const pay_url = publicPayUrl(order_ref);
  notifyOps({
    title: `New order ${order_ref}`,
    text: `${name} (${phone}) — ₹${(total_paise / 100).toFixed(0)} — ${ship.label} — pending payment`,
  }).catch(() => {});

  return { ok: true, order, order_ref, pay_url, total_paise };
}
