/**
 * Signed WhatsApp → /fresh deep links (HMAC).
 * Token pre-fills phone for ~48 hours; verified by GET /api/storefront/session.
 */

import crypto from 'node:crypto';
import { config } from '../config.js';
import { getDb } from '../db.js';

const DEFAULT_TTL_SEC = 48 * 60 * 60;

function linkSecret() {
  return String(
    process.env.STOREFRONT_LINK_SECRET || config.adminToken || 'acr-fresh-storefront',
  );
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromB64url(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = String(s).replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(b64, 'base64');
}

function sign(payloadB64) {
  return b64url(crypto.createHmac('sha256', linkSecret()).update(payloadB64).digest());
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** @param {string} phone E.164-ish digits */
export function createStorefrontToken(phone, ttlSec = DEFAULT_TTL_SEC) {
  let p = String(phone || '').replace(/\D/g, '');
  if (p.length === 10) p = `91${p}`;
  if (p.length < 12) throw new Error('Invalid phone for storefront token');
  const exp = Math.floor(Date.now() / 1000) + Math.max(60, Number(ttlSec) || DEFAULT_TTL_SEC);
  const payloadB64 = b64url(JSON.stringify({ p, exp }));
  return `${payloadB64}.${sign(payloadB64)}`;
}

/** @returns {{ phone: string, exp: number } | null} */
export function verifyStorefrontToken(token) {
  const raw = String(token || '').trim();
  const i = raw.lastIndexOf('.');
  if (i < 1) return null;
  const payloadB64 = raw.slice(0, i);
  const sig = raw.slice(i + 1);
  if (!safeEqual(sign(payloadB64), sig)) return null;
  try {
    const obj = JSON.parse(fromB64url(payloadB64).toString('utf8'));
    const phone = String(obj.p || '').replace(/\D/g, '');
    const exp = Number(obj.exp) || 0;
    if (phone.length < 12 || exp < Math.floor(Date.now() / 1000)) return null;
    return { phone, exp };
  } catch {
    return null;
  }
}

export function storefrontFreshUrl(phone) {
  const base = String(config.publicBaseUrl || '').replace(/\/$/, '');
  const t = createStorefrontToken(phone);
  return `${base}/fresh?t=${encodeURIComponent(t)}`;
}

/** Post-delivery rating page (overall stars + comment — not per-item). */
export function storefrontFeedbackUrl(phone, orderRef = '') {
  const base = String(config.publicBaseUrl || '').replace(/\/$/, '');
  const t = createStorefrontToken(phone);
  const ref = String(orderRef || '').trim().toUpperCase();
  let url = `${base}/fresh/feedback?t=${encodeURIComponent(t)}`;
  if (ref) url += `&ref=${encodeURIComponent(ref)}`;
  return url;
}

/** Help / ticket page. */
export function storefrontHelpUrl(phone, orderRef = '') {
  const base = String(config.publicBaseUrl || '').replace(/\/$/, '');
  const t = createStorefrontToken(phone);
  const ref = String(orderRef || '').trim().toUpperCase();
  let url = `${base}/fresh/help?t=${encodeURIComponent(t)}`;
  if (ref) url += `&ref=${encodeURIComponent(ref)}`;
  return url;
}

export async function sessionFromStorefrontToken(token) {
  const v = verifyStorefrontToken(token);
  if (!v) return null;
  let name = null;
  try {
    const cust = await getDb().getCustomer(v.phone);
    name = cust?.name || null;
  } catch {
    /* ignore */
  }
  return { phone: v.phone, name, exp: v.exp };
}
