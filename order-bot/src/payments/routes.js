import { getDb } from '../db.js';
import { config } from '../config.js';
import { applyOrderStatus } from '../orders/status.js';
import { resolveFromRoot } from '../paths.js';
import {
  createRazorpayOrder,
  isRazorpayReady,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from '../razorpay.js';

/** Mark ACR order paid + WhatsApp thanks (idempotent if already paid). */
async function markOrderPaidFromRazorpay(order, { razorpay_order_id, razorpay_payment_id }) {
  if (
    order.status === 'paid' ||
    order.status === 'preparing' ||
    order.status === 'out_for_delivery' ||
    order.status === 'delivered'
  ) {
    return { ok: true, already: true, order_ref: order.order_ref, status: order.status };
  }
  if (order.status !== 'pending_payment') {
    return {
      ok: false,
      error: `Order ${order.order_ref} cannot move to paid from ${order.status}`,
    };
  }
  const result = await applyOrderStatus(order.order_ref, 'paid', {
    notifyCustomer: true,
    extra: {
      razorpay_order_id,
      razorpay_payment_id,
      paid_via: 'razorpay',
      paid_at: new Date().toISOString(),
    },
  });
  if (!result.ok) {
    return { ok: false, error: result.error || 'Could not mark paid' };
  }
  return { ok: true, already: false, order_ref: order.order_ref, status: 'paid' };
}

async function findOrderForRazorpay({ orderRef, razorpay_order_id }) {
  const db = getDb();
  let order = null;
  let ref = String(orderRef || '').trim().toUpperCase();
  if (ref) order = await db.findOrderByRef(ref);
  if (!order && razorpay_order_id) {
    const orders = await db.listOrders(100);
    order = orders.find((o) => o.razorpay_order_id === razorpay_order_id) || null;
    if (order) ref = order.order_ref;
  }
  return { order, orderRef: ref || null };
}

function orderBreakdown(order) {
  if (!order) return null;
  const items = Array.isArray(order.items) && order.items.length
    ? order.items.map((i) => ({
        code: i.code,
        name: i.name || i.code,
        qty: i.qty || 1,
        unit_price_paise: i.unit_price_paise || 0,
        line_paise: (i.unit_price_paise || 0) * (i.qty || 1),
      }))
    : order.dish_code
      ? [
          {
            code: order.dish_code,
            name: order.dish_name || order.dish_code,
            qty: order.qty || 1,
            unit_price_paise: order.unit_price_paise || 0,
            line_paise: (order.unit_price_paise || 0) * (order.qty || 1),
          },
        ]
      : [];
  const food_paise =
    order.food_paise != null
      ? order.food_paise
      : items.reduce((s, i) => s + i.line_paise, 0);
  const delivery_fee_paise = order.delivery_fee_paise || 0;
  const discount_paise = Number(order.discount_paise) || 0;
  return {
    order_ref: order.order_ref,
    status: order.status,
    items,
    food_paise,
    delivery_fee_paise,
    discount_paise,
    offers_applied: order.offers_applied || null,
    free_delivery: Boolean(order.free_delivery),
    delivery_zone: order.delivery_zone || null,
    delivery_label:
      delivery_fee_paise === 0
        ? order.free_delivery
          ? 'Free delivery (offer)'
          : 'Free delivery'
        : order.delivery_zone === 'z1'
          ? '0–3 km'
          : order.delivery_zone === 'z2'
            ? '3–6 km'
            : order.delivery_zone === 'z3'
              ? 'Above 6 km'
              : 'Delivery',
    total_paise: order.total_paise,
    service_label: order.service_label || null,
    meal: order.meal || null,
  };
}

export function mountPayments(app) {
  app.get('/pay/:orderRef', (req, res) => {
    if (!isRazorpayReady()) {
      res.status(503).send('Online payment is not configured yet. Please pay via UPI on WhatsApp.');
      return;
    }
    res.sendFile(resolveFromRoot('public', 'pay.html'));
  });

  /** Public payment summary (no secrets) for pay page bill split */
  app.get('/api/pay-info/:orderRef', async (req, res) => {
    const orderRef = String(req.params.orderRef || '').trim().toUpperCase();
    const order = await getDb().findOrderByRef(orderRef);
    if (!order) {
      res.status(404).json({ error: `Order ${orderRef} not found` });
      return;
    }
    res.json({
      business_name: config.businessName,
      razorpay: isRazorpayReady(),
      ...orderBreakdown(order),
    });
  });

  /**
   * Create Razorpay order.
   * Body: { order_ref } for a WhatsApp order, OR { amount } paise for sandbox tests.
   */
  app.post('/api/create-order', async (req, res) => {
    if (!isRazorpayReady()) {
      res.status(503).json({ error: 'Razorpay not configured' });
      return;
    }

    const orderRef = String(req.body?.order_ref || req.body?.orderRef || '').trim().toUpperCase();
    const rawAmount = req.body?.amount ?? req.body?.amount_paise;

    try {
      let amountPaise;
      let receipt;
      let notes = {};
      let breakdown = null;
      let customerName = null;

      if (orderRef) {
        const order = await getDb().findOrderByRef(orderRef);
        if (!order) {
          res.status(404).json({ error: `Order ${orderRef} not found` });
          return;
        }
        if (order.status === 'paid' || order.status === 'preparing' || order.status === 'out_for_delivery' || order.status === 'delivered') {
          res.status(400).json({ error: `Order ${orderRef} is already ${order.status}` });
          return;
        }
        if (order.status !== 'pending_payment') {
          res.status(400).json({ error: `Order ${orderRef} cannot be paid (status: ${order.status})` });
          return;
        }
        amountPaise = order.total_paise;
        receipt = order.order_ref;
        breakdown = orderBreakdown(order);
        customerName = order.customer_name || null;
        notes = {
          order_ref: order.order_ref,
          phone: order.phone || '',
          business: config.businessName,
        };
      } else if (rawAmount !== undefined && rawAmount !== null && rawAmount !== '') {
        amountPaise = Math.round(Number(rawAmount));
        receipt = String(req.body?.receipt || `test_${Date.now()}`).slice(0, 40);
      } else {
        res.status(400).json({ error: 'Provide order_ref or amount (paise)' });
        return;
      }

      const created = await createRazorpayOrder({ amountPaise, receipt, notes });

      if (orderRef) {
        await getDb().updateOrderStatus(orderRef, 'pending_payment', {
          razorpay_order_id: created.order_id,
        });
      }

      /** Razorpay contact prefill expects 10-digit Indian mobile when possible */
      let customerPhone = notes.phone || null;
      if (customerPhone) {
        const digits = String(customerPhone).replace(/\D/g, '');
        customerPhone = digits.length >= 10 ? digits.slice(-10) : digits;
      }

      res.json({
        order_id: created.order_id,
        amount: created.amount,
        currency: created.currency,
        key_id: config.razorpayKeyId,
        order_ref: orderRef || null,
        business_name: config.businessName,
        breakdown,
        customer_name: customerName,
        customer_phone: customerPhone,
      });
    } catch (err) {
      console.error('create-order failed', err);
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Failed to create order' });
    }
  });

  /**
   * Verify payment signature and mark ACR order paid when applicable.
   */
  app.post('/api/verify-payment', async (req, res) => {
    if (!isRazorpayReady()) {
      res.status(503).json({ error: 'Razorpay not configured' });
      return;
    }

    const razorpay_order_id = String(req.body?.razorpay_order_id || '').trim();
    const razorpay_payment_id = String(req.body?.razorpay_payment_id || '').trim();
    const razorpay_signature = String(req.body?.razorpay_signature || '').trim();
    let orderRef = String(req.body?.order_ref || req.body?.orderRef || '').trim().toUpperCase();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(400).json({
        ok: false,
        error: 'Missing razorpay_order_id, razorpay_payment_id, or razorpay_signature',
      });
      return;
    }

    if (!verifyPaymentSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature })) {
      res.status(400).json({ ok: false, error: 'Signature mismatch' });
      return;
    }

    const { order } = await findOrderForRazorpay({ orderRef, razorpay_order_id });

    if (!order) {
      // Signature valid but not tied to an ACR order (sandbox amount-only test)
      res.json({
        ok: true,
        paid: true,
        order_ref: null,
        razorpay_payment_id,
        razorpay_order_id,
        message: 'Payment verified (no local order_ref)',
      });
      return;
    }

    const result = await markOrderPaidFromRazorpay(order, {
      razorpay_order_id,
      razorpay_payment_id,
    });
    if (!result.ok) {
      res.status(400).json({ ok: false, error: result.error });
      return;
    }

    res.json({
      ok: true,
      paid: true,
      already: Boolean(result.already),
      order_ref: result.order_ref,
      status: result.status,
      razorpay_payment_id,
      razorpay_order_id,
    });
  });

  /**
   * Server-side payment confirm (does not rely on customer browser).
   * Razorpay Dashboard → Webhooks → URL:
   *   https://order.ammachethiruchulu.co.in/api/razorpay-webhook
   * Events: payment.captured (and optionally order.paid)
   * Secret → RAZORPAY_WEBHOOK_SECRET in .env
   */
  app.post('/api/razorpay-webhook', async (req, res) => {
    if (!isRazorpayReady()) {
      res.status(503).json({ error: 'Razorpay not configured' });
      return;
    }

    const signature = String(req.headers['x-razorpay-signature'] || '');
    const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    if (config.razorpayWebhookSecret) {
      if (!verifyWebhookSignature(raw, signature)) {
        console.error('Razorpay webhook signature mismatch');
        res.status(400).json({ error: 'Invalid signature' });
        return;
      }
    } else {
      console.warn(
        'RAZORPAY_WEBHOOK_SECRET empty — accepting webhook without verify (set secret in production)',
      );
    }

    const event = String(req.body?.event || '');
    let payment = null;
    if (event === 'payment.captured' || event === 'payment.authorized') {
      payment = req.body?.payload?.payment?.entity || null;
    } else if (event === 'order.paid') {
      const orderEntity = req.body?.payload?.order?.entity || null;
      payment = {
        id: '',
        order_id: orderEntity?.id || null,
        notes: orderEntity?.notes || {},
      };
    } else {
      res.json({ ok: true, ignored: event || 'unknown' });
      return;
    }

    const razorpay_order_id = String(payment?.order_id || '').trim();
    const razorpay_payment_id = String(payment?.id || '').trim();
    const notesRef = String(payment?.notes?.order_ref || payment?.notes?.orderRef || '').trim();

    if (!razorpay_order_id && !notesRef) {
      res.json({ ok: true, ignored: true, reason: 'no order link' });
      return;
    }

    try {
      const { order } = await findOrderForRazorpay({
        orderRef: notesRef,
        razorpay_order_id,
      });
      if (!order) {
        console.warn('Razorpay webhook: no local order', {
          event,
          razorpay_order_id,
          notesRef,
        });
        res.json({ ok: true, matched: false });
        return;
      }

      const result = await markOrderPaidFromRazorpay(order, {
        razorpay_order_id: razorpay_order_id || order.razorpay_order_id,
        razorpay_payment_id: razorpay_payment_id || order.razorpay_payment_id || '',
      });
      console.log('Razorpay webhook processed', {
        event,
        order_ref: order.order_ref,
        result,
      });
      res.json({ ok: true, matched: true, ...result });
    } catch (err) {
      console.error('Razorpay webhook handler error', err);
      res.status(500).json({ error: 'Webhook handler failed' });
    }
  });
}
