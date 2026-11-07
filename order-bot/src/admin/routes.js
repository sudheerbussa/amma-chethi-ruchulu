import { getDb } from '../db.js';
import { config } from '../config.js';
import { applyOrderStatus } from '../orders/status.js';
import { createManualOrder } from '../orders/create-manual.js';
import { resolveFromRoot } from '../paths.js';
import { CATEGORIES } from '../menu.js';
import {
  dishHasImage,
  dishImagePublicUrl,
  saveDishImage,
  deleteDishImage,
} from '../dish-images.js';
import { sendText } from '../whatsapp.js';
import { mountReferralAdmin } from './referral-routes.js';
import express from 'express';
import {
  deletePoster,
  getPoster,
  isPosterSlot,
  listPosters,
  savePoster,
  sendImageBuffer,
  sendMenuPosters,
} from '../posters.js';
import {
  loadPosterAutoSettings,
  savePosterAutoSettings,
} from '../poster-settings.js';
import { formatMenuPriceChunks, hoursAndRangeBlurb } from '../menu-text.js';
import { sendOrderToRiders } from '../ops-notify.js';

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token;
  if (!config.adminToken || token !== config.adminToken) {
    res.status(401).json({ error: 'Unauthorized — login required' });
    return;
  }
  next();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const WA_SESSION_NOTE =
  'Free-form WhatsApp text only delivers inside Meta’s 24-hour customer care window (after the customer last messaged your bot). Outside that window you need an approved template.';

function formatCustomerMessage(message, { personal = true } = {}) {
  const text = String(message || '').trim();
  if (personal) return text.slice(0, 4096);
  return (`📢 ${config.businessName}\n\n` + text).slice(0, 1024);
}

async function sendCustomerMessage(phone, message, { personal = true } = {}) {
  const normalized = String(phone || '').replace(/\D/g, '');
  if (normalized.length < 10) throw new Error('Invalid phone');
  const body = formatCustomerMessage(message, { personal });
  if (body.length < 1) throw new Error('Message is empty');
  await sendText(normalized, body);
  return { phone: normalized, body, personal };
}

function todayIsoIst() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function isSameDayIst(iso) {
  if (!iso) return false;
  try {
    return (
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(iso)) === todayIsoIst()
    );
  } catch {
    return false;
  }
}

export function mountAdmin(app) {
  mountReferralAdmin(app, auth);

  /** Hub: one login → Food / Fresh app tiles */
  app.get('/admin', (_req, res) => {
    res.sendFile(resolveFromRoot('public', 'admin-hub.html'));
  });

  /** Full ops dashboard for this bot */
  app.get('/admin/app', (_req, res) => {
    res.sendFile(resolveFromRoot('public', 'admin.html'));
  });

  /** Sister URLs for the hub launcher (safe to expose — no secrets). */
  app.get('/admin/api/hub-config', (_req, res) => {
    res.json({
      ok: true,
      foodAppUrl: config.adminFoodAppUrl,
      freshAppUrl: config.adminFreshAppUrl,
      hubUrl: config.adminHubUrl,
      product: config.adminHubProduct,
    });
  });

  /** Public login: username (default superadmin) + password = ADMIN_TOKEN */
  app.post('/admin/api/login', (req, res) => {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    if (!config.adminToken) {
      res.status(503).json({ error: 'Admin login not configured (ADMIN_TOKEN)' });
      return;
    }
    if (username !== config.adminUser || password !== config.adminToken) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }
    res.json({
      ok: true,
      username: config.adminUser,
      token: config.adminToken,
      business: config.businessName,
    });
  });

  /** WhatsApp menu posters (list / preview / upload / delete / auto-send toggles) */
  app.get('/admin/api/posters', auth, async (_req, res) => {
    try {
      const auto = await loadPosterAutoSettings(getDb());
      res.json({ ok: true, slots: listPosters(), auto });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Could not load posters' });
    }
  });

  app.put('/admin/api/posters/auto', auth, async (req, res) => {
    try {
      const auto = await savePosterAutoSettings(getDb(), req.body || {});
      res.json({ ok: true, auto });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not save poster auto settings' });
    }
  });

  app.get('/admin/api/posters/:slot/image', auth, (req, res) => {
    const slot = String(req.params.slot || '');
    if (!isPosterSlot(slot)) {
      res.status(400).json({ error: 'Unknown poster' });
      return;
    }
    const poster = getPoster(slot);
    if (!poster?.has_file || !poster.file) {
      res.status(404).json({ error: 'No poster uploaded' });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.type(poster.mime || 'image/jpeg');
    res.sendFile(poster.file);
  });

  app.put(
    '/admin/api/posters/:slot',
    auth,
    express.raw({
      type: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/octet-stream'],
      limit: '5mb',
    }),
    (req, res) => {
      try {
        const slot = String(req.params.slot || '');
        if (!isPosterSlot(slot)) {
          res.status(400).json({ error: 'Unknown poster' });
          return;
        }
        const mime = String(req.headers['content-type'] || 'image/jpeg').split(';')[0].trim();
        const caption = String(req.query.caption || req.headers['x-poster-caption'] || '');
        const saved = savePoster(slot, {
          buffer: req.body,
          mime,
          caption,
        });
        res.json({
          ok: true,
          poster: {
            id: saved.id,
            has_file: saved.has_file,
            caption: saved.caption,
            mime: saved.mime,
            updated_at: saved.updated_at,
            bytes: saved.bytes,
          },
        });
      } catch (err) {
        res.status(400).json({ error: err.message || 'Upload failed' });
      }
    },
  );

  app.delete('/admin/api/posters/:slot', auth, (req, res) => {
    const slot = String(req.params.slot || '');
    if (!isPosterSlot(slot)) {
      res.status(400).json({ error: 'Unknown poster' });
      return;
    }
    const poster = deletePoster(slot);
    res.json({
      ok: true,
      poster: {
        id: poster.id,
        has_file: poster.has_file,
        caption: poster.caption,
        mime: poster.mime,
        updated_at: poster.updated_at,
        bytes: poster.bytes,
      },
    });
  });

  app.post('/admin/api/messages/send', auth, async (req, res) => {
    const phone = String(req.body?.phone || '').replace(/\D/g, '');
    const message = String(req.body?.message || '').trim();
    const personal = req.body?.personal !== false;
    const maxLen = personal ? 4096 : 900;
    if (phone.length < 10) {
      res.status(400).json({ error: 'Valid customer phone required' });
      return;
    }
    if (message.length < 1 || message.length > maxLen) {
      res.status(400).json({ error: `message must be 1–${maxLen} characters` });
      return;
    }
    const orderRef = String(req.body?.order_ref || '').trim() || null;
    try {
      const sent = await sendCustomerMessage(phone, message, { personal });
      res.json({
        ok: true,
        ...sent,
        order_ref: orderRef,
        note: WA_SESSION_NOTE,
      });
    } catch (err) {
      res.status(502).json({
        error: err.message || 'WhatsApp send failed',
        note: WA_SESSION_NOTE,
      });
    }
  });

  app.post(
    '/admin/api/messages/send-image',
    auth,
    express.raw({
      type: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/octet-stream'],
      limit: '5mb',
    }),
    async (req, res) => {
      const phone = String(req.query.phone || req.headers['x-wa-phone'] || '').replace(/\D/g, '');
      const caption = String(req.query.caption || req.headers['x-image-caption'] || '').slice(0, 1024);
      if (phone.length < 10) {
        res.status(400).json({ error: 'Valid customer phone required (?phone=)' });
        return;
      }
      try {
        const mime = String(req.headers['content-type'] || 'image/jpeg').split(';')[0].trim();
        const result = await sendImageBuffer(phone, {
          buffer: req.body,
          mime,
          caption: caption || undefined,
        });
        res.json({
          ok: true,
          phone,
          ...result,
          note: WA_SESSION_NOTE,
        });
      } catch (err) {
        res.status(502).json({
          error: err.message || 'WhatsApp image send failed',
          note: WA_SESSION_NOTE,
        });
      }
    },
  );

  app.post('/admin/api/messages/send-menu', auth, async (req, res) => {
    const includeSpecials = req.body?.include_specials !== false;
    const includeFullMenu = req.body?.include_full_menu !== false;
    const includeDaily = req.body?.include_daily !== false;
    const intro =
      req.body?.intro === false || req.body?.intro === 0
        ? false
        : req.body?.intro != null
          ? String(req.body.intro)
          : undefined;
    const db = getDb();
    let phones = [];
    const one = String(req.body?.phone || '').replace(/\D/g, '');
    if (one.length >= 10) phones = [one];
    if (Array.isArray(req.body?.phones)) {
      phones = req.body.phones
        .map((p) => String(p).replace(/\D/g, ''))
        .filter((p) => p.length >= 10);
    }
    if (!phones.length) {
      const audience = String(req.body?.audience || '');
      if (!audience) {
        res.status(400).json({ error: 'phone, phones, or audience required' });
        return;
      }
      const customers = await db.listCustomers(500);
      if (audience === 'ordered') {
        phones = customers.filter((c) => (c.order_count || 0) > 0).map((c) => c.phone);
      } else if (audience === 'recent') {
        const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
        phones = customers
          .filter((c) => c.last_order_at && new Date(c.last_order_at).getTime() >= weekAgo)
          .map((c) => c.phone);
      } else if (audience === 'all') {
        phones = customers.map((c) => c.phone);
      } else {
        res.status(400).json({ error: 'For selected audience, pass phones[]' });
        return;
      }
    }
    phones = [...new Set(phones)].slice(0, 200);
    if (!phones.length) {
      res.status(400).json({ error: 'No recipients matched' });
      return;
    }
    const results = {
      ok: 0,
      fail: 0,
      sent_images: 0,
      errors: [],
      note: WA_SESSION_NOTE,
    };
    for (const phone of phones) {
      try {
        const r = await sendMenuPosters(phone, {
          intro: intro === false ? false : intro,
          includeSpecials,
          includeFullMenu,
          includeDaily,
        });
        if (r.sent > 0) {
          results.ok += 1;
          results.sent_images += r.sent;
        } else {
          results.fail += 1;
          if (results.errors.length < 20) {
            results.errors.push({
              phone,
              error:
                r.errors.join('; ') ||
                'No menu posters uploaded — upload Full menu / Daily / Specials in Admin → Posters',
            });
          }
        }
      } catch (err) {
        results.fail += 1;
        if (results.errors.length < 20) {
          results.errors.push({ phone, error: err.message || 'send failed' });
        }
      }
      await sleep(150);
    }
    res.json({
      ...results,
      sent_to: phones.length,
      tip: 'Upload posters under Admin → Posters. Customer must be in the 24h WhatsApp window.',
    });
  });

  app.post('/admin/api/messages/send-menu-text', auth, async (req, res) => {
    const includeHours = req.body?.include_hours !== false;
    const db = getDb();
    let phones = [];
    const one = String(req.body?.phone || '').replace(/\D/g, '');
    if (one.length >= 10) phones = [one];
    if (Array.isArray(req.body?.phones)) {
      phones = req.body.phones
        .map((p) => String(p).replace(/\D/g, ''))
        .filter((p) => p.length >= 10);
    }
    if (!phones.length) {
      const audience = String(req.body?.audience || '');
      if (!audience) {
        res.status(400).json({ error: 'phone, phones, or audience required' });
        return;
      }
      const customers = await db.listCustomers(500);
      if (audience === 'ordered') {
        phones = customers.filter((c) => (c.order_count || 0) > 0).map((c) => c.phone);
      } else if (audience === 'recent') {
        const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
        phones = customers
          .filter((c) => c.last_order_at && new Date(c.last_order_at).getTime() >= weekAgo)
          .map((c) => c.phone);
      } else if (audience === 'all') {
        phones = customers.map((c) => c.phone);
      } else {
        res.status(400).json({ error: 'For selected audience, pass phones[]' });
        return;
      }
    }
    phones = [...new Set(phones)].slice(0, 200);
    if (!phones.length) {
      res.status(400).json({ error: 'No recipients matched' });
      return;
    }
    const dishes = await db.listAllDishes();
    const chunks = formatMenuPriceChunks(dishes, { businessName: config.businessName });
    const parts = includeHours ? [hoursAndRangeBlurb(), ...chunks] : chunks;
    const results = {
      ok: 0,
      fail: 0,
      sent_parts: 0,
      errors: [],
      note: WA_SESSION_NOTE,
    };
    for (const phone of phones) {
      try {
        for (const part of parts) {
          await sendText(phone, part);
          results.sent_parts += 1;
          await sleep(120);
        }
        results.ok += 1;
      } catch (err) {
        results.fail += 1;
        if (results.errors.length < 20) {
          results.errors.push({ phone, error: err.message || 'send failed' });
        }
      }
      await sleep(150);
    }
    res.json({
      ...results,
      sent_to: phones.length,
      tip: 'Text menu from live prices. Same 24h WhatsApp window as other free-form messages.',
    });
  });

  app.get('/admin/api/overview', auth, async (_req, res) => {
    const db = getDb();
    const orders = await db.listOrders(300);
    const dishes = await db.listAllDishes();
    const feedbacks = await db.listFeedbacks(30);
    const tickets = await db.listHelpTickets(30);
    const customers = await db.listCustomers(500);

    const today = todayIsoIst();
    const paidLike = new Set(['paid', 'preparing', 'out_for_delivery', 'delivered']);

    let revenueToday = 0;
    let ordersToday = 0;
    let pendingPayment = 0;
    let kitchen = 0;
    let out = 0;

    for (const o of orders) {
      if (isSameDayIst(o.created_at) || o.service_date === today) {
        ordersToday += 1;
        if (paidLike.has(o.status)) revenueToday += o.total_paise || 0;
      }
      if (o.status === 'pending_payment') pendingPayment += 1;
      if (o.status === 'paid' || o.status === 'preparing') kitchen += 1;
      if (o.status === 'out_for_delivery') out += 1;
    }

    const lowStock = dishes.filter(
      (d) => d.active && Math.max(0, d.max_portions - d.portions_sold) <= 3,
    ).length;

    res.json({
      business: config.businessName,
      driver: db.driver || 'json',
      today,
      stats: {
        revenue_today_paise: revenueToday,
        orders_today: ordersToday,
        pending_payment: pendingPayment,
        kitchen,
        out_for_delivery: out,
        customers: customers.length,
        open_helps: tickets.length,
        low_stock: lowStock,
        avg_rating:
          feedbacks.length > 0
            ? Number(
                (
                  feedbacks.reduce((s, f) => s + (Number(f.average_rating) || 0), 0) /
                  feedbacks.length
                ).toFixed(2),
              )
            : null,
      },
      categories: CATEGORIES,
    });
  });

  app.get('/admin/api/orders', auth, async (req, res) => {
    const limit = Math.min(500, Math.max(20, Number(req.query.limit) || 200));
    res.json({
      business: config.businessName,
      orders: await getDb().listOrders(limit),
    });
  });

  /** Offline / phone order — creates same shape as WhatsApp finalizeOrder. */
  app.post('/admin/api/orders', auth, async (req, res) => {
    try {
      const result = await createManualOrder(req.body || {});
      if (!result.ok) {
        res.status(400).json({ error: result.error || 'Could not create order' });
        return;
      }
      res.json(result);
    } catch (err) {
      console.error('Manual order create failed', err);
      res.status(500).json({ error: err.message || 'Manual order failed' });
    }
  });

  app.get('/admin/api/dishes', auth, async (_req, res) => {
    const dishes = (await getDb().listAllDishes()).map((d) => ({
      ...d,
      has_image: dishHasImage(d.code),
      image_url: dishImagePublicUrl(d.code) || null,
    }));
    res.json({ dishes, categories: CATEGORIES });
  });

  app.put(
    '/admin/api/dishes/:code/image',
    auth,
    express.raw({
      type: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/octet-stream'],
      limit: '5mb',
    }),
    (req, res) => {
      try {
        const mime = String(req.headers['content-type'] || 'image/jpeg').split(';')[0].trim();
        const saved = saveDishImage(req.params.code, { buffer: req.body, mime });
        res.json({
          ok: true,
          code: saved.code,
          has_image: true,
          image_url: dishImagePublicUrl(saved.code),
          bytes: saved.bytes,
        });
      } catch (err) {
        res.status(400).json({ error: err.message || 'Upload failed' });
      }
    },
  );

  app.delete('/admin/api/dishes/:code/image', auth, (req, res) => {
    const result = deleteDishImage(req.params.code);
    res.json({ ok: true, ...result, image_url: null });
  });

  app.post('/admin/api/dishes/:code/stock', auth, async (req, res) => {
    const max = Number(req.body?.max_portions);
    if (!Number.isFinite(max) || max < 0) {
      res.status(400).json({ error: 'max_portions must be a number >= 0' });
      return;
    }
    const dish = await getDb().setDishStock(req.params.code, max);
    if (!dish) {
      res.status(404).json({ error: 'Dish not found' });
      return;
    }
    res.json({ dish });
  });

  app.post('/admin/api/dishes/:code/active', auth, async (req, res) => {
    const dish = await getDb().setDishActive(req.params.code, Boolean(req.body?.active));
    if (!dish) {
      res.status(404).json({ error: 'Dish not found' });
      return;
    }
    res.json({ dish });
  });

  /** Push active dishes to Meta WhatsApp Catalog (retailer_id = dish code). */
  app.get('/admin/api/catalog/status', auth, async (_req, res) => {
    try {
      const { resolveCatalogId, resolveCatalogImageUrl } = await import('../catalog/sync.js');
      const catalogId = await resolveCatalogId();
      res.json({
        ok: true,
        configured: Boolean(catalogId),
        catalog_id: catalogId || null,
        image_url: resolveCatalogImageUrl() || null,
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message || 'Catalog status failed' });
    }
  });

  app.post('/admin/api/catalog/sync', auth, async (_req, res) => {
    try {
      const { syncMenuToCatalog } = await import('../catalog/sync.js');
      const result = await syncMenuToCatalog();
      const status = result.ok ? 200 : 400;
      res.status(status).json(result);
    } catch (err) {
      res.status(500).json({
        ok: false,
        synced: 0,
        deleted: 0,
        skipped: 0,
        errors: [err.message || 'Catalog sync failed'],
        error: err.message || 'Catalog sync failed',
      });
    }
  });

  app.post('/admin/api/dishes', auth, async (req, res) => {
    const body = req.body || {};
    const code = String(body.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{2,8}$/.test(code)) {
      res.status(400).json({ error: 'code must be 2–8 letters/numbers (e.g. V01)' });
      return;
    }
    if (!body.name || String(body.name).trim().length < 2) {
      res.status(400).json({ error: 'name required' });
      return;
    }
    const price = Number(body.price_paise ?? Math.round(Number(body.price_rupees || 0) * 100));
    if (!Number.isFinite(price) || price < 0) {
      res.status(400).json({ error: 'invalid price' });
      return;
    }
    let cook_name = String(body.cook_name || '').trim().slice(0, 60);
    let amma_id = body.amma_id ? String(body.amma_id).trim() : null;
    if (amma_id) {
      const a = await getDb().getAmma(amma_id);
      if (a) cook_name = a.name;
    } else if (cook_name) {
      const list = await getDb().listAmmas();
      const hit = list.find((a) => a.name.toLowerCase() === cook_name.toLowerCase());
      if (hit) amma_id = hit.id;
      else {
        const created = await getDb().upsertAmma({ name: cook_name });
        amma_id = created?.id || null;
      }
    } else {
      cook_name = 'Amma Kitchen';
    }
    const dish = await getDb().upsertDish({
      code,
      name: body.name,
      category: body.category || 'veg',
      meal: body.meal || 'both',
      price_paise: price,
      max_portions: body.max_portions ?? 20,
      active: body.active !== false,
      note: body.note || null,
      advance_only: Boolean(body.advance_only),
      cook_name,
      amma_id,
    });
    res.json({ dish });
  });

  app.get('/admin/api/ammas', auth, async (_req, res) => {
    const list = await getDb().listAmmasWithDishes();
    res.json({ ammas: list });
  });

  /** Launch / cart offers (flat discount + free delivery). Both stack when enabled. */
  app.get('/admin/api/offers', auth, async (_req, res) => {
    const offers = await getDb().listOffers();
    res.json({
      offers,
      kinds: [
        { id: 'flat_discount', label: 'Above ₹X food → ₹Y off' },
        { id: 'free_delivery', label: 'Above ₹X food → free delivery' },
      ],
      note: 'Enabled offers apply automatically at checkout. Multiple enabled offers of each kind stack / compose (discount + free delivery together).',
    });
  });

  app.put('/admin/api/offers', auth, async (req, res) => {
    const body = req.body || {};
    const raw = Array.isArray(body.offers) ? body.offers : null;
    if (!raw) {
      res.status(400).json({ error: 'offers array required' });
      return;
    }
    const offers = await getDb().saveOffers(raw);
    res.json({ ok: true, offers });
  });

  app.post('/admin/api/offers', auth, async (req, res) => {
    const body = req.body || {};
    const list = await getDb().listOffers();
    const next = {
      id: body.id || undefined,
      kind: body.kind,
      enabled: body.enabled !== false,
      title: body.title,
      above_paise:
        body.above_paise != null
          ? Math.round(Number(body.above_paise))
          : body.above_rupees != null
            ? Math.round(Number(body.above_rupees) * 100)
            : 0,
      discount_paise:
        body.discount_paise != null
          ? Math.round(Number(body.discount_paise))
          : body.discount_rupees != null
            ? Math.round(Number(body.discount_rupees) * 100)
            : 0,
    };
    const idx = list.findIndex((o) => o.id === next.id);
    if (idx >= 0) list[idx] = { ...list[idx], ...next };
    else list.push(next);
    const offers = await getDb().saveOffers(list);
    res.json({ ok: true, offers });
  });

  app.post('/admin/api/offers/:id/toggle', auth, async (req, res) => {
    const id = String(req.params.id || '');
    const list = await getDb().listOffers();
    const o = list.find((x) => x.id === id);
    if (!o) {
      res.status(404).json({ error: 'Offer not found' });
      return;
    }
    const want =
      req.body?.enabled != null ? Boolean(req.body.enabled) : !o.enabled;
    o.enabled = want;
    const offers = await getDb().saveOffers(list);
    res.json({ ok: true, offers });
  });

  app.delete('/admin/api/offers/:id', auth, async (req, res) => {
    const id = String(req.params.id || '');
    const list = (await getDb().listOffers()).filter((o) => o.id !== id);
    if (!list.length) {
      res.status(400).json({ error: 'Keep at least one offer row (you can disable it)' });
      return;
    }
    const offers = await getDb().saveOffers(list);
    res.json({ ok: true, offers });
  });

  /** Delivery pricing mode: distance zones vs flat fee (+ optional one-day override). */
  app.get('/admin/api/delivery-settings', auth, async (_req, res) => {
    const { nowIst } = await import('../cutoffs.js');
    const today = nowIst().isoDate;
    const settings = await getDb().getDeliverySettings();
    const effective = await getDb().getEffectiveDeliverySettings(today);
    res.json({
      settings,
      effective,
      today,
      zones: [
        { id: 'z1', title: '0–3 km', fee_paise: 3000 },
        { id: 'z2', title: '3–6 km', fee_paise: 4500 },
        { id: 'z3', title: 'Above 6 km', fee_paise: 6000 },
      ],
      note:
        'Distance = ask customer km band. Flat = one fee for all Tenali that day (no km picker). Free-delivery offers still zero the fee when food threshold met.',
    });
  });

  app.put('/admin/api/delivery-settings', auth, async (req, res) => {
    const body = req.body || {};
    const { nowIst } = await import('../cutoffs.js');
    const today = nowIst().isoDate;
    const current = await getDb().getDeliverySettings();

    let flatPaise = current.flat_paise;
    if (body.flat_paise != null) flatPaise = Math.round(Number(body.flat_paise));
    else if (body.flat_rupees != null) flatPaise = Math.round(Number(body.flat_rupees) * 100);

    let mode = String(body.mode || current.mode || 'distance').toLowerCase();
    if (mode !== 'flat' && mode !== 'distance') mode = 'distance';

    let day_override = current.day_override;
    if (body.clear_day_override === true) {
      day_override = null;
    } else if (body.apply_only_today === true || body.day_override) {
      const d = body.day_override || {};
      const ovMode = String(d.mode || body.mode || mode).toLowerCase() === 'flat' ? 'flat' : 'distance';
      let ovFlat = flatPaise;
      if (d.flat_paise != null) ovFlat = Math.round(Number(d.flat_paise));
      else if (d.flat_rupees != null) ovFlat = Math.round(Number(d.flat_rupees) * 100);
      else if (body.flat_rupees != null) ovFlat = Math.round(Number(body.flat_rupees) * 100);
      day_override = {
        date: String(d.date || body.override_date || today).slice(0, 10),
        mode: ovMode,
        flat_paise: ovFlat,
      };
    } else if (body.day_override === null) {
      day_override = null;
    }

    // When apply_only_today, keep default mode as previous default (don't change permanent) unless set_default also true
    const next = {
      mode: body.set_default === false && body.apply_only_today ? current.mode : mode,
      flat_paise: body.set_default === false && body.apply_only_today ? current.flat_paise : flatPaise,
      day_override,
    };
    if (body.apply_only_today === true && body.set_default !== true) {
      // permanent mode/flat stay current; only day_override changes to request mode/flat
      next.mode = current.mode;
      next.flat_paise = current.flat_paise;
      next.day_override = {
        date: today,
        mode,
        flat_paise: flatPaise,
      };
    }

    const settings = await getDb().saveDeliverySettings(next);
    const effective = await getDb().getEffectiveDeliverySettings(today);
    res.json({ ok: true, settings, effective, today });
  });

  /** Min order + launch date (ops). Min can change default or day-only. */
  app.get('/admin/api/ops-settings', auth, async (_req, res) => {
    const { nowIst } = await import('../cutoffs.js');
    const today = nowIst().isoDate;
    const settings = await getDb().getOpsSettings();
    const minOrderPaise = await getDb().getMinOrderPaise(today);
    res.json({
      settings,
      today,
      effective: {
        min_order_paise: minOrderPaise,
        min_order_rupees: Math.round(minOrderPaise) / 100,
        launch_iso: settings.launch_iso,
        lunch_cutoff_hour: settings.lunch_cutoff_hour,
        dinner_cutoff_hour: settings.dinner_cutoff_hour,
        lunch_cutoff_minute: settings.lunch_cutoff_minute,
        dinner_cutoff_minute: settings.dinner_cutoff_minute,
        saturday_dinner_open: settings.saturday_dinner_open,
        sunday_lunch_open: settings.sunday_lunch_open,
        sunday_dinner_party_open: settings.sunday_dinner_party_open,
        source:
          settings.min_order_day_override?.date === today
            ? 'day_override'
            : 'default',
      },
      note:
        'Min order is food total before checkout. Cutoffs (IST) control Lunch/Dinner order-by times. Sunday lunch, Saturday dinner, and Sunday party dinner are editable here.',
    });
  });

  app.put('/admin/api/ops-settings', auth, async (req, res) => {
    const body = req.body || {};
    const { nowIst } = await import('../cutoffs.js');
    const today = nowIst().isoDate;
    const current = await getDb().getOpsSettings();

    const parseMin = () => {
      if (body.min_order_paise != null) return Math.max(0, Math.round(Number(body.min_order_paise) || 0));
      if (body.min_order_rupees != null) {
        return Math.max(0, Math.round(Number(body.min_order_rupees) * 100) || 0);
      }
      return null;
    };
    const requestedMin = parseMin();

    let min_order_paise = current.min_order_paise;
    let min_order_day_override = current.min_order_day_override;
    let launch_iso = current.launch_iso;

    if (body.launch_iso != null && String(body.launch_iso).trim()) {
      launch_iso = String(body.launch_iso).slice(0, 10);
    }

    if (body.clear_min_order_day_override === true) {
      min_order_day_override = null;
    }

    if (body.apply_min_order_only_today === true && requestedMin != null) {
      min_order_day_override = { date: today, min_order_paise: requestedMin };
      // permanent default unchanged
    } else if (requestedMin != null) {
      min_order_paise = requestedMin;
      if (body.clear_min_order_day_override !== false) {
        // Saving a new default clears today override unless keep_override=true
        if (body.keep_min_order_day_override !== true) min_order_day_override = null;
      }
    }

    // Meal cutoffs + weekend flags (Admin → Offers). Keep current if omitted.
    const lunch_cutoff_hour =
      body.lunch_cutoff_hour != null ? body.lunch_cutoff_hour : current.lunch_cutoff_hour;
    const dinner_cutoff_hour =
      body.dinner_cutoff_hour != null ? body.dinner_cutoff_hour : current.dinner_cutoff_hour;
    const lunch_cutoff_minute =
      body.lunch_cutoff_minute != null ? body.lunch_cutoff_minute : current.lunch_cutoff_minute;
    const dinner_cutoff_minute =
      body.dinner_cutoff_minute != null ? body.dinner_cutoff_minute : current.dinner_cutoff_minute;
    const saturday_dinner_open =
      body.saturday_dinner_open != null
        ? body.saturday_dinner_open
        : current.saturday_dinner_open;
    const sunday_lunch_open =
      body.sunday_lunch_open != null
        ? body.sunday_lunch_open
        : current.sunday_lunch_open;
    const sunday_dinner_party_open =
      body.sunday_dinner_party_open != null
        ? body.sunday_dinner_party_open
        : current.sunday_dinner_party_open;

    const settings = await getDb().saveOpsSettings({
      min_order_paise,
      min_order_day_override,
      launch_iso,
      lunch_cutoff_hour,
      dinner_cutoff_hour,
      lunch_cutoff_minute,
      dinner_cutoff_minute,
      saturday_dinner_open,
      sunday_lunch_open,
      sunday_dinner_party_open,
    });
    const effectivePaise = await getDb().getMinOrderPaise(today);
    res.json({
      ok: true,
      settings,
      today,
      effective: {
        min_order_paise: effectivePaise,
        min_order_rupees: Math.round(effectivePaise) / 100,
        launch_iso: settings.launch_iso,
        lunch_cutoff_hour: settings.lunch_cutoff_hour,
        dinner_cutoff_hour: settings.dinner_cutoff_hour,
        lunch_cutoff_minute: settings.lunch_cutoff_minute,
        dinner_cutoff_minute: settings.dinner_cutoff_minute,
        saturday_dinner_open: settings.saturday_dinner_open,
        sunday_lunch_open: settings.sunday_lunch_open,
        sunday_dinner_party_open: settings.sunday_dinner_party_open,
        source:
          settings.min_order_day_override?.date === today
            ? 'day_override'
            : 'default',
      },
    });
  });

  app.post('/admin/api/ammas', auth, async (req, res) => {
    const body = req.body || {};
    if (!body.name || String(body.name).trim().length < 2) {
      res.status(400).json({ error: 'name required' });
      return;
    }
    let share = body.payout_share_bps;
    if (body.payout_share_pct != null) {
      share = Math.round(Number(body.payout_share_pct) * 100);
    }
    const amma = await getDb().upsertAmma({
      id: body.id,
      name: body.name,
      phone: body.phone,
      active: body.active !== false,
      payout_share_bps: share,
      upi_id: body.upi_id,
      notes: body.notes,
    });
    if (!amma) {
      res.status(400).json({ error: 'Could not save Amma' });
      return;
    }
    res.json({ amma });
  });

  app.get('/admin/api/ammas/earnings', auth, async (req, res) => {
    try {
      const weekStart = req.query.week_start ? String(req.query.week_start) : undefined;
      const weekEnd = req.query.week_end ? String(req.query.week_end) : undefined;
      const data = await getDb().previewAmmaEarnings({ weekStart, weekEnd });
      res.json(data);
    } catch (err) {
      console.error('ammas/earnings failed', err);
      res.status(500).json({ error: 'Could not load Amma earnings preview' });
    }
  });

  app.put('/admin/api/dishes/:code', auth, async (req, res) => {
    const body = req.body || {};
    const code = String(req.params.code || '').toUpperCase();
    const existing = await getDb().getDish(code);
    if (!existing) {
      res.status(404).json({ error: 'Dish not found' });
      return;
    }
    const priceRupees = body.price_rupees != null ? Number(body.price_rupees) : null;
    const price =
      body.price_paise != null
        ? Number(body.price_paise)
        : priceRupees != null
          ? Math.round(priceRupees * 100)
          : existing.price_paise;
    const dish = await getDb().upsertDish({
      ...existing,
      ...body,
      code,
      price_paise: price,
    });
    res.json({ dish });
  });

  app.get('/admin/api/customers', auth, async (req, res) => {
    const limit = Math.min(1000, Math.max(10, Number(req.query.limit) || 300));
    res.json({ customers: await getDb().listCustomers(limit) });
  });

  app.get('/admin/api/feedbacks', auth, async (_req, res) => {
    res.json({ feedbacks: await getDb().listFeedbacks(50) });
  });

  app.get('/admin/api/helps', auth, async (_req, res) => {
    res.json({ tickets: await getDb().listHelpTickets(50) });
  });

  /** WhatsApp conversation list (who contacted + last message). */
  app.get('/admin/api/conversations', auth, async (req, res) => {
    const limit = Math.min(300, Math.max(20, Number(req.query.limit) || 100));
    const q = String(req.query.q || '').trim().toLowerCase();
    let conversations = await getDb().listConversations(limit * 2);
    if (q) {
      conversations = conversations.filter((c) =>
        [c.phone, c.customer_name, c.profile_name, c.last_body]
          .join(' ')
          .toLowerCase()
          .includes(q),
      );
    }
    res.json({
      conversations: conversations.slice(0, limit),
      note: 'History starts when this feature was deployed. In + out messages for the bot number only.',
    });
  });

  /** Full thread for one WhatsApp number. */
  app.get('/admin/api/conversations/:phone', auth, async (req, res) => {
    const phone = String(req.params.phone || '').replace(/\D/g, '');
    if (phone.length < 10) {
      res.status(400).json({ error: 'Invalid phone' });
      return;
    }
    const limit = Math.min(500, Math.max(20, Number(req.query.limit) || 200));
    const messages = await getDb().listMessagesForPhone(phone, limit);
    const cust = await getDb().getCustomer(phone);
    res.json({
      phone,
      customer_name: cust?.name || null,
      messages,
    });
  });

  app.post('/admin/api/orders/:ref/status', auth, async (req, res) => {
    const status = String(req.body?.status || '').trim();
    const notify = req.body?.notify !== false;
    const extra = {};
    if (req.body?.track_map_url != null) {
      extra.track_map_url = String(req.body.track_map_url).trim();
    }
    if (req.body?.delivery_contact != null) {
      extra.delivery_contact = String(req.body.delivery_contact).replace(/\D/g, '');
    }
    if (req.body?.eta_minutes != null) extra.eta_minutes = Number(req.body.eta_minutes);
    if (status === 'paid') {
      // Admin "Mark paid" = money already received (not door COD).
      extra.paid_via = 'admin';
      extra.payment_method = 'prepaid';
      extra.cod_due_paise = 0;
      extra.cash_confirmed_at = new Date().toISOString();
      extra.cod_collected_paise = null;
    }
    const result = await applyOrderStatus(req.params.ref, status, {
      notifyCustomer: notify,
      extra,
    });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result);
  });

  app.post('/admin/api/orders/:ref/send-to-rider', auth, async (req, res) => {
    const ref = String(req.params.ref || '').trim().toUpperCase();
    const order = await getDb().findOrderByRef(ref);
    if (!order) {
      res.status(404).json({ error: `Order ${ref} not found` });
      return;
    }
    if (!(config.riderPhones || []).length) {
      res.status(400).json({ error: 'RIDER_PHONES not configured on server' });
      return;
    }
    try {
      const sent_to = await sendOrderToRiders(order);
      res.json({ ok: true, order_ref: ref, sent_to, riders: config.riderPhones });
    } catch (err) {
      res.status(502).json({ error: err.message || 'WhatsApp send to rider failed' });
    }
  });

  /**
   * Broadcast text to customers (WhatsApp Cloud API).
   * Meta only delivers free-form text inside the 24h customer care window.
   * This is NOT a WhatsApp Community — communities cannot be managed via Cloud API.
   * body: { message, phones?: string[], audience?: 'all'|'ordered'|'recent', personal?: boolean }
   */
  app.post('/admin/api/broadcast', auth, async (req, res) => {
    const personal = req.body?.personal === true;
    const message = String(req.body?.message || '').trim();
    const maxLen = personal ? 4096 : 900;
    if (message.length < (personal ? 1 : 3) || message.length > maxLen) {
      res.status(400).json({
        error: personal
          ? `message must be 1–${maxLen} characters`
          : 'message must be 3–900 characters',
      });
      return;
    }

    const db = getDb();
    let phones = Array.isArray(req.body?.phones)
      ? req.body.phones.map((p) => String(p).replace(/\D/g, '')).filter(Boolean)
      : [];

    if (!phones.length) {
      const audience = String(req.body?.audience || 'all');
      const customers = await db.listCustomers(500);
      if (audience === 'ordered') {
        phones = customers.filter((c) => (c.order_count || 0) > 0).map((c) => c.phone);
      } else if (audience === 'recent') {
        const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
        phones = customers
          .filter((c) => c.last_order_at && new Date(c.last_order_at).getTime() >= weekAgo)
          .map((c) => c.phone);
      } else {
        phones = customers.map((c) => c.phone);
      }
    }

    phones = [...new Set(phones)].slice(0, 200);
    if (!phones.length) {
      res.status(400).json({ error: 'No recipients matched' });
      return;
    }

    const results = { ok: 0, fail: 0, errors: [] };
    for (const phone of phones) {
      try {
        await sendCustomerMessage(phone, message, { personal });
        results.ok += 1;
      } catch (err) {
        results.fail += 1;
        if (results.errors.length < 15) {
          results.errors.push({ phone, error: err.message || 'send failed' });
        }
      }
      await sleep(120);
    }

    res.json({
      ...results,
      sent_to: phones.length,
      note: WA_SESSION_NOTE,
    });
  });

  /** Daily / range cashbook — expenses, manual cash, opening backlog + order rollup */
  app.get('/admin/api/cashbook', auth, async (req, res) => {
    try {
      const { cashbookDaySummary, cashbookRangeSummary, CASHBOOK_KINDS } = await import('../cashbook.js');
      const kind = String(req.query.kind || 'all').slice(0, 40);
      const from = String(req.query.from || '').slice(0, 10);
      const to = String(req.query.to || '').slice(0, 10);
      const day = String(req.query.date || '').slice(0, 10);
      let summary;
      if (/^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to || from)) {
        summary = await cashbookRangeSummary({ from, to: to || from, kind });
      } else {
        summary = await cashbookDaySummary(day || todayIsoIst(), { kind });
      }
      res.json({ ok: true, kinds: CASHBOOK_KINDS, ...summary });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message || 'Cashbook failed' });
    }
  });

  app.post('/admin/api/cashbook', auth, async (req, res) => {
    try {
      const { addCashbookEntry, cashbookDaySummary, CASHBOOK_KINDS } = await import('../cashbook.js');
      const amountIn = req.body?.amount_paise != null
        ? Number(req.body.amount_paise)
        : Math.round(Number(req.body?.amount_rupees || 0) * 100);
      const entry = await addCashbookEntry({
        entry_date: req.body?.entry_date || todayIsoIst(),
        kind: req.body?.kind,
        amount_paise: amountIn,
        note: req.body?.note,
        order_ref: req.body?.order_ref,
        created_by: req.body?.created_by || 'admin',
      });
      const summary = await cashbookDaySummary(entry.entry_date);
      res.json({ ok: true, entry, kinds: CASHBOOK_KINDS, ...summary });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message || 'Could not add entry' });
    }
  });

  app.delete('/admin/api/cashbook/:id', auth, async (req, res) => {
    try {
      const { deleteCashbookEntry, cashbookRangeSummary, cashbookDaySummary } = await import('../cashbook.js');
      const ok = await deleteCashbookEntry(req.params.id);
      if (!ok) {
        res.status(404).json({ ok: false, error: 'Entry not found' });
        return;
      }
      const from = String(req.query.from || '').slice(0, 10);
      const to = String(req.query.to || '').slice(0, 10);
      const day = String(req.query.date || todayIsoIst()).slice(0, 10);
      const kind = String(req.query.kind || 'all').slice(0, 40);
      const summary =
        /^\d{4}-\d{2}-\d{2}$/.test(from)
          ? await cashbookRangeSummary({ from, to: to || from, kind })
          : await cashbookDaySummary(day, { kind });
      res.json({ ok: true, ...summary });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message || 'Delete failed' });
    }
  });
}
