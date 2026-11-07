/**
 * Customer copy — Telugu bodies; English button / list titles stay in handlers.
 * ACR-Fresh: View Menu & Order · More · Help (same pattern as Food).
 */

export function greetLine(name) {
  if (name) return `నమస్తే ${name}! 🙏`;
  return 'నమస్తే! 🙏';
}

export function welcomeBody({
  businessName,
  minOrder,
  freeDelivery,
  offerLines,
  name,
}) {
  const bits = [];
  if (minOrder && !/^₹?0(\.0+)?$/.test(String(minOrder).trim())) {
    bits.push(`Minimum ఆర్డర్ ${minOrder}`);
  }
  if (freeDelivery) bits.push(`${freeDelivery} పైన free delivery`);
  const fromOffers =
    Array.isArray(offerLines) && offerLines.length ? offerLines.join(' · ') : '';
  const offersBlock = fromOffers ? `${fromOffers}\n` : bits.length ? `${bits.join(' · ')}\n` : '';
  // No slot list (Order form) · no action line (buttons) · no call number on Hi
  // Unlisted items: call tip only on Order form SLOT (same number as this chat)
  // Name: asked only when they start ordering (ensureCustomerName) — not on every Hi
  return (
    `${greetLine(name)} ${businessName}\n` +
    `🥬 కూరగాయలు & పండ్లు\n` +
    offersBlock
  ).trimEnd();
}

export function askNameText() {
  return 'స్వాగతం!\nమీ పేరు రాయండి (ఉదా: రవి).';
}

export function confirmWaNameText(profileName) {
  return (
    `WhatsApp పేరు: *${profileName}*\n` +
    `ఈ పేరు సరైందా?\n` +
    `*Yes* లేదా *Change name* నొక్కండి.`
  );
}

export function invalidNameText() {
  return 'సరైన పేరు రాయండి (కనీసం 2 అక్షరాలు).';
}

export function askAddressNewText(cartText) {
  return `${cartText}\n\n📍 Address / landmark రాయండి. Map pin optional.`;
}

export function savedAddressPrompt(cartText) {
  return `${cartText}\n\nసేవ్డ్ అడ్రస్ ఎంచుకోండి లేదా *New address*.`;
}

export function reorderConfirm(linesText, totalLabel) {
  return (
    `మళ్లీ జోడించాం:\n${linesText}\n` +
    (totalLabel ? `మొత్తం: ${totalLabel}\n` : '') +
    `*Checkout* లేదా cart ఎడిట్ చేయండి.`
  );
}

export function viewMenuCatalogBody() {
  return (
    '📱 పైన catalog ఐకాన్ నొక్కండి.\n' +
    'లేదా *View Menu & Order* నొక్కి Place order తెరవండి.'
  );
}

export function viewMenuPostersBody({ sent = false } = {}) {
  if (sent) {
    return 'మెనూ పైన 👆 · ఆర్డర్‌కి *View Menu & Order* నొక్కండి.';
  }
  return '*View Menu & Order* నొక్కి మెనూ చూసి ఆర్డర్ చేయండి.';
}

/** WhatsApp CTA → Fresh web storefront (only order channel). */
export function storefrontOrderCtaBody(referLine = '') {
  return (
    `🥬 *View Menu & Order*\n\n` +
    `Website లో కూరగాయలు / పండ్లు చూసి cart → hour → pay చేయండి.\n` +
    `కింది button నొక్కండి — WhatsApp లోనే open అవుతుంది.` +
    (referLine ? `\n\n${referLine}` : '')
  );
}

export function moreMenuBody({ hasRate = false, orderRef = '' } = {}) {
  if (hasRate) {
    const ref = String(orderRef || '').trim();
    return ref
      ? `ఐచ్ఛికం: ${ref} రేట్ చేయండి, మళ్లీ ఆర్డర్, లేదా సహాయం.`
      : 'ఐచ్ఛికం: రేట్, మళ్లీ ఆర్డర్, లేదా సహాయం — కింద ఎంచుకోండి.';
  }
  return 'మీకు ఏమి కావాలో ఎంచుకోండి:';
}

export function communityInviteBlock(url) {
  const link = String(url || '').trim();
  if (!link) return '';
  return `\n\nకమ్యూనిటీ: ${link}`;
}

export function communityInviteHiMessage(url) {
  const link = String(url || '').trim();
  if (!link) return '';
  return `📢 ఆఫర్లు / ప్రశ్నలు:\n${link}`;
}
