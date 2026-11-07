/** Rider session tokens (HMAC). Shared secret across Food + Fresh. */

import crypto from 'node:crypto';
import { config } from '../config.js';

function secret() {
  return String(config.riderSessionSecret || config.adminToken || 'rider-dev-secret');
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromB64url(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

export function hashPin(pin) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pin), salt, 32);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPin(pin, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const actual = crypto.scryptSync(String(pin), salt, expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

/** Issue token valid ~12h. */
export function issueRiderToken(rider, { ttlSec = 12 * 3600 } = {}) {
  const payload = {
    rid: rider.id,
    phone: rider.phone,
    name: rider.name,
    exp: Math.floor(Date.now() / 1000) + ttlSec,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac('sha256', secret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyRiderToken(token) {
  const raw = String(token || '').trim();
  const [body, sig] = raw.split('.');
  if (!body || !sig) return null;
  const expect = b64url(crypto.createHmac('sha256', secret()).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(fromB64url(body).toString('utf8'));
    if (!payload?.rid || !payload?.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function riderId() {
  return 'r_' + crypto.randomBytes(6).toString('hex');
}
