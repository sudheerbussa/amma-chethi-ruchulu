import { getDb } from '../db.js';
import { config } from '../config.js';
import { applyOrderStatus, paymentThanksMessage } from '../orders/status.js';
import {
  orderAcceptsOnlinePayment,
  onlinePaymentAmountPaise,
} from '../orders/fulfillment-pay.js';
import { resolveFromRoot } from '../paths.js';
import { sendText } from '../whatsapp.js';
import {
  createRazorpayOrder,
  isRazorpayReady,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from '../razorpay.js';

async function markOrderPaidFromRazorpay(order, { razorpay_order_id, razorpay_payment_id }) {
  const onlinePaidExtra = {
    razorpay_order_id,
    razorpay_payment_id,
    paid_via: 'razorpay',
    payment_method: 'online',
    paid_at: new Date().toISOString(),
    prepaid_paise: Math.max(0, Math.round(Number(order.total_paise) || 0)),
  };
  if (['paid', 'preparing', 'shipped', 'ready_for_pickup', 'delivered'].includes(order.status)) {
    return { ok: true, already: true, order_ref: order.order_ref, status: order.status };
  }
  if (order.status !== 'pending_payment') {
    return { ok: false, error: `Order ${order.order_ref} cannot move to paid from ${order.status}` };
  }
  const result = await applyOrderStatus(order.order_ref, 'paid', {
    notifyCustomer: true,
    extra: onlinePaidExtra,
  });
  if (!result.ok) return { ok: false, error: result.error || 'Could not mark paid' };
  return { ok: true, already: false, order_ref: order.order_ref, status: 'paid' };
}

async function findOrderForRazorpay({ orderRef, razorpay_order_id }) {
  const db = getDb();
  let order = null;
  let ref = String(orderRef || '').trim().toUpperCase();
  if (ref) order = await db.findOrderByRef(ref);
  if (!order && razorpay_order_id) {
    const orders = await db.listOrders(200);
    order = orders.find((o) => o.razorpay_order_id === razorpay_order_id) || null;
    if (order) ref = order.order_ref;
  }
  return { order, orderRef: ref || null };
}

function orderBreakdown(order) {
  if (!order) return null;
  const items = Array.isArray(order.items)
    ? order.items.map((i) => ({
        code: i.code,
        name: i.name || i.code,
        qty: i.qty || 1,
        unit_price_paise: i.unit_price_paise || 0,
        line_paise: (i.unit_price_paise || 0) * (i.qty || 1),
      }))
    : [];
  return {
    order_ref: order.order_ref,
    status: order.status,
    items,
    food_paise: order.food_paise,
    delivery_fee_paise: order.delivery_fee_paise || 0,
    discount_paise: Number(order.discount_paise) || 0,
    free_delivery: Boolean(order.free_delivery),
    delivery_label: order.delivery_label || order.fulfillment,
    fulfillment: order.fulfillment,
    total_paise: order.total_paise,
    customer_name: order.customer_name,
  };
}

export function mountPayments(app) {
  app.get('/pay/:orderRef', (req, res) => {
    if (!isRazorpayReady()) {
      res
        .status(503)
        .send('Online payment is not configured yet. Please WhatsApp us to complete your order.');
      return;
    }
    res.sendFile(resolveFromRoot('public', 'pay.html'));
  });

  app.get('/api/pay-info/:orderRef', async (req, res) => {
    const orderRef = String(req.params.orderRef || '').trim().toUpperCase();
    const order = await getDb().findOrderByRef(orderRef);
    if (!order) {
      res.status(404).json({ error: `Order ${orderRef} not found` });
      return;
    }
    const payable = orderAcceptsOnlinePayment(order);
    const amount_due_paise = payable ? onlinePaymentAmountPaise(order) : 0;
    res.json({
      business_name: config.businessName,
      razorpay: isRazorpayReady(),
      razorpay_key_id: isRazorpayReady() ? config.razorpayKeyId : null,
      payable,
      amount_due_paise,
      status: order.status,
      ...orderBreakdown(order),
      total_paise: payable ? amount_due_paise : order.total_paise,
    });
  });

  app.post('/api/create-order', async (req, res) => {
    if (!isRazorpayReady()) {
      res.status(503).json({ error: 'Razorpay not configured' });
      return;
    }
    const orderRef = String(req.body?.order_ref || req.body?.orderRef || '').trim().toUpperCase();
    try {
      if (!orderRef) {
        res.status(400).json({ error: 'order_ref required' });
        return;
      }
      const order = await getDb().findOrderByRef(orderRef);
      if (!order) {
        res.status(404).json({ error: `Order ${orderRef} not found` });
        return;
      }
      if (!orderAcceptsOnlinePayment(order)) {
        res.status(400).json({ error: `Order is ${order.status} — not payable` });
        return;
      }
      const amountPaise = onlinePaymentAmountPaise(order);
      const rp = await createRazorpayOrder({
        amountPaise,
        receipt: order.order_ref,
        notes: { order_ref: order.order_ref, phone: order.phone },
      });
      await getDb().patchOrder(order.order_ref, { razorpay_order_id: rp.order_id });
      res.json({
        key_id: config.razorpayKeyId,
        order_id: rp.order_id,
        amount: rp.amount,
        currency: rp.currency,
        order_ref: order.order_ref,
        name: order.customer_name,
        prefill: { name: order.customer_name, contact: order.phone },
        breakdown: orderBreakdown(order),
      });
    } catch (err) {
      console.error('create-order', err);
      res.status(err.status || 500).json({ error: err.message || 'Payment init failed' });
    }
  });

  app.post('/api/verify-payment', async (req, res) => {
    const {
      order_ref,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body || {};
    if (!verifyPaymentSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature })) {
      res.status(400).json({ error: 'Invalid payment signature' });
      return;
    }
    const { order } = await findOrderForRazorpay({
      orderRef: order_ref,
      razorpay_order_id,
    });
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    const result = await markOrderPaidFromRazorpay(order, {
      razorpay_order_id,
      razorpay_payment_id,
    });
    if (!result.ok) {
      res.status(400).json(result);
      return;
    }
    res.json({
      ok: true,
      already: result.already,
      order_ref: result.order_ref,
      status: result.status,
      message: paymentThanksMessage((await getDb().findOrderByRef(result.order_ref)) || order),
    });
  });

  app.post('/api/razorpay-webhook', async (req, res) => {
    const signature = req.get('x-razorpay-signature');
    const raw = req.rawBody;
    if (config.razorpayWebhookSecret) {
      if (!verifyWebhookSignature(raw, signature)) {
        res.status(400).json({ error: 'Invalid webhook signature' });
        return;
      }
    }
    try {
      const event = typeof req.body === 'object' ? req.body : JSON.parse(String(raw || '{}'));
      if (event?.event === 'payment.captured') {
        const entity = event.payload?.payment?.entity;
        const razorpay_order_id = entity?.order_id;
        const razorpay_payment_id = entity?.id;
        const { order } = await findOrderForRazorpay({ razorpay_order_id });
        if (order) {
          await markOrderPaidFromRazorpay(order, { razorpay_order_id, razorpay_payment_id });
        }
      }
      res.json({ ok: true });
    } catch (err) {
      console.error('webhook', err);
      res.status(500).json({ error: 'webhook failed' });
    }
  });
}
