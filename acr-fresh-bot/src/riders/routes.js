/**
 * Rider hub (v1b) + per-app job board.
 * Hub: /rider  · App jobs: /rider/app  · APIs under /rider/api/*
 * Admin rider CRUD / assign / allow-COD under /admin/api/riders*
 */
import { getDb } from '../db.js';
import { config } from '../config.js';
import { resolveFromRoot } from '../paths.js';
import { applyOrderStatus } from '../orders/status.js';
import { sendOrderToRiders, formatRiderDeliveryAlert, orderPinUrl } from '../ops-notify.js';
import { formatLinesText, formatPaise, getOrderLines } from '../orders/cart.js';
import {
  hashPin,
  verifyPin,
  issueRiderToken,
  verifyRiderToken,
  riderId,
} from './session.js';
import { orderCodDuePaise, orderNeedsCashConfirm, orderPrepaidPaise, formatMoneyBrief } from './money.js';

function adminAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token;
  if (!config.adminToken || token !== config.adminToken) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

function riderAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token || req.body?.token;
  const payload = verifyRiderToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Rider login required' });
    return;
  }
  req.rider = payload;
  next();
}

function publicRider(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    active: r.active !== false,
    notes: r.notes || null,
  };
}

function jobDto(order) {
  const due = orderCodDuePaise(order);
  return {
    order_ref: order.order_ref,
    status: order.status,
    phone: order.phone,
    customer_name: order.customer_name || null,
    address: order.address || '',
    pin_url: orderPinUrl(order),
    service_label: order.service_label || order.service_date || order.delivery_slot || null,
    meal: order.meal || null,
    items_text: formatLinesText(getOrderLines(order)),
    items: getOrderLines(order),
    total_paise: order.total_paise || 0,
    total_label: formatPaise(order.total_paise || 0),
    prepaid_paise: orderPrepaidPaise(order),
    cod_due_paise: due,
    cod_due_label: due > 0 ? formatPaise(due) : null,
    cash_confirmed_at: order.cash_confirmed_at || null,
    needs_cash_confirm: orderNeedsCashConfirm(order),
    rider_id: order.rider_id || null,
    rider_name: order.rider_name || null,
    money_brief: formatMoneyBrief(order),
    product: config.adminHubProduct || 'food',
  };
}

async function syncRiderToSister(rider, { pinPlain = null } = {}) {
  const url = String(config.riderSisterSyncUrl || '').replace(/\/$/, '');
  if (!url || !config.adminToken) return { synced: false, skipped: true };
  try {
    const body = {
      id: rider.id,
      name: rider.name,
      phone: rider.phone,
      active: rider.active !== false,
      notes: rider.notes || null,
      pin_hash: rider.pin_hash || undefined,
      pin: pinPlain || undefined,
    };
    const res = await fetch(`${url}/admin/api/riders/sync-receive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.adminToken}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      console.warn('Rider sync to sister failed', res.status, t.slice(0, 200));
      return { synced: false, error: t.slice(0, 200) };
    }
    return { synced: true };
  } catch (err) {
    console.warn('Rider sync to sister error', err.message);
    return { synced: false, error: err.message };
  }
}

export function mountRider(app) {
  /** v1b hub — login + Food / Fresh tiles */
  app.get('/rider', (_req, res) => {
    res.sendFile(resolveFromRoot('public', 'rider-hub.html'));
  });

  /** Per-app job board for this product */
  app.get('/rider/app', (_req, res) => {
    res.sendFile(resolveFromRoot('public', 'rider-app.html'));
  });

  app.get('/rider/api/hub-config', (_req, res) => {
    res.json({
      ok: true,
      product: config.adminHubProduct || 'food',
      foodRiderAppUrl: config.riderFoodAppUrl,
      freshRiderAppUrl: config.riderFreshAppUrl,
      hubUrl: config.riderHubUrl,
      business: config.businessName,
    });
  });

  app.post('/rider/api/login', async (req, res) => {
    try {
      const phone = String(req.body?.phone || '').replace(/\D/g, '');
      const pin = String(req.body?.pin || '').trim();
      if (phone.length < 10 || pin.length < 4) {
        res.status(400).json({ error: 'Phone and PIN required' });
        return;
      }
      const db = getDb();
      const rider = await db.findRiderByPhone(phone);
      if (!rider || rider.active === false) {
        res.status(401).json({ error: 'Unknown rider or inactive' });
        return;
      }
      if (!rider.pin_hash || !verifyPin(pin, rider.pin_hash)) {
        res.status(401).json({ error: 'Invalid PIN' });
        return;
      }
      const token = issueRiderToken(rider);
      res.json({
        ok: true,
        token,
        rider: publicRider(rider),
        foodRiderAppUrl: config.riderFoodAppUrl,
        freshRiderAppUrl: config.riderFreshAppUrl,
        hubUrl: config.riderHubUrl,
      });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Login failed' });
    }
  });

  app.get('/rider/api/me', riderAuth, async (req, res) => {
    const rider = await getDb().findRiderById(req.rider.rid);
    if (!rider || rider.active === false) {
      res.status(401).json({ error: 'Rider inactive' });
      return;
    }
    res.json({ ok: true, rider: publicRider(rider), product: config.adminHubProduct });
  });

  app.get('/rider/api/jobs', riderAuth, async (req, res) => {
    const db = getDb();
    const open = await db.listOrdersForRider(req.rider.rid, {
      statuses: ['paid', 'preparing', 'out_for_delivery'],
      limit: 100,
    });
    const done = await db.listOrdersForRider(req.rider.rid, {
      statuses: ['delivered'],
      limit: 20,
    });
    res.json({
      ok: true,
      product: config.adminHubProduct,
      business: config.businessName,
      open: open.map(jobDto),
      recent_done: done.map(jobDto),
    });
  });

  app.get('/rider/api/jobs/:ref', riderAuth, async (req, res) => {
    const order = await getDb().findOrderByRef(req.params.ref);
    if (!order || order.rider_id !== req.rider.rid) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    res.json({ ok: true, job: jobDto(order) });
  });

  /** Rider marks picked up → out_for_delivery (+ notify customer) */
  app.post('/rider/api/jobs/:ref/pickup', riderAuth, async (req, res) => {
    try {
      const db = getDb();
      const order = await db.findOrderByRef(req.params.ref);
      if (!order || order.rider_id !== req.rider.rid) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }
      if (!['paid', 'preparing', 'out_for_delivery'].includes(order.status)) {
        res.status(400).json({ error: `Cannot pickup from status ${order.status}` });
        return;
      }
      let updated = order;
      if (order.status !== 'out_for_delivery') {
        const result = await applyOrderStatus(order.order_ref, 'out_for_delivery', {
          extra: {
            picked_up_at: new Date().toISOString(),
            picked_up_by_rider_id: req.rider.rid,
          },
        });
        if (!result.ok) {
          res.status(400).json({ error: result.error || 'Pickup failed' });
          return;
        }
        updated = result.order;
      }
      try {
        await sendOrderToRiders(updated);
      } catch {
        /* optional — rider already has portal */
      }
      res.json({ ok: true, job: jobDto(updated) });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Pickup failed' });
    }
  });

  /** COD: confirm cash collected */
  app.post('/rider/api/jobs/:ref/confirm-cash', riderAuth, async (req, res) => {
    try {
      const db = getDb();
      const order = await db.findOrderByRef(req.params.ref);
      if (!order || order.rider_id !== req.rider.rid) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }
      const due = orderCodDuePaise(order);
      if (due <= 0) {
        res.status(400).json({ error: 'No COD due on this order' });
        return;
      }
      let amountPaise = due;
      if (req.body?.amount_rupees != null && req.body.amount_rupees !== '') {
        amountPaise = Math.round(Number(req.body.amount_rupees) * 100);
      } else if (req.body?.amount_paise != null) {
        amountPaise = Math.round(Number(req.body.amount_paise));
      }
      if (!Number.isFinite(amountPaise) || amountPaise < 0) {
        res.status(400).json({ error: 'Invalid cash amount' });
        return;
      }
      const updated = await db.updateOrderStatus(order.order_ref, order.status, {
        cod_collected_paise: amountPaise,
        cash_confirmed_at: new Date().toISOString(),
        cash_confirmed_by_rider_id: req.rider.rid,
      });
      res.json({ ok: true, job: jobDto(updated) });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Cash confirm failed' });
    }
  });

  /** Mark delivered (requires cash confirm when COD due) */
  app.post('/rider/api/jobs/:ref/deliver', riderAuth, async (req, res) => {
    try {
      const db = getDb();
      const order = await db.findOrderByRef(req.params.ref);
      if (!order || order.rider_id !== req.rider.rid) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }
      if (order.status === 'delivered') {
        res.json({ ok: true, job: jobDto(order) });
        return;
      }
      if (order.status !== 'out_for_delivery') {
        res.status(400).json({ error: 'Mark picked up before delivered' });
        return;
      }
      if (orderNeedsCashConfirm(order)) {
        res.status(400).json({ error: 'Confirm cash collected before marking delivered' });
        return;
      }
      const result = await applyOrderStatus(order.order_ref, 'delivered', {
        extra: { delivered_by_rider_id: req.rider.rid },
      });
      if (!result.ok) {
        res.status(400).json({ error: result.error || 'Deliver failed' });
        return;
      }
      res.json({ ok: true, job: jobDto(result.order) });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Deliver failed' });
    }
  });

  // ─── Admin APIs ───────────────────────────────────────────

  app.get('/admin/api/riders', adminAuth, async (_req, res) => {
    const riders = await getDb().listRiders({ activeOnly: false });
    res.json({ ok: true, riders, product: config.adminHubProduct });
  });

  app.post('/admin/api/riders', adminAuth, async (req, res) => {
    try {
      const db = getDb();
      const name = String(req.body?.name || '').trim();
      const phone = String(req.body?.phone || '').replace(/\D/g, '');
      const pin = String(req.body?.pin || '').trim();
      const id = String(req.body?.id || '').trim() || riderId();
      if (!name || phone.length < 10) {
        res.status(400).json({ error: 'Name and phone required' });
        return;
      }
      const existing = await db.findRiderById(id);
      let pin_hash = existing?.pin_hash || '';
      if (pin) {
        if (pin.length < 4) {
          res.status(400).json({ error: 'PIN must be at least 4 digits' });
          return;
        }
        pin_hash = hashPin(pin);
      } else if (!existing) {
        res.status(400).json({ error: 'PIN required for new rider' });
        return;
      }
      const saved = await db.upsertRider({
        id,
        name,
        phone,
        pin_hash,
        active: req.body?.active !== false && req.body?.active !== 0,
        notes: req.body?.notes || null,
      });
      const sync = await syncRiderToSister(saved, { pinPlain: pin || null });
      res.json({ ok: true, rider: publicRider(saved), sync });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Save failed' });
    }
  });

  /** Receive rider upsert from sister app (shared roster). */
  app.post('/admin/api/riders/sync-receive', adminAuth, async (req, res) => {
    try {
      const db = getDb();
      const id = String(req.body?.id || '').trim();
      const name = String(req.body?.name || '').trim();
      const phone = String(req.body?.phone || '').replace(/\D/g, '');
      if (!id || !name || phone.length < 10) {
        res.status(400).json({ error: 'Invalid rider sync payload' });
        return;
      }
      let pin_hash = req.body?.pin_hash ? String(req.body.pin_hash) : null;
      if (!pin_hash && req.body?.pin) pin_hash = hashPin(String(req.body.pin));
      const existing = await db.findRiderById(id);
      const saved = await db.upsertRider({
        id,
        name,
        phone,
        pin_hash: pin_hash || existing?.pin_hash || '',
        active: req.body?.active !== false,
        notes: req.body?.notes || null,
      });
      res.json({ ok: true, rider: publicRider(saved) });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Sync failed' });
    }
  });

  app.post('/admin/api/orders/:ref/assign-rider', adminAuth, async (req, res) => {
    try {
      const db = getDb();
      const order = await db.findOrderByRef(req.params.ref);
      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }
      const riderIdIn = String(req.body?.rider_id || '').trim();
      if (!riderIdIn) {
        const cleared = await db.updateOrderStatus(order.order_ref, order.status, {
          rider_id: null,
          rider_name: null,
          rider_phone: null,
          assigned_at: null,
        });
        res.json({ ok: true, order: cleared });
        return;
      }
      const rider = await db.findRiderById(riderIdIn);
      if (!rider || rider.active === false) {
        res.status(400).json({ error: 'Rider not found or inactive' });
        return;
      }
      const updated = await db.updateOrderStatus(order.order_ref, order.status, {
        rider_id: rider.id,
        rider_name: rider.name,
        rider_phone: rider.phone,
        assigned_at: new Date().toISOString(),
      });
      try {
        const body =
          formatRiderDeliveryAlert(updated, { heading: '🛵 Assigned to you' }) +
          `\n\n${formatMoneyBrief(updated)}\nOpen rider app to pick up.`;
        const { sendText } = await import('../whatsapp.js');
        await sendText(rider.phone, body);
      } catch (err) {
        console.warn('Assign notify failed', err.message);
      }
      res.json({ ok: true, order: updated, rider: publicRider(rider) });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Assign failed' });
    }
  });

  /** Admin: allow collect at door (COD) for unpaid / partial. */
  app.post('/admin/api/orders/:ref/allow-cod', adminAuth, async (req, res) => {
    try {
      const db = getDb();
      const order = await db.findOrderByRef(req.params.ref);
      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }
      const total = Number(order.total_paise) || 0;
      let due = total;
      if (req.body?.cod_due_rupees != null && req.body.cod_due_rupees !== '') {
        due = Math.round(Number(req.body.cod_due_rupees) * 100);
      } else if (req.body?.cod_due_paise != null) {
        due = Math.round(Number(req.body.cod_due_paise));
      }
      if (!Number.isFinite(due) || due < 0) {
        res.status(400).json({ error: 'Invalid COD amount' });
        return;
      }
      const prepaid = Math.max(0, total - due);
      let status = order.status;
      const cashCollected = req.body?.cash_collected === true || due === 0;
      const extra = {
        cod_due_paise: due,
        prepaid_paise: prepaid,
        payment_method: due > 0 ? 'cod' : 'prepaid',
        cod_allowed_at: due > 0 ? new Date().toISOString() : order.cod_allowed_at || null,
        cod_allowed_by: due > 0 ? 'admin' : order.cod_allowed_by || null,
        cash_confirmed_at: cashCollected && due === 0 ? new Date().toISOString() : null,
        cod_collected_paise: cashCollected && due === 0 ? total : null,
      };
      if (due === 0) {
        extra.paid_via =
          order.paid_via === 'razorpay' ? 'razorpay' : order.paid_via === 'whatsapp_paid' ? 'whatsapp_paid' : 'admin';
      }
      let updated;
      if (status === 'pending_payment') {
        const result = await applyOrderStatus(order.order_ref, 'paid', {
          extra: { ...extra, paid_via: due > 0 ? 'cod_pending' : 'admin' },
        });
        if (!result.ok) {
          res.status(400).json({ error: result.error || 'Allow COD failed' });
          return;
        }
        updated = result.order;
      } else {
        updated = await db.updateOrderStatus(order.order_ref, status, extra);
      }
      res.json({ ok: true, order: updated });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Allow COD failed' });
    }
  });
}
