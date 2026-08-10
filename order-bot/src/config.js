import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env from project root (works for `node src/index.js` and `node dist/server.js`)
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env') });

function required(name, fallback = '') {
  const v = process.env[name];
  if (v === undefined || v === null || v === '') return fallback;
  return v;
}

function phoneList(raw) {
  return String(raw || '')
    .split(/[,\s]+/)
    .map((p) => p.replace(/\D/g, ''))
    .filter(Boolean);
}

function truthyFlag(raw) {
  return ['1', 'true', 'yes', 'on'].includes(String(raw || '').trim().toLowerCase());
}

const nodeEnv = required('NODE_ENV', 'development');
const isProduction = nodeEnv === 'production';

export const config = {
  port: Number(required('PORT', '3000')),
  nodeEnv,
  isProduction,
  verifyToken: required('WHATSAPP_VERIFY_TOKEN', 'amma_chethi_verify_change_me'),
  accessToken: required('WHATSAPP_ACCESS_TOKEN'),
  phoneNumberId: required('WHATSAPP_PHONE_NUMBER_ID'),
  apiVersion: required('WHATSAPP_API_VERSION', 'v21.0'),
  databasePath: required('DATABASE_PATH', './data/orders.json'),
  /**
   * Postgres connection string.
   * Production (NODE_ENV=production): required unless ALLOW_JSON_DB=1.
   * Local/dev: optional — empty falls back to JSON file.
   */
  databaseUrl: required('DATABASE_URL', ''),
  /** Emergency only: allow JSON store when NODE_ENV=production without DATABASE_URL */
  allowJsonDb: truthyFlag(required('ALLOW_JSON_DB', '0')),
  businessName: required('BUSINESS_NAME', 'Amma Chethi Ruchulu'),
  supportPhone: required('SUPPORT_PHONE', '918886128995'),
  lunchCutoffHour: Number(required('LUNCH_CUTOFF_HOUR', '10')),
  dinnerCutoffHour: Number(required('DINNER_CUTOFF_HOUR', '16')),
  /**
   * Seed minimum food total (paise) when ops-settings not yet saved.
   * Live changes: Admin → Offers → Min order (not redeploy).
   */
  minOrderPaise: Number(required('MIN_ORDER_PAISE', '0')),
  freeDeliveryAbovePaise: Number(required('FREE_DELIVERY_ABOVE_PAISE', '30000')),
  /** Only true when BYPASS_CUTOFFS is 1/true/yes — '0' or empty = real cutoffs */
  bypassCutoffs: truthyFlag(required('BYPASS_CUTOFFS', '0')),
  upiId: required('UPI_ID', '8308354229@ybl'),
  upiPayeeName: required('UPI_PAYEE_NAME', 'LAKSHMI PENUMAKA'),
  upiQrPath: required('UPI_QR_PATH', './assets/upi-qr.jpeg'),
  /**
   * When Razorpay is configured, also offer UPI QR + manual PAID.
   * Default off — Razorpay-only is cleaner on VPS. Set UPI_FALLBACK=1 to enable.
   * If Razorpay keys are empty, UPI is the only payment path (always on).
   */
  upiFallback: truthyFlag(required('UPI_FALLBACK', '0')),
  /** Razorpay Standard Checkout (test or live keys). Empty = UPI-only. */
  razorpayKeyId: required('RAZORPAY_KEY_ID', ''),
  razorpayKeySecret: required('RAZORPAY_KEY_SECRET', ''),
  /** Dashboard → Webhooks → Secret (optional but recommended for production). */
  razorpayWebhookSecret: required('RAZORPAY_WEBHOOK_SECRET', ''),
  /** Public site base for WhatsApp pay links, e.g. https://order.ammachethiruchulu.co.in */
  publicBaseUrl: required('PUBLIC_BASE_URL', 'https://order.ammachethiruchulu.co.in'),
  /**
   * WhatsApp Community invite link (chat.whatsapp.com/…).
   * When set, bot soft-invites after pay / delivery / feedback (24h session).
   * Leave empty until you create the community and paste the link.
   */
  communityInviteUrl: required('WHATSAPP_COMMUNITY_LINK', ''),
  adminPhones: phoneList(required('ADMIN_PHONES', '918055292935,918886128995')),
  /** Admin login username (default superadmin). Password = ADMIN_TOKEN. */
  adminUser: required('ADMIN_USER', 'superadmin'),
  adminToken: required('ADMIN_TOKEN', 'amma-local-admin'),
};
