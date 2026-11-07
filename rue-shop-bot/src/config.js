import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

export const config = {
  port: Number(required('PORT', '3002')),
  nodeEnv,
  isProduction: nodeEnv === 'production',
  allowJsonDb: truthyFlag(required('ALLOW_JSON_DB', '1')),
  databasePath: required('DATABASE_PATH', './data/orders.json'),

  businessName: required('BUSINESS_NAME', 'Rare & Unique Electronics'),
  supportPhone: required('SUPPORT_PHONE', '919272135734').replace(/\D/g, ''),
  publicBaseUrl: required('PUBLIC_BASE_URL', 'https://shop.rareuniqueelectronics.com'),
  shopPath: required('SHOP_PATH', '/shop'),

  verifyToken: required('WHATSAPP_VERIFY_TOKEN', 'rue_shop_verify_change_me'),
  accessToken: required('WHATSAPP_ACCESS_TOKEN', ''),
  phoneNumberId: required('WHATSAPP_PHONE_NUMBER_ID', ''),
  apiVersion: required('WHATSAPP_API_VERSION', 'v21.0'),
  websiteOrderingOnly: truthyFlag(required('WEBSITE_ORDERING_ONLY', '1')),

  razorpayKeyId: required('RAZORPAY_KEY_ID', ''),
  razorpayKeySecret: required('RAZORPAY_KEY_SECRET', ''),
  razorpayWebhookSecret: required('RAZORPAY_WEBHOOK_SECRET', ''),

  /** Shipping (paise). Override via env without code change. */
  shippingPickupPaise: Number(required('SHIPPING_PICKUP_PAISE', '0')),
  shippingLocalPaise: Number(required('SHIPPING_LOCAL_PAISE', '10000')),
  shippingCourierPaise: Number(required('SHIPPING_COURIER_PAISE', '15000')),
  freeDeliveryAbovePaise: Number(required('FREE_DELIVERY_ABOVE_PAISE', '200000')),

  shopAddress: required(
    'SHOP_ADDRESS',
    'Shop No. 06, Rajvishwa Heights, S. No. 169, Sanjay Nagar, Bhor, Maharashtra 412206',
  ),

  adminPhones: phoneList(required('ADMIN_PHONES', '919272135734')),
  adminToken: required('ADMIN_TOKEN', 'rue-local-admin'),
  /** Optional HTTPS URL for ops alerts (Slack/Discord/Telegram webhook). */
  opsWebhookUrl: required('OPS_WEBHOOK_URL', ''),
};

export function isWhatsappReady() {
  return Boolean(config.accessToken && config.phoneNumberId);
}

export function shopUrl(query = '') {
  const base = (config.publicBaseUrl || '').replace(/\/$/, '');
  const pathPart = config.shopPath.startsWith('/') ? config.shopPath : `/${config.shopPath}`;
  return `${base}${pathPart}${query}`;
}
