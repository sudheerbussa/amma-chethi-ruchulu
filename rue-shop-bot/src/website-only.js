import { shopUrl } from './config.js';

const ORDER_INTENT =
  /\b(order|buy|shop|price|catalogue|catalog|decorative|light|lights|purchase|cart|pay)\b/i;

export function isOrderingIntent(text) {
  return ORDER_INTENT.test(String(text || ''));
}

export function websiteOrderReply() {
  const url = shopUrl();
  return [
    'Shop Decorative Lights online (secure payment):',
    url,
    '',
    'Browse products, choose pickup or delivery, and pay on the website.',
    'Reply STATUS <order-id> for an existing order, or HELP for support.',
  ].join('\n');
}
