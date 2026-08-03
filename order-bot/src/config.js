import 'dotenv/config';

function required(name, fallback = '') {
  return process.env[name] ?? fallback;
}

function phoneList(raw) {
  return String(raw || '')
    .split(/[,\s]+/)
    .map((p) => p.replace(/\D/g, ''))
    .filter(Boolean);
}

export const config = {
  port: Number(required('PORT', '3000')),
  verifyToken: required('WHATSAPP_VERIFY_TOKEN', 'amma_chethi_verify_change_me'),
  accessToken: required('WHATSAPP_ACCESS_TOKEN'),
  phoneNumberId: required('WHATSAPP_PHONE_NUMBER_ID'),
  apiVersion: required('WHATSAPP_API_VERSION', 'v21.0'),
  databasePath: required('DATABASE_PATH', './data/orders.json'),
  businessName: required('BUSINESS_NAME', 'Amma Chethi Ruchulu'),
  supportPhone: required('SUPPORT_PHONE', '918886128995'),
  lunchCutoffHour: Number(required('LUNCH_CUTOFF_HOUR', '10')),
  dinnerCutoffHour: Number(required('DINNER_CUTOFF_HOUR', '16')),
  minOrderPaise: Number(required('MIN_ORDER_PAISE', '10000')),
  freeDeliveryAbovePaise: Number(required('FREE_DELIVERY_ABOVE_PAISE', '30000')),
  /** Set BYPASS_CUTOFFS=1 for local testing after hours */
  bypassCutoffs: required('BYPASS_CUTOFFS', '') === '1',
  upiId: required('UPI_ID', '8308354229@ybl'),
  upiPayeeName: required('UPI_PAYEE_NAME', 'LAKSHMI PENUMAKA'),
  upiQrPath: required('UPI_QR_PATH', './assets/upi-qr.jpeg'),
  /** Comma-separated WhatsApp numbers (with country code) allowed for admin commands */
  adminPhones: phoneList(required('ADMIN_PHONES', '918055292935,918886128995')),
  /** Shared secret for local/web admin dashboard */
  adminToken: required('ADMIN_TOKEN', 'amma-local-admin'),
};