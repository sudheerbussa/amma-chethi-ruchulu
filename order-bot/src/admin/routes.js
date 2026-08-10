import { getDb } from '../db.js';
import { config } from '../config.js';
import { applyOrderStatus } from '../orders/status.js';
import { resolveFromRoot } from '../paths.js';
import { CATEGORIES } from '../menu.js';
import { sendText } from '../whatsapp.js';

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
  app.get('/admin', (_req, res) => {
    res.sendFile(resolveFromRoot('public', 'admin.html'));
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

  app.get('/admin/api/dishes', auth, async (_req, res) => {
    res.json({ dishes: await getDb().listAllDishes(), categories: CATEGORIES });
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
        source:
          settings.min_order_day_override?.date === today
            ? 'day_override'
            : 'default',
      },
      note:
        'Min order is food total before checkout. Default applies every day; today-only override for surge. Before launch date customers can only pre-book the first service day. Kitchen: Sunday closed, Saturday dinner closed.',
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

    const settings = await getDb().saveOpsSettings({
      min_order_paise,
      min_order_day_override,
      launch_iso,
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
    const result = await applyOrderStatus(req.params.ref, status, { notifyCustomer: notify });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result);
  });

  /**
   * Broadcast text to customers (WhatsApp Cloud API).
   * Meta only delivers free-form text inside the 24h customer care window.
   * This is NOT a WhatsApp Community — communities cannot be managed via Cloud API.
   * body: { message, phones?: string[], audience?: 'all'|'ordered'|'recent' }
   */
  app.post('/admin/api/broadcast', auth, async (req, res) => {
    const message = String(req.body?.message || '').trim();
    if (message.length < 3 || message.length > 900) {
      res.status(400).json({ error: 'message must be 3–900 characters' });
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

    const prefix = `📢 ${config.businessName}\n\n`;
    const body = (prefix + message).slice(0, 1024);

    const results = { ok: 0, fail: 0, errors: [] };
    for (const phone of phones) {
      try {
        await sendText(phone, body);
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
      note:
        'WhatsApp Cloud API cannot create Communities. Outside the 24h session window, free-form messages fail — use an approved template later for cold promotions.',
    });
  });
}
