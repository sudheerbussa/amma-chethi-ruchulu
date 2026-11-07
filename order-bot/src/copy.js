/**
 * Customer copy — Telugu for explanations; English button titles stay in handlers.
 */

import { lateOrderCallHint } from './cutoffs.js';

export function greetLine(name) {
  if (name) return `నమస్తే ${name}! 🙏`;
  return 'నమస్తే! 🙏';
}

export function welcomeBody({ businessName, mealStatus, minOrder, freeDelivery, offerLines, name }) {
  // Min-order hint omitted on Hi — menu is mostly meal-sized; checkout still enforces min if set.
  void minOrder;
  const bits = [];
  // freeDelivery only when caller confirmed an enabled free_delivery offer (null/omit = hide)
  if (freeDelivery) bits.push(`Free delivery above ${freeDelivery}`);
  const fromOffers =
    Array.isArray(offerLines) && offerLines.length ? offerLines.join(' · ') : '';
  // Prefer live offer lines (includes free delivery only if enabled); else free-delivery bit
  const offersBlock = fromOffers ? `${fromOffers}\n` : bits.length ? `${bits.join(' · ')}\n` : '';
  return (
    `${greetLine(name)} ${businessName}\n` +
    `${mealStatus}\n` +
    offersBlock +
    (name ? '' : 'మీ పేరు తెలుసుకోవచ్చా?')
  ).trimEnd();
}

export function askNameText() {
  return 'మీ పేరు రాయండి (ఉదా: రవి).';
}

export function confirmWaNameText(profileName) {
  return `*${profileName}*\nఈ పేరు సరైందా?`;
}

export function nameSavedText(name) {
  return `Thanks ${name}! Name saved.`;
}

export function askAddressNewText(cartText) {
  return `${cartText}\n\n📍 Address / landmark రాయండి. Map pin optional (kitchen కోసం).`;
}

export function savedAddressPrompt(cartText) {
  return `${cartText}\n\nSaved address pick చేయండి, లేదా New address.`;
}

/** Message 5 — after Flow delivery: ask for map pin (optional). */
export function flowDeliveryPinPrompt(landmark) {
  const line = String(landmark || '').trim();
  return line
    ? `📍 Map pin optional — share చేయండి (kitchen find చేయడానికి)\n${line.slice(0, 180)}\nలేదా *Skip pin* → distance pick.`
    : '📍 Map pin optional — share చేయండి, లేదా *Skip pin* → distance pick.';
}

/** Message 5 — saved pin confirm. */
export function flowSavedPinPrompt({ landmark, distanceLabel, zoneLabel }) {
  return (
    `📍 Saved pin use చేయాలా? (optional)\n` +
    `${String(landmark || '').trim()}\n` +
    `Saved (~${distanceLabel} · ${zoneLabel}) — use / new pin / skip.`
  );
}

export function reorderConfirm(linesText, totalLabel) {
  return (
    `Re-added:\n${linesText}\n` +
    (totalLabel ? `Food: ${totalLabel}\n` : '') +
    `Checkout or edit cart.`
  );
}

/**
 * Soft community invite — append after order touchpoints when link is configured.
 * @param {string} [url]
 */
export function communityInviteBlock(url) {
  const link = String(url || '').trim();
  if (!link) return '';
  return `\n\nఆఫర్లు / ప్రశ్నలు: ${link}`;
}

/**
 * Standalone Hi / welcome invite (separate bubble).
 * @param {string} [url]
 */
export function communityInviteHiMessage(url) {
  const link = String(url || '').trim();
  if (!link) return '';
  return `📢 ఆఫర్లు / ప్రశ్నలు:\n${link}`;
}

/** Message 2 — Order → pick delivery slot (list body). */
export function orderSlotPickerBody(leadMinutes) {
  const lead = Number(leadMinutes) || 90;
  return (
    `🍽 *Order*\n\n` +
    `ఈరోజు డెలివరీ time ఎంచుకోండి.\n` +
    `Delivery 12:30 PM–11:00 PM (last order 9:30 PM)\n` +
    `కనీసం ${lead} min ముందు book చేయండి — kitchen మీ slot కి food ready చేస్తుంది.`
  );
}

/** Message 2 — no bookable slots today (Start over is a button; late → call). */
export function orderSlotPickerEmptyBody(supportLine) {
  return (
    `ఈరోజు online delivery slots లేవు.\n` +
    `${lateOrderCallHint()}\n\n` +
    `${supportLine}`
  );
}

/** WhatsApp CTA → Food web storefront. */
export function storefrontOrderCtaBody(referLine = '') {
  return (
    `🍽 *View Menu & Order*\n\n` +
    `Website లో menu చూసి cart → slot (today / tomorrow) → pay చేయండి.\n` +
    `కింది button నొక్కండి — WhatsApp లోనే open అవుతుంది.` +
    (referLine ? `\n\n${referLine}` : '')
  );
}

/**
 * Message 3 — WhatsApp Flow CTA body (menu first; delivery time inside Flow near end).
 * @param {{ mealTitle?: string, serviceLabel?: string, partyOnly?: boolean, partyNotice?: string, browseFirst?: boolean }} opts
 */
export function flowPlaceOrderBody({
  mealTitle = '',
  serviceLabel = '',
  partyOnly = false,
  partyNotice = '',
  browseFirst = false,
} = {}) {
  if (browseFirst || !mealTitle) {
    return (
      `🍽 Menu చూసి order చేయండి.\n` +
      `*Place order* నొక్కండి — meal → dishes → చివర delivery / pickup time.`
    );
  }
  const when = `📅 ${mealTitle} · ${serviceLabel}`;
  if (partyOnly && partyNotice) {
    return (
      `${partyNotice}\n\n` +
      `${when}\n` +
      `*Place order* నొక్కి menu / cart continue చేయండి.`
    );
  }
  return (
    `${when}\n` +
    `*Place order* నొక్కి dishes add చేయండి.\n` +
    `Delivery / pickup time Flow చివర choose చేస్తారు.`
  );
}

/** Message 3 — button fallback if Flow fails. */
export function buttonMenuFallbackBody({ mealTitle, serviceLabel, isAdvance = false }) {
  void isAdvance;
  return `📅 ${mealTitle} · ${serviceLabel}\nList నుంచి category / dishes pick చేయండి.`;
}
