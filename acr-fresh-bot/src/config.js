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

/** Normalize PEM from .env (\n escapes or single-line pasted keys). */
function normalizePem(raw) {
  let s = String(raw || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\\n/g, '\n');
  if (!s.includes('BEGIN') || s.includes('\n')) return s;
  const m = s.match(/-----BEGIN ([^-]+)-----(.+?)-----END \1-----/);
  if (!m) return s;
  const label = m[1];
  const body = m[2].replace(/\s+/g, '');
  const lines = body.match(/.{1,64}/g) || [];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`;
}

function phoneList(raw) {
  return String(raw || '')
    .split(/[,\s]+/)
    .map((p) => p.replace(/\D/g, ''))
    .filter(Boolean);
}

/** True when phone matches allowlist entry (exact or suffix, E.164 digits). */
function phoneMatchesList(phone, list) {
  const p = String(phone || '').replace(/\D/g, '');
  if (!p || !Array.isArray(list) || !list.length) return false;
  return list.some((a) => p === a || p.endsWith(a) || a.endsWith(p));
}

function truthyFlag(raw) {
  return ['1', 'true', 'yes', 'on'].includes(String(raw || '').trim().toLowerCase());
}

const nodeEnv = required('NODE_ENV', 'development');
const isProduction = nodeEnv === 'production';

/** "8-11,17-20" → [{ start: 8, end: 11 }, { start: 17, end: 20 }] (IST hours, end exclusive). */
function parseDeliveryWindows(raw) {
  const out = [];
  for (const part of String(raw || '').split(',')) {
    const m = part.trim().match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
    if (!m) continue;
    const start = Number(m[1]);
    const end = Number(m[2]);
    if (start >= 0 && end <= 24 && end > start) out.push({ start, end });
  }
  return out.sort((a, b) => a.start - b.start);
}

/** "23:30" → 1410 (minutes after midnight IST). */
function parseHm(raw) {
  const m = String(raw || '').trim().match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!m) return 23 * 60 + 30;
  return Math.min(23 * 60 + 59, Number(m[1]) * 60 + Number(m[2] || 0));
}

export const config = {
  port: Number(required('PORT', '3000')),
  nodeEnv,
  isProduction,
  verifyToken: required('WHATSAPP_VERIFY_TOKEN', 'amma_chethi_verify_change_me'),
  accessToken: required('WHATSAPP_ACCESS_TOKEN'),
  phoneNumberId: required('WHATSAPP_PHONE_NUMBER_ID'),
  whatsappWabaId: required('WHATSAPP_WABA_ID', ''),
  foodDatabaseUrl: required('FOOD_DATABASE_URL', required('REFERRAL_DATABASE_URL', '')),
  marketingExcludedPhones: phoneList(required('MARKETING_EXCLUDED_PHONES', '')),
  apiVersion: required('WHATSAPP_API_VERSION', 'v21.0'),
  databasePath: required('DATABASE_PATH', './data/orders.json'),
  /**
   * Postgres connection string.
   * Production (NODE_ENV=production): required unless ALLOW_JSON_DB=1.
   * Local/dev: optional — empty falls back to JSON file.
   */
  databaseUrl: required('DATABASE_URL', ''),
  /** Referral + wallet tables live in the Food DB. Empty = referrals off on Fresh. */
  referralDatabaseUrl: required('REFERRAL_DATABASE_URL', ''),
  /** Sister-brand orders for "new customer" checks (Food DB = referral DB). */
  peerOrdersDatabaseUrl: required('REFERRAL_DATABASE_URL', ''),
  foodWhatsappNumber: required('FOOD_WHATSAPP_NUMBER', '919823583498').replace(/\D/g, ''),
  freshWhatsappNumber: required('FRESH_WHATSAPP_NUMBER', '919392044833').replace(/\D/g, ''),
  /** Emergency only: allow JSON store when NODE_ENV=production without DATABASE_URL */
  allowJsonDb: truthyFlag(required('ALLOW_JSON_DB', '0')),
  businessName: required('BUSINESS_NAME', 'ACR-Fresh'),
  supportPhone: required('SUPPORT_PHONE', '918886128995'),
  lunchCutoffHour: Number(required('LUNCH_CUTOFF_HOUR', '8')),
  dinnerCutoffHour: Number(required('DINNER_CUTOFF_HOUR', '20')),
  /**
   * Seed minimum item total (paise) when ops-settings not yet saved.
   * Live changes: Admin → Offers → Min order (not redeploy).
   * Default ₹100. Hourly slots: Admin ops slot_* fields.
   */
  minOrderPaise: Number(required('MIN_ORDER_PAISE', '10000')),
  freeDeliveryAbovePaise: Number(required('FREE_DELIVERY_ABOVE_PAISE', '30000')),
  /** Only true when BYPASS_CUTOFFS is 1/true/yes — '0' or empty = real cutoffs */
  bypassCutoffs: truthyFlag(required('BYPASS_CUTOFFS', '0')),
  // Pre-planned delivery: customers book from tomorrow (market run in the morning), not same-day.
  deliveryWindows: parseDeliveryWindows(required('DELIVERY_WINDOWS', '8-11,17-20')),
  // Customers ordering at/after this IST time can't pick tomorrow (market list goes out ~5 min later).
  orderCutoffMinutes: parseHm(required('ORDER_CUTOFF_TIME', '23:30')),
  minDaysAhead: Number(required('MIN_DAYS_AHEAD', '1')),
  bookableDays: Number(required('BOOKABLE_DAYS', '2')),
  /** WhatsApp sends the website link for every ordering intent (Flow / buttons off). */
  websiteOrderingOnly: truthyFlag(required('WEBSITE_ORDERING_ONLY', '1')),
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
  /** Public site base for WhatsApp pay links, e.g. https://fresh.ammachethiruchulu.co.in */
  publicBaseUrl: required('PUBLIC_BASE_URL', 'https://fresh.ammachethiruchulu.co.in'),
  /**
   * WhatsApp Community invite link (chat.whatsapp.com/…).
   * Leave empty until produce community exists.
   */
  communityInviteUrl: required('WHATSAPP_COMMUNITY_LINK', ''),
  /**
   * Default Google Maps / live-location URL sent when order is out for delivery.
   * Admin can override per trip or set a permanent pin in Offers → Delivery.
   */
  deliveryTrackMapUrl: required('DELIVERY_TRACK_MAP_URL', ''),
  /** Kitchen base for delivery zone from customer location pin (Chenchupeta, Tenali). */
  kitchenLat: Number(required('KITCHEN_LAT', '16.2428')),
  kitchenLng: Number(required('KITCHEN_LNG', '80.6440')),
  /** Reject pins farther than this (straight-line km). */
  maxDeliveryKm: Number(required('MAX_DELIVERY_KM', '12')),
  adminPhones: phoneList(required('ADMIN_PHONES', '918055292935,918886128995')),
  /**
   * Auto Hi-reminder to admins (08:30 / 19:30 IST). Set ADMIN_PING_REMINDERS=0 to disable.
   */
  adminPingRemindersEnabled: !['0', 'false', 'no', 'off'].includes(
    String(required('ADMIN_PING_REMINDERS', '1')).trim().toLowerCase(),
  ),
  /** Delivery riders — WhatsApp alerts on paid / out for delivery / manual send. */
  riderPhones: phoneList(required('RIDER_PHONES', '')),
  /** Admin login username (default superadmin). Password = ADMIN_TOKEN. */
  adminUser: required('ADMIN_USER', 'superadmin'),
  adminToken: required('ADMIN_TOKEN', ''),
  /**
   * Admin hub app URLs (Food + Fresh). Same ADMIN_TOKEN on both bots recommended.
   * Defaults point at production hosts; override for local (e.g. :3000 / :3001).
   */
  adminFoodAppUrl: required(
    'ADMIN_FOOD_APP_URL',
    'https://order.ammachethiruchulu.co.in/admin/app',
  ),
  adminFreshAppUrl: required(
    'ADMIN_FRESH_APP_URL',
    `${String(required('PUBLIC_BASE_URL', 'https://fresh.ammachethiruchulu.co.in')).replace(/\/$/, '')}/admin/app`,
  ),
  adminHubUrl: required(
    'ADMIN_HUB_URL',
    `${String(required('PUBLIC_BASE_URL', 'https://fresh.ammachethiruchulu.co.in')).replace(/\/$/, '')}/admin`,
  ),
  adminHubProduct: 'fresh',

  /** Rider portal — shared session secret with Food (defaults to ADMIN_TOKEN if empty). */
  riderSessionSecret: required('RIDER_SESSION_SECRET', ''),
  riderHubUrl: required(
    'RIDER_HUB_URL',
    'https://order.ammachethiruchulu.co.in/rider',
  ),
  riderFoodAppUrl: required(
    'RIDER_FOOD_APP_URL',
    'https://order.ammachethiruchulu.co.in/rider/app',
  ),
  riderFreshAppUrl: required(
    'RIDER_FRESH_APP_URL',
    `${String(required('PUBLIC_BASE_URL', 'https://fresh.ammachethiruchulu.co.in')).replace(/\/$/, '')}/rider/app`,
  ),
  riderSisterSyncUrl: required(
    'RIDER_SISTER_SYNC_URL',
    'https://order.ammachethiruchulu.co.in',
  ),

  /**
   * WhatsApp Flows — empty FLOW_ID keeps button-only checkout.
   * Private key PEM (use \n for newlines in .env, or multiline quoted).
   */
  whatsappFlowId: required('WHATSAPP_FLOW_ID', ''),
  whatsappFlowPrivateKey: normalizePem(required('WHATSAPP_FLOW_PRIVATE_KEY', '')),
  whatsappFlowPassphrase: required('WHATSAPP_FLOW_PASSPHRASE', ''),
  /** published (default) or draft — draft only works while Flow is unpublished in Meta. */
  whatsappFlowMode: (() => {
    const m = String(required('WHATSAPP_FLOW_MODE', 'published')).trim().toLowerCase();
    return m === 'draft' ? 'draft' : 'published';
  })(),
  /**
   * Comma-separated E.164 phones allowed to receive Order form.
   * Empty = everyone (when FLOW_ID set). Non-empty = testers only; others get buttons.
   */
  whatsappFlowAllowlist: phoneList(required('WHATSAPP_FLOW_ALLOWLIST', '')),

  /** Meta Commerce catalog id linked to this WABA (Catalog sync). */
  whatsappCatalogId: required('WHATSAPP_CATALOG_ID', ''),
  /**
   * Public HTTPS image for every Catalog product (Meta requires image_url).
   * Defaults to /media/catalog-default (full_menu poster) when unset.
   */
  catalogDefaultImageUrl: required(
    'WHATSAPP_CATALOG_IMAGE_URL',
    `${String(required('PUBLIC_BASE_URL', 'https://fresh.ammachethiruchulu.co.in')).replace(/\/$/, '')}/media/catalog-default`,
  ),
};

/** Whether this WhatsApp user may receive sendFlow (allowlist gate). */
export function isWhatsappFlowAllowed(phone) {
  if (!config.whatsappFlowId) return false;
  const list = config.whatsappFlowAllowlist;
  if (!list.length) return true;
  return phoneMatchesList(phone, list);
}
