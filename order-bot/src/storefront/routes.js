/**
 * Public Food storefront APIs — browse, slots, zone, checkout.
 */

import { config } from '../config.js';
import { getDb } from '../db.js';
import {
  BROWSE_CATEGORIES,
  CATEGORIES,
  browseCategoryLabel,
  dishBrowseGroup,
} from '../menu.js';
import { formatPaise } from '../orders/cart.js';
import { cutoffLabel, nowIst } from '../cutoffs.js';
import {
  DAY_SLOT_WINDOW,
  getSlotLeadMinutes,
  isSlotTimeOpen,
  mealFromSlotId,
  parseSlotId,
  planAllMealSlotCandidates,
} from '../slots.js';
import { dishImagePublicUrl } from '../dish-images.js';
import { deliveryZoneFromPin, resolveGoogleMapsLocation } from '../geo.js';
import { createManualOrder } from '../orders/create-manual.js';
import { isRazorpayReady, publicPayUrl } from '../razorpay.js';
import { sessionFromStorefrontToken, verifyStorefrontToken } from './link.js';
import {
  getReferralSettings,
  previewReferral,
  referralWebStatus,
  referralsConfigured,
  walletBalancePaise,
} from '../referrals.js';
import { resolveFromRoot } from '../paths.js';

const FOOD_PAGE = resolveFromRoot('public/food/index.html');

/** Simple in-memory rate limit for checkout (tighten later — see STOREFRONT_CHECKLIST.md). */
const checkoutHits = new Map();
const CHECKOUT_WINDOW_MS = 15 * 60 * 1000;
const CHECKOUT_MAX = 8;

const addressHits = new Map();
const ADDRESS_WINDOW_MS = 5 * 60 * 1000;
const ADDRESS_MAX = 30;

/** Website books today + tomorrow (today drops out after the 9:30 PM last order). */
function websiteSlots() {
  return planAllMealSlotCandidates({ daysAhead: 1 });
}

function normalizeStorefrontPhone(raw) {
  let p = String(raw || '').replace(/\D/g, '');
  if (p.length === 10) p = `91${p}`;
  return p;
}

/** Phone proven by the signed WhatsApp link (`?t=`) — required for wallet and typed referrals. */
function checkoutPhoneVerified(body) {
  const v = verifyStorefrontToken(String(body.t || '').trim());
  return Boolean(v && v.phone === normalizeStorefrontPhone(body.phone));
}

function walletAllowedForCheckout(body) {
  return body.use_wallet !== false && checkoutPhoneVerified(body);
}

/** Recover pin from address text that appended maps.google.com/?q=lat,lng (older web checkouts). */
function pinFromAddressText(text) {
  const s = String(text || '');
  const m =
    s.match(/[?&]q=(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i) ||
    s.match(/@(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function allowAddressLookup(req) {
  const key = String(req.ip || req.headers['x-forwarded-for'] || 'unknown');
  const now = Date.now();
  let row = addressHits.get(key);
  if (!row || now - row.start > ADDRESS_WINDOW_MS) {
    row = { start: now, count: 0 };
  }
  row.count += 1;
  addressHits.set(key, row);
  return row.count <= ADDRESS_MAX;
}

function orderWhatsappDigits() {
  const raw = String(process.env.STOREFRONT_WHATSAPP || process.env.ORDER_WHATSAPP || '919823583498');
  const digits = raw.replace(/\D/g, '');
  return digits || '919823583498';
}

function minutesLabel(totalMin) {
  const h = Math.floor(Number(totalMin) / 60) % 24;
  const m = Number(totalMin) % 60;
  return cutoffLabel(h, m);
}

function clientKey(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0]
    .trim();
}

function allowCheckout(req) {
  const key = clientKey(req);
  const now = Date.now();
  let row = checkoutHits.get(key);
  if (!row || now - row.start > CHECKOUT_WINDOW_MS) {
    row = { start: now, count: 0 };
  }
  row.count += 1;
  checkoutHits.set(key, row);
  return row.count <= CHECKOUT_MAX;
}

function publicItem(dish, defaultImageUrl) {
  const browse = dishBrowseGroup(dish);
  const price = Number(dish.price_paise) || 0;
  const own = dishImagePublicUrl(dish.code);
  return {
    code: dish.code,
    name: dish.name,
    category: dish.category,
    browse,
    browse_label: browseCategoryLabel(browse),
    meal: dish.meal || 'both',
    price_paise: price,
    price_label: formatPaise(price),
    mrp_paise: dish.mrp_paise != null ? Number(dish.mrp_paise) : null,
    note: dish.note || '',
    cook_name: dish.cook_name || '',
    has_image: Boolean(own),
    image_url: own || defaultImageUrl || '',
    active: dish.active !== false,
  };
}

export function mountStorefront(app) {
  app.get(['/food', '/food/'], (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(FOOD_PAGE);
  });

  app.get('/api/storefront/menu', async (_req, res) => {
    try {
      const db = getDb();
      const all = await db.listAllDishes();
      const defaultImageUrl =
        config.catalogDefaultImageUrl ||
        `${String(config.publicBaseUrl || '').replace(/\/$/, '')}/media/catalog-default`;

      const items = (all || [])
        .filter((d) => d && d.active !== false)
        .map((d) => publicItem(d, defaultImageUrl))
        .sort((a, b) => String(a.code).localeCompare(String(b.code)));

      const browseIds = new Set(items.map((i) => i.browse));
      const categories = [
        ...BROWSE_CATEGORIES.filter((c) => browseIds.has(c.id)),
        ...(browseIds.has('packs')
          ? [{ id: 'packs', title: 'Party packs', emoji: '🍱' }]
          : []),
      ].map((c) => ({
        id: c.id,
        title: c.title,
        emoji: c.emoji || '',
      }));

      const wa = orderWhatsappDigits();
      const orderingOpen = websiteSlots().length > 0;
      const deliveryWindow = `${minutesLabel(DAY_SLOT_WINDOW.startMin)}–${minutesLabel(DAY_SLOT_WINDOW.endMin)}`;
      const minOrder = Number(await db.getMinOrderPaise(nowIst().isoDate)) || 0;

      res.setHeader('Cache-Control', 'public, max-age=60');
      res.json({
        ok: true,
        product: 'food',
        business: config.businessName,
        ist: nowIst().dayDateLabel,
        orderingOpen,
        deliveryWindow,
        lastOrderLabel: '9:30 PM',
        leadMinutes: getSlotLeadMinutes(),
        minOrderPaise: minOrder,
        minOrderLabel: minOrder > 0 ? formatPaise(minOrder) : null,
        defaultImageUrl,
        whatsapp: wa,
        whatsappUrl: `https://wa.me/${wa}?text=${encodeURIComponent('Hi')}`,
        categories,
        adminCategories: CATEGORIES.map((c) => ({ id: c.id, title: c.title })),
        items,
        phase: 3,
        checkout: true,
        razorpay: isRazorpayReady(),
        notice: orderingOpen
          ? 'Add items → pick a delivery slot (today or tomorrow) → pay online.'
          : 'Online ordering is closed for now — call or WhatsApp to confirm.',
      });
    } catch (err) {
      console.error('[storefront] menu failed', err);
      res.status(500).json({ ok: false, error: 'Menu unavailable' });
    }
  });

  app.get('/api/storefront/slots', (_req, res) => {
    try {
      const slots = websiteSlots().map((s) => ({
        id: s.id,
        label: `${s.dayOffset === 0 ? 'Today' : `Tomorrow (${s.serviceDay.weekday.slice(0, 3)})`} · ${s.label}`,
        startMin: s.startMin,
        meal: s.meal,
        dayLabel: s.dayLabel,
      }));
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        ok: true,
        leadMinutes: getSlotLeadMinutes(),
        orderingOpen: slots.length > 0,
        slots,
      });
    } catch (err) {
      console.error('[storefront] slots failed', err);
      res.status(500).json({ ok: false, error: 'Slots unavailable' });
    }
  });

  app.get('/api/storefront/session', async (req, res) => {
    try {
      const t = String(req.query.t || req.query.token || '').trim();
      if (!t) {
        res.status(400).json({ ok: false, error: 'Missing token' });
        return;
      }
      const session = await sessionFromStorefrontToken(t);
      if (!session) {
        res.status(401).json({ ok: false, error: 'Invalid or expired link' });
        return;
      }
      let wallet = null;
      if (referralsConfigured()) {
        try {
          const [balance, settings] = await Promise.all([
            walletBalancePaise(session.phone),
            getReferralSettings(),
          ]);
          wallet = { balance_paise: balance, max_pct: settings.wallet_max_pct };
        } catch (err) {
          console.warn('[storefront] wallet lookup', err.message);
        }
      }
      res.setHeader('Cache-Control', 'no-store');
      res.json({ ok: true, ...session, wallet });
    } catch (err) {
      console.error('[storefront] session', err);
      res.status(500).json({ ok: false, error: 'Session lookup failed' });
    }
  });

  /** Saved delivery pins for a WhatsApp number (phone = primary key). */
  app.get('/api/storefront/addresses', async (req, res) => {
    try {
      if (!allowAddressLookup(req)) {
        res.status(429).json({ ok: false, error: 'Too many lookups. Try again shortly.' });
        return;
      }
      const phone = normalizeStorefrontPhone(req.query.phone || req.query.wa);
      if (phone.length < 12) {
        res.status(400).json({ ok: false, error: 'Valid 10-digit WhatsApp number required' });
        return;
      }
      const cust = await getDb().getCustomer(phone);
      const addresses = (cust?.addresses || [])
        .filter((a) => a && (a.text || (a.lat != null && a.lng != null)))
        .slice()
        .sort((a, b) =>
          String(b.last_used_at || '').localeCompare(String(a.last_used_at || '')),
        )
        .slice(0, 5)
        .map((a) => {
          let lat = a.lat != null ? Number(a.lat) : null;
          let lng = a.lng != null ? Number(a.lng) : null;
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            const recovered = pinFromAddressText(a.text);
            if (recovered) {
              lat = recovered.lat;
              lng = recovered.lng;
            } else {
              lat = null;
              lng = null;
            }
          }
          const display = String(a.text || a.location_name || 'Saved pin')
            .replace(/\n📍[\s\S]*/g, '')
            .trim();
          return {
            id: a.id,
            text: display || a.location_name || 'Saved pin',
            location_name: a.location_name || null,
            lat,
            lng,
            zone: a.zone || null,
            last_used_at: a.last_used_at || null,
            has_pin: lat != null && lng != null,
          };
        });
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        ok: true,
        phone,
        name: cust?.name || null,
        addresses,
      });
    } catch (err) {
      console.error('[storefront] addresses', err);
      res.status(500).json({ ok: false, error: 'Could not load addresses' });
    }
  });

  app.get('/api/storefront/zone', (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({ ok: false, error: 'lat and lng required' });
      return;
    }
    const z = deliveryZoneFromPin(lat, lng);
    res.json({
      ok: true,
      km: Math.round(z.km * 10) / 10,
      zone: z.zone,
      withinService: z.withinService,
      maxKm: config.maxDeliveryKm,
    });
  });

  /** Resolve a pasted Google Maps / lat,lng text into coordinates + zone. */
  app.post('/api/storefront/resolve-location', async (req, res) => {
    try {
      const text = String(req.body?.text || req.body?.url || '').trim();
      if (text.length < 3) {
        res.status(400).json({ ok: false, error: 'Paste a Google Maps link or lat,lng' });
        return;
      }
      const loc = await resolveGoogleMapsLocation(text);
      if (!loc || !Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude)) {
        res.status(400).json({
          ok: false,
          error: 'Could not read that location. Paste a full Maps link or coordinates.',
        });
        return;
      }
      const z = deliveryZoneFromPin(loc.latitude, loc.longitude);
      res.json({
        ok: true,
        lat: loc.latitude,
        lng: loc.longitude,
        km: Math.round(z.km * 10) / 10,
        zone: z.zone,
        withinService: z.withinService,
        maxKm: config.maxDeliveryKm,
      });
    } catch (err) {
      console.error('[storefront] resolve-location', err);
      res.status(500).json({ ok: false, error: 'Could not resolve location' });
    }
  });

  /** Referral box on the website: code or friend's mobile; same rules as checkout, nothing saved. */
  app.post('/api/storefront/referral-check', async (req, res) => {
    try {
      if (!allowAddressLookup(req)) {
        res.status(429).json({ ok: false, message: 'Too many checks. Try again shortly.' });
        return;
      }
      const code = String(req.body?.code || '').trim().slice(0, 20);
      if (!code) {
        res.status(400).json({ ok: false, message: 'Enter a referral code or number.' });
        return;
      }
      const result = await previewReferral({ phone: normalizeStorefrontPhone(req.body?.phone), code });
      res.setHeader('Cache-Control', 'no-store');
      res.json(referralWebStatus(result));
    } catch (err) {
      console.error('[storefront] referral-check', err);
      res.status(500).json({ ok: false, message: 'Could not check right now.' });
    }
  });

  app.post('/api/storefront/checkout', async (req, res) => {
    try {
      if (!allowCheckout(req)) {
        res.status(429).json({ ok: false, error: 'Too many checkout attempts. Try again later.' });
        return;
      }
      const body = req.body || {};
      const fulfillmentType =
        String(body.fulfillment_type || '').toLowerCase() === 'pickup' ? 'pickup' : 'delivery';
      const deliverySlot = String(body.delivery_slot || '').trim();
      if (!deliverySlot || !parseSlotId(deliverySlot)) {
        res.status(400).json({
          ok: false,
          error: 'Pick a delivery slot (e.g. 2026-09-17T1830)',
        });
        return;
      }
      const parsed = parseSlotId(deliverySlot);
      if (!isSlotTimeOpen(parsed.isoDate, parsed.startMin)) {
        res.status(400).json({ ok: false, error: 'That slot is no longer available. Pick another.' });
        return;
      }
      const openIds = new Set(websiteSlots().map((s) => s.id));
      if (!openIds.has(deliverySlot)) {
        res.status(400).json({ ok: false, error: 'That slot is not bookable right now.' });
        return;
      }

      const meal = mealFromSlotId(deliverySlot);
      if (!meal) {
        res.status(400).json({ ok: false, error: 'Invalid slot for kitchen meal' });
        return;
      }

      let deliveryZone = 'z1';
      let address = String(body.address || '').trim();
      let pinLat;
      let pinLng;
      if (fulfillmentType === 'delivery') {
        if (address.length < 5) {
          res.status(400).json({ ok: false, error: 'Delivery address required' });
          return;
        }
        const lat = Number(body.lat);
        const lng = Number(body.lng);
        const hasPin = Number.isFinite(lat) && Number.isFinite(lng);
        if (hasPin) {
          const z = deliveryZoneFromPin(lat, lng);
          // Phone GPS is often km off — a far pin never blocks the order; fee from the picked distance, staff confirm.
          const picked = String(body.delivery_zone || body.zone || '').trim().toLowerCase();
          const farPin = !z.withinService;
          deliveryZone = farPin ? (['z1', 'z2', 'z3', 'flat'].includes(picked) ? picked : 'z3') : z.zone;
          if (!farPin) {
            pinLat = lat;
            pinLng = lng;
          }
          const maps = `https://maps.google.com/?q=${lat},${lng}`;
          if (!address.includes('maps.google')) {
            address = `${address}\n📍 ${maps}`.trim();
          }
          if (farPin) {
            address = `${address}\n⚠️ Pin shows ~${z.km.toFixed(1)} km (outside area) — call customer to confirm location`;
          }
        } else {
          const zoneRaw = String(body.delivery_zone || body.zone || '')
            .trim()
            .toLowerCase();
          if (['z1', 'z2', 'z3', 'flat'].includes(zoneRaw)) {
            deliveryZone = zoneRaw;
          } else {
            res.status(400).json({
              ok: false,
              error: 'Share a location pin (optional) or pick delivery distance (0–3 / 3–6 / 6+ km).',
            });
            return;
          }
        }
      }

      const result = await createManualOrder({
        phone: body.phone,
        customer_name: body.customer_name,
        meal,
        service_date: parsed.isoDate,
        delivery_slot: deliverySlot,
        fulfillment_type: fulfillmentType,
        delivery_zone: fulfillmentType === 'pickup' ? 'pickup' : deliveryZone,
        address,
        lat: fulfillmentType === 'delivery' ? pinLat : undefined,
        lng: fulfillmentType === 'delivery' ? pinLng : undefined,
        location_name: body.location_name,
        items: body.items,
        // Unverified typed numbers: referral is linked via the WhatsApp verify button instead.
        referral_code: checkoutPhoneVerified(body) ? body.referral_code : undefined,
        use_wallet: walletAllowedForCheckout(body),
        payment: 'unpaid',
        source: 'web',
        created_via: 'web_storefront',
        notify_customer: false,
        notify_ops: true,
        apply_offers: true,
      });

      if (!result.ok) {
        res.status(400).json({ ok: false, error: result.error || 'Checkout failed' });
        return;
      }

      const order = result.order;
      const payUrl = publicPayUrl(order.order_ref);
      res.json({
        ok: true,
        order_ref: order.order_ref,
        total_paise: order.total_paise,
        total_label: formatPaise(order.total_paise),
        pay_url: payUrl,
        razorpay: isRazorpayReady(),
        order: {
          order_ref: order.order_ref,
          service_label: order.service_label,
          food_paise: order.food_paise,
          delivery_fee_paise: order.delivery_fee_paise,
          discount_paise: order.discount_paise,
          total_paise: order.total_paise,
          delivery_zone: order.delivery_zone,
        },
      });
    } catch (err) {
      console.error('[storefront] checkout failed', err);
      res.status(500).json({ ok: false, error: 'Checkout failed' });
    }
  });
}
