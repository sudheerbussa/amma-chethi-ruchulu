import crypto from 'node:crypto';
import { config } from './config.js';

const RAZORPAY_ORDERS_URL = 'https://api.razorpay.com/v1/orders';

export function isRazorpayReady() {
  return Boolean(config.razorpayKeyId && config.razorpayKeySecret);
}

function authHeader() {
  const token = Buffer.from(`${config.razorpayKeyId}:${config.razorpayKeySecret}`).toString('base64');
  return `Basic ${token}`;
}

/**
 * Create a Razorpay order. Amount is in paise.
 * Platform minimum is ₹1 (100 paise) — Razorpay will not accept less.
 * receipt is optional (max 40 chars) — use ACR order_ref.
 */
export async function createRazorpayOrder({ amountPaise, receipt, notes = {} }) {
  if (!isRazorpayReady()) {
    const err = new Error('Razorpay keys not configured');
    err.status = 503;
    throw err;
  }

  const amount = Math.round(Number(amountPaise));
  if (!Number.isFinite(amount) || amount < 100) {
    const err = new Error('Amount must be at least 100 paise');
    err.status = 400;
    throw err;
  }

  const payload = {
    amount,
    currency: 'INR',
    notes,
  };
  if (receipt) {
    payload.receipt = String(receipt).slice(0, 40);
  }

  let res;
  try {
    res = await fetch(RAZORPAY_ORDERS_URL, {
      method: 'POST',
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    const e = new Error(err.message || 'Razorpay network error');
    e.status = 500;
    throw e;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.description || data?.error?.reason || `Razorpay API error (${res.status})`;
    const e = new Error(msg);
    e.status = res.status === 401 || res.status === 403 ? 401 : 500;
    e.raw = data;
    throw e;
  }

  return {
    order_id: data.id,
    amount: data.amount,
    currency: data.currency || 'INR',
    receipt: data.receipt || null,
  };
}

function timingSafeEqualHex(a, b) {
  try {
    const bufA = Buffer.from(String(a), 'utf8');
    const bufB = Buffer.from(String(b), 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/** HMAC-SHA256(order_id|payment_id, key_secret) must match razorpay_signature */
export function verifyPaymentSignature({
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
}) {
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return false;
  }
  if (!config.razorpayKeySecret) return false;

  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expected = crypto
    .createHmac('sha256', config.razorpayKeySecret)
    .update(body)
    .digest('hex');

  return timingSafeEqualHex(expected, razorpay_signature);
}

/**
 * Razorpay webhook signature: HMAC-SHA256(raw_body, webhook_secret).
 * Use the secret from Dashboard → Account & Settings → Webhooks.
 */
export function verifyWebhookSignature(rawBody, signature) {
  if (!config.razorpayWebhookSecret || !rawBody || !signature) return false;
  const expected = crypto
    .createHmac('sha256', config.razorpayWebhookSecret)
    .update(rawBody)
    .digest('hex');
  return timingSafeEqualHex(expected, signature);
}

export function publicPayUrl(orderRef) {
  const base = (config.publicBaseUrl || '').replace(/\/$/, '');
  if (!base) return null;
  return `${base}/pay/${encodeURIComponent(String(orderRef).toUpperCase())}`;
}
