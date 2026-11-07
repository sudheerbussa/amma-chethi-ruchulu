/**
 * Public Fresh storefront APIs — browse, hourly slots (tomorrow onwards, inside delivery windows), zone, checkout.
 */

import { config } from '../config.js';
import { getDb } from '../db.js';
import {
  CATEGORIES,
  dishHasKgPacks,
  formatKgPack,
  packPricePaise,
} from '../menu.js';
import { formatPaise } from '../orders/cart.js';
import {
  SLOT_OCCUPYING_STATUSES,
  cutoffLabel,
  enrichSlotsWithCounts,
  deliveryWindowsLabel,
  isSlotTimeOpen,
  nowIst,
  parseSlotId,
  planSlotCandidates,
} from '../cutoffs.js';
import {
  getSlotLeadMinutes,
} from '../ops-settings.js';
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
import {
  HELP_TOPICS,
  createHelpTicket,
  feedbackContextForOrder,
  saveOrderFeedback,
} from '../orders/customer-support.js';

const FRESH_PAGE = resolveFromRoot('public/fresh/index.html');
const FEEDBACK_PAGE = resolveFromRoot('public/fresh/feedback.html');
const HELP_PAGE = resolveFromRoot('public/fresh/help.html');

const checkoutHits = new Map();
const CHECKOUT_WINDOW_MS = 15 * 60 * 1000;
const CHECKOUT_MAX = 8;

const addressHits = new Map();
const ADDRESS_WINDOW_MS = 5 * 60 * 1000;
const ADDRESS_MAX = 30;

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
  // Default = ACR Fresh business line (Graph display_phone), not Food.
  const raw = String(
    process.env.STOREFRONT_WHATSAPP || process.env.ORDER_WHATSAPP || '919392044833',
  );
  const digits = raw.replace(/\D/g, '');
  return digits || '919392044833';
}

function supportCallDigits() {
  const raw = String(config.supportPhone || process.env.SUPPORT_PHONE || '919392044833');
  const digits = raw.replace(/\D/g, '');
  return digits || '919392044833';
}

function formatInPhoneDisplay(digits) {
  let d = String(digits || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 10) return `${d.slice(0, 5)} ${d.slice(5)}`;
  return d;
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

function unitPriceLabel(dish) {
  const price = Number(dish.price_paise) || 0;
  const unit = dish.unit === 'pc' ? 'pc' : dish.unit === 'kg' ? 'kg' : dish.unit || 'kg';
  return `${formatPaise(price)}/${unit}`;
}

/** Telugu primary + English secondary for storefront cards. */
function bilingualNames(dish) {
  const en = String(dish.name || dish.code || '').trim();
  const te = String(dish.name_te || '').trim();
  if (te && en && te !== en) {
    return { display_name: te, name_en: en, name_te: te };
  }
  if (te) return { display_name: te, name_en: '', name_te: te };
  return { display_name: en, name_en: '', name_te: '' };
}

function publicItem(dish, defaultImageUrl) {
  const price = Number(dish.price_paise) || 0;
  const own = dishImagePublicUrl(dish.code);
  const packs = dishHasKgPacks(dish)
    ? (dish.sizes_kg || []).map((kg) => ({
        kg: Number(kg),
        label: formatKgPack(kg),
        price_paise: packPricePaise(price, kg),
        price_label: formatPaise(packPricePaise(price, kg)),
      }))
    : [];
  const names = bilingualNames(dish);
  const cat = CATEGORIES.find((c) => c.id === dish.category);
  return {
    code: dish.code,
    name: dish.name,
    name_te: names.name_te,
    name_en: names.name_en,
    display_name: names.display_name,
    category: dish.category,
    browse: dish.category,
    browse_label: cat?.title_te || cat?.title || dish.category,
    browse_label_en: cat?.title || dish.category,
    unit: dish.unit || 'kg',
    price_paise: price,
    price_label: unitPriceLabel(dish),
    sizes_kg: packs.length ? packs.map((p) => p.kg) : null,
    packs,
    note: dish.note || '',
    has_image: Boolean(own),
    image_url: own || defaultImageUrl || '',
    active: dish.active !== false,
    out_of_stock: dish.active === false,
  };
}

/** Open hours on the first BOOKABLE_DAYS dates that still have space (full days roll forward). */
async function availableStorefrontSlots() {
  const candidates = planSlotCandidates({ daysAhead: 2, overflow: true });
  const ids = candidates.map((s) => s.id);
  let counts = {};
  const db = getDb();
  if (typeof db.countOrdersByDeliverySlot === 'function') {
    try {
      counts = await db.countOrdersByDeliverySlot(ids, SLOT_OCCUPYING_STATUSES);
    } catch {
      counts = {};
    }
  }
  const open = enrichSlotsWithCounts(candidates, counts).filter((s) => s.available);
  const days = [...new Set(open.map((s) => s.isoDate))].slice(0, Math.max(1, Number(config.bookableDays) || 2));
  return open.filter((s) => days.includes(s.isoDate));
}

export function mountStorefront(app) {
  app.get(['/fresh', '/fresh/'], (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(FRESH_PAGE);
  });

  app.get(['/fresh/feedback', '/fresh/feedback/'], (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(FEEDBACK_PAGE);
  });

  app.get(['/fresh/help', '/fresh/help/'], (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(HELP_PAGE);
  });

  app.get('/api/storefront/feedback/context', async (req, res) => {
    try {
      const token = String(req.query.t || req.query.token || '');
      const session = token ? await sessionFromStorefrontToken(token) : null;
      const phone = session?.phone || normalizeStorefrontPhone(req.query.phone);
      let ref = String(req.query.ref || '').trim().toUpperCase();
      const db = getDb();

      if (!ref && phone) {
        const order = await db.findLatestDeliveredWithoutFeedback(phone);
        ref = order?.order_ref || '';
        if (!ref) {
          const latest = await db.findLatestOrder(phone);
          if (latest?.status === 'delivered') ref = latest.order_ref;
        }
      }
      if (!ref) {
        res.status(400).json({ ok: false, error: 'Order ref required — open the link from WhatsApp after delivery' });
        return;
      }
      const order = await db.findOrderByRef(ref);
      if (!order) {
        res.status(404).json({ ok: false, error: 'Order not found' });
        return;
      }
      if (phone) {
        const op = String(order.phone || '').replace(/\D/g, '');
        if (op && op !== phone) {
          res.status(403).json({ ok: false, error: 'This feedback link is for a different number' });
          return;
        }
      }
      const existing = await db.getFeedbackByOrder(ref);
      res.json({
        ok: true,
        phone: phone || order.phone,
        already: Boolean(existing),
        order: feedbackContextForOrder(order),
      });
    } catch (err) {
      console.error('[storefront] feedback context', err);
      res.status(500).json({ ok: false, error: 'Could not load feedback' });
    }
  });

  app.post('/api/storefront/feedback', async (req, res) => {
    try {
      const body = req.body || {};
      const token = String(body.t || body.token || '');
      const session = token ? await sessionFromStorefrontToken(token) : null;
      const phone = session?.phone || normalizeStorefrontPhone(body.phone);
      const result = await saveOrderFeedback({
        orderRef: body.order_ref || body.ref,
        phone,
        rating: body.rating,
        comment: body.comment,
        tags: body.tags,
      });
      if (!result.ok) {
        res.status(result.already ? 409 : 400).json(result);
        return;
      }
      res.json(result);
    } catch (err) {
      console.error('[storefront] feedback save', err);
      res.status(500).json({ ok: false, error: 'Could not save feedback' });
    }
  });

  app.get('/api/storefront/help/context', async (req, res) => {
    try {
      const token = String(req.query.t || req.query.token || '');
      const session = token ? await sessionFromStorefrontToken(token) : null;
      const phone = session?.phone || normalizeStorefrontPhone(req.query.phone);
      const db = getDb();
      let pending = null;
      let latest = null;
      if (phone) {
        pending = await db.findLatestPendingOrder(phone);
        latest = await db.findLatestOrder(phone);
      }
      const refHint = String(req.query.ref || '').trim().toUpperCase()
        || pending?.order_ref
        || latest?.order_ref
        || null;
      res.json({
        ok: true,
        phone: phone || null,
        topics: HELP_TOPICS,
        order_ref: refHint,
        pending_ref: pending?.order_ref || null,
        latest_ref: latest?.order_ref || null,
        latest_status: latest?.status || null,
        support_phone: config.supportPhone,
        support_display: config.supportPhone ? `+${config.supportPhone}` : null,
      });
    } catch (err) {
      console.error('[storefront] help context', err);
      res.status(500).json({ ok: false, error: 'Could not load help' });
    }
  });

  app.post('/api/storefront/help', async (req, res) => {
    try {
      const body = req.body || {};
      const token = String(body.t || body.token || '');
      const session = token ? await sessionFromStorefrontToken(token) : null;
      const phone = session?.phone || normalizeStorefrontPhone(body.phone);
      const result = await createHelpTicket({
        phone,
        topic: body.topic,
        message: body.message,
        orderRef: body.order_ref || body.ref,
        source: 'web',
      });
      if (!result.ok) {
        res.status(400).json(result);
        return;
      }
      res.json(result);
    } catch (err) {
      console.error('[storefront] help ticket', err);
      res.status(500).json({ ok: false, error: 'Could not create ticket' });
    }
  });

  app.get('/api/storefront/menu', async (_req, res) => {
    try {
      const db = getDb();
      const all = await db.listAllDishes();
      const defaultImageUrl =
        config.catalogDefaultImageUrl ||
        `${String(config.publicBaseUrl || '').replace(/\/$/, '')}/media/catalog-default`;

      const items = (all || [])
        .filter((d) => d && !d.emergency)
        .filter((d) => d.category === 'vegetables' || d.category === 'fruits')
        .map((d) => publicItem(d, defaultImageUrl))
        .sort((a, b) => {
          const aOut = a.active === false || a.out_of_stock ? 1 : 0;
          const bOut = b.active === false || b.out_of_stock ? 1 : 0;
          if (aOut !== bOut) return aOut - bOut;
          return String(a.code).localeCompare(String(b.code));
        });

      const browseIds = new Set(items.map((i) => i.browse));
      const categories = CATEGORIES.filter((c) => browseIds.has(c.id)).map((c) => ({
        id: c.id,
        title: c.title_te || c.title,
        title_en: c.title,
        emoji: c.emoji || '',
      }));

      const wa = orderWhatsappDigits();
      const callDigits = supportCallDigits();
      const callDisplay = formatInPhoneDisplay(callDigits);
      const openSlots = await availableStorefrontSlots();
      const orderingOpen = openSlots.length > 0;
      const deliveryWindow = deliveryWindowsLabel();
      const minOrder = Number(await db.getMinOrderPaise(nowIst().isoDate)) || 0;

      res.setHeader('Cache-Control', 'public, max-age=60');
      res.json({
        ok: true,
        product: 'fresh',
        business: config.businessName,
        ist: nowIst().dayDateLabel,
        orderingOpen,
        deliveryWindow,
        leadMinutes: getSlotLeadMinutes(),
        minOrderPaise: minOrder,
        minOrderLabel: minOrder > 0 ? formatPaise(minOrder) : null,
        defaultImageUrl,
        whatsapp: wa,
        whatsappUrl: `https://wa.me/${wa}?text=${encodeURIComponent('Hi Fresh')}`,
        supportPhone: callDigits,
        supportPhoneDisplay: callDisplay,
        supportTelUrl: `tel:+${callDigits}`,
        emergencyHint:
          `List లో లేని items / emergency groceries కావాలంటే call చేయండి: ${callDisplay}`,
        categories,
        items,
        checkout: true,
        razorpay: isRazorpayReady(),
        notice: orderingOpen
          ? 'Pick pack size → delivery hour → pay online.'
          : 'No delivery slots open right now — WhatsApp us or try later.',
      });
    } catch (err) {
      console.error('[storefront] menu failed', err);
      res.status(500).json({ ok: false, error: 'Menu unavailable' });
    }
  });

  app.get('/api/storefront/slots', async (_req, res) => {
    try {
      const slots = (await availableStorefrontSlots()).map((s) => ({
        id: s.id,
        label: `${s.dayLabel || s.isoDate} · ${s.label}`,
        hour: s.hour,
        isoDate: s.isoDate,
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
      const deliverySlot = String(body.delivery_slot || '').trim();
      const parsed = parseSlotId(deliverySlot);
      if (!parsed) {
        res.status(400).json({
          ok: false,
          error: 'Pick a delivery hour',
        });
        return;
      }
      if (!isSlotTimeOpen(parsed.isoDate, parsed.hour)) {
        res.status(400).json({ ok: false, error: 'That hour is no longer available. Pick another.' });
        return;
      }
      const open = await availableStorefrontSlots();
      if (!open.some((s) => s.id === deliverySlot)) {
        res.status(400).json({ ok: false, error: 'That slot is full or not bookable right now.' });
        return;
      }

      const lat = Number(body.lat);
      const lng = Number(body.lng);
      const hasPin = Number.isFinite(lat) && Number.isFinite(lng);

      let address = String(body.address || '').trim();
      if (address.length < 5) {
        res.status(400).json({ ok: false, error: 'Delivery address required' });
        return;
      }

      let deliveryZone = 'z1';
      let pinLat;
      let pinLng;
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

      const result = await createManualOrder({
        phone: body.phone,
        customer_name: body.customer_name,
        delivery_slot: deliverySlot,
        delivery_zone: deliveryZone,
        address,
        lat: pinLat,
        lng: pinLng,
        location_name: body.location_name,
        items: body.items,
        // Unverified typed numbers: referral is linked via the WhatsApp verify button instead.
        referral_code: checkoutPhoneVerified(body) ? body.referral_code : undefined,
        use_wallet: walletAllowedForCheckout(body),
        payment: String(body.payment || 'unpaid').toLowerCase() === 'cod' ? 'cod' : 'unpaid',
        source: 'web',
        created_via: 'web_storefront',
        notify_customer: String(body.payment || '').toLowerCase() === 'cod',
        notify_ops: true,
        apply_offers: true,
      });

      if (!result.ok) {
        res.status(400).json({ ok: false, error: result.error || 'Checkout failed' });
        return;
      }

      const order = result.order;
      const isCod =
        String(order.payment_method || '') === 'cod' ||
        String(order.paid_via || '') === 'cod_pending' ||
        Number(order.cod_due_paise) > 0;
      const payUrl = publicPayUrl(order.order_ref);
      res.json({
        ok: true,
        order_ref: order.order_ref,
        total_paise: order.total_paise,
        delivery_zone: order.delivery_zone,
        payment_method: isCod ? 'cod' : 'online',
        cod: isCod,
        cod_due_paise: isCod ? order.cod_due_paise || order.total_paise : null,
        pay_url: isCod ? null : payUrl,
        razorpay: !isCod && isRazorpayReady(),
      });
    } catch (err) {
      console.error('[storefront] checkout failed', err);
      res.status(500).json({ ok: false, error: 'Checkout failed' });
    }
  });
}
