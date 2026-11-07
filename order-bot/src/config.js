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

export const config = {
  port: Number(required('PORT', '3000')),
  nodeEnv,
  isProduction,
  verifyToken: required('WHATSAPP_VERIFY_TOKEN', 'amma_chethi_verify_change_me'),
  accessToken: required('WHATSAPP_ACCESS_TOKEN'),
  phoneNumberId: required('WHATSAPP_PHONE_NUMBER_ID'),
  /**
   * Sister ACR-Fresh line on same Meta app — inbound webhooks forwarded internally.
   * Leave empty if fresh bot not deployed.
   */
  freshPhoneNumberId: required('WHATSAPP_FRESH_PHONE_NUMBER_ID', ''),
  freshWebhookForwardUrl: required(
    'WHATSAPP_FRESH_WEBHOOK_FORWARD_URL',
    'http://127.0.0.1:3001/webhook',
  ),
  apiVersion: required('WHATSAPP_API_VERSION', 'v21.0'),
  databasePath: required('DATABASE_PATH', './data/orders.json'),
  /**
   * Postgres connection string.
   * Production (NODE_ENV=production): required unless ALLOW_JSON_DB=1.
   * Local/dev: optional — empty falls back to JSON file.
   */
  databaseUrl: required('DATABASE_URL', ''),
  /**
   * Optional: Fresh (ACR Fresh) Postgres URL for consolidated Food admin cashbook.
   * Leave empty to keep Food-only cashbook (fresh_linked: false).
   */
  freshDatabaseUrl: required('FRESH_DATABASE_URL', ''),
  /** Referral + wallet tables (shared with Fresh). Food owns them — defaults to DATABASE_URL. */
  referralDatabaseUrl: required('REFERRAL_DATABASE_URL', required('DATABASE_URL', '')),
  /** Sister-brand orders for "new customer" checks (Fresh DB). */
  peerOrdersDatabaseUrl: required('FRESH_DATABASE_URL', ''),
  foodWhatsappNumber: required('FOOD_WHATSAPP_NUMBER', '919823583498').replace(/\D/g, ''),
  freshWhatsappNumber: required('FRESH_WHATSAPP_NUMBER', '919392044833').replace(/\D/g, ''),
  /** Emergency only: allow JSON store when NODE_ENV=production without DATABASE_URL */
  allowJsonDb: truthyFlag(required('ALLOW_JSON_DB', '0')),
  businessName: required('BUSINESS_NAME', 'Amma Chethi Ruchulu'),
  supportPhone: required('SUPPORT_PHONE', '918886128995'),
  lunchCutoffHour: Number(required('LUNCH_CUTOFF_HOUR', '11')),
  dinnerCutoffHour: Number(required('DINNER_CUTOFF_HOUR', '17')),
  /**
   * Seed minimum food total (paise) when ops-settings not yet saved.
   * Live changes: Admin → Offers → Min order (not redeploy).
   * Live cutoffs: Admin → Offers → Lunch/Dinner order-by hours (default 13=1PM, 20=8PM).
   * After that, customers call ORDER_CONFIRM_PHONE; admin places a manual order.
   */
  minOrderPaise: Number(required('MIN_ORDER_PAISE', '0')),
  freeDeliveryAbovePaise: Number(required('FREE_DELIVERY_ABOVE_PAISE', '30000')),
  /** Only true when BYPASS_CUTOFFS is 1/true/yes — '0' or empty = real cutoffs */
  bypassCutoffs: truthyFlag(required('BYPASS_CUTOFFS', '0')),
  /** WhatsApp sends the website link for every ordering intent (Flow / buttons off). */
  websiteOrderingOnly: truthyFlag(required('WEBSITE_ORDERING_ONLY', '1')),
  /**
   * Voice line for late same-day lunch/dinner (after WA self-order closes).
   * Digits only or with +91 — shown to customers during the call-confirm window.
   */
  orderConfirmPhone: String(required('ORDER_CONFIRM_PHONE', '9392044833')).replace(/\D/g, ''),
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
  communityInviteUrl: required(
    'WHATSAPP_COMMUNITY_LINK',
    'https://chat.whatsapp.com/ICh6hNMEG9kBhZMuNpeayT',
  ),
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
   * Auto Hi-reminder to admins (08:30 / 19:30 IST). Set ADMIN_PING_REMINDERS=0 to disable
   * (useful when Food + Fresh share admins and you only want one bot to ping).
   */
  adminPingRemindersEnabled: !['0', 'false', 'no', 'off'].includes(
    String(required('ADMIN_PING_REMINDERS', '1')).trim().toLowerCase(),
  ),
  /** Delivery rider WhatsApp alerts (paid orders + pin). Deduped with admin phones. */
  riderPhones: phoneList(required('RIDER_PHONES', '918886128995')),
  /** Admin login username (default superadmin). Password = ADMIN_TOKEN. */
  adminUser: required('ADMIN_USER', 'superadmin'),
  adminToken: required('ADMIN_TOKEN', ''),
  /**
   * Admin hub app URLs (Food + Fresh). Same ADMIN_TOKEN on both bots recommended.
   * Defaults point at production hosts; override for local (e.g. :3000 / :3001).
   */
  adminFoodAppUrl: required(
    'ADMIN_FOOD_APP_URL',
    `${String(required('PUBLIC_BASE_URL', 'https://order.ammachethiruchulu.co.in')).replace(/\/$/, '')}/admin/app`,
  ),
  adminFreshAppUrl: required(
    'ADMIN_FRESH_APP_URL',
    'https://fresh.ammachethiruchulu.co.in/admin/app',
  ),
  adminHubUrl: required(
    'ADMIN_HUB_URL',
    `${String(required('PUBLIC_BASE_URL', 'https://order.ammachethiruchulu.co.in')).replace(/\/$/, '')}/admin`,
  ),
  adminHubProduct: 'food',

  /** Rider portal (v1b hub + per-app boards). Same PIN secret on Food + Fresh. */
  riderSessionSecret: required('RIDER_SESSION_SECRET', ''),
  riderHubUrl: required(
    'RIDER_HUB_URL',
    `${String(required('PUBLIC_BASE_URL', 'https://order.ammachethiruchulu.co.in')).replace(/\/$/, '')}/rider`,
  ),
  riderFoodAppUrl: required(
    'RIDER_FOOD_APP_URL',
    `${String(required('PUBLIC_BASE_URL', 'https://order.ammachethiruchulu.co.in')).replace(/\/$/, '')}/rider/app`,
  ),
  riderFreshAppUrl: required(
    'RIDER_FRESH_APP_URL',
    'https://fresh.ammachethiruchulu.co.in/rider/app',
  ),
  /** Sister bot base for syncing rider roster (e.g. https://fresh… ). Empty = no sync. */
  riderSisterSyncUrl: required(
    'RIDER_SISTER_SYNC_URL',
    'https://fresh.ammachethiruchulu.co.in',
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
    `${String(required('PUBLIC_BASE_URL', 'https://order.ammachethiruchulu.co.in')).replace(/\/$/, '')}/media/catalog-default`,
  ),
};

/** Whether this WhatsApp user may receive sendFlow (allowlist gate). */
export function isWhatsappFlowAllowed(phone) {
  if (!config.whatsappFlowId) return false;
  const list = config.whatsappFlowAllowlist;
  if (!list.length) return true;
  return phoneMatchesList(phone, list);
}
