/**
 * Website-only ordering: WhatsApp keeps notifications, payment, help, status, feedback,
 * referrals (REFER / WALLET / codes) and admin. Every ordering intent gets the website link.
 * Toggle with WEBSITE_ORDERING_ONLY (default on). Keep identical in order-bot and acr-fresh-bot.
 */
import { config } from './config.js';

export const REFER_COMMANDS = ['refer', 'referral', 'refer code', 'my code', 'refer & earn', 'refer and earn'];
export const WALLET_COMMANDS = ['wallet', 'my wallet', 'credit', 'acr credit', 'balance'];

const HELP_STATES = new Set(['await_help_topic', 'await_help_detail']);

const ALLOWED_EXACT = new Set([
  'help',
  'support',
  'status',
  'my status',
  'cod',
  'cash on delivery',
  'cash at pickup',
  ...REFER_COMMANDS,
  ...WALLET_COMMANDS,
]);

export function websiteOrderingOnly() {
  return config.websiteOrderingOnly === true;
}

/** True when the message should reach the normal handler (support / post-order / referral). */
export function websiteModeAllows(lower, state) {
  if (HELP_STATES.has(state)) return true;
  if (ALLOWED_EXACT.has(lower)) return true;
  if (lower.startsWith('help_')) return true;
  if (/^(pay_)?cod[_ ][a-z0-9-]+$/i.test(lower)) return true;
  if (/^paid(\s+[a-z0-9_-]+)?$/i.test(lower)) return true;
  return false;
}

/** Leftover in-chat ordering state (cart, slot, pin…) that must not trap allowed commands. */
export function isStaleOrderingState(state) {
  return Boolean(state) && state !== 'idle' && !HELP_STATES.has(state);
}
