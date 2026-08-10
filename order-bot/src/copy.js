/**
 * Customer copy: Telugu light on welcome / thanks / updates only.
 * Ordering steps (menu, cart, address, buttons) stay English.
 */

export function greetLine(name) {
  if (name) return `Namaste ${name}! 🙏 / నమస్కారం`;
  return 'Namaste! 🙏 / నమస్కారం';
}

export function welcomeBody({ businessName, mealStatus, minOrder, freeDelivery, offerLines, name }) {
  const rules =
    minOrder && !/^₹?0(\.0+)?$/.test(String(minOrder).trim())
      ? `Min order ${minOrder}\n`
      : '';
  const freeLine = freeDelivery ? `Free delivery above ${freeDelivery}\n` : '';
  const offersBlock =
    Array.isArray(offerLines) && offerLines.length
      ? `Launch offers:\n${offerLines.join('\n')}\n\n`
      : freeLine
        ? `${freeLine}\n`
        : '';
  return (
    `${greetLine(name)}\n` +
    `${businessName}\n` +
    `Tenali homely Andhra food — freshly cooked daily.\n\n` +
    `${mealStatus}\n\n` +
    rules +
    offersBlock +
    `Delivery: Tenali local.\n\n` +
    (name
      ? 'Tap Lunch or Dinner (when open). Type HELP anytime.'
      : "We'll save your name once — then ordering is faster.")
  );
}

export function askNameText() {
  return (
    `Welcome to our kitchen!\n\n` +
    `What is your name? (e.g. Ravi, Lakshmi)\n` +
    `మీ పేరు రాయండి.`
  );
}

export function confirmWaNameText(profileName) {
  return (
    `Namaste! 🙏\n\n` +
    `WhatsApp name: *${profileName}*\n` +
    `Use this name? / ఈ పేరు సరైందా?\n\n` +
    `Tap Yes, or Change name / type your name.`
  );
}

export function nameSavedText(name) {
  return `Thanks ${name}! Name saved. / ధన్యవాదాలు — పేరు సేవ్ అయింది.`;
}

export function askAddressNewText(cartText) {
  return (
    `${cartText}\n\n` +
    `Type your Tenali delivery address (area / landmark / door no).\n` +
    `To stop, type Cancel.`
  );
}

export function savedAddressPrompt(cartText) {
  return (
    `${cartText}\n\n` +
    `You have a saved address. Use it or add a new one.`
  );
}

export function reorderConfirm(linesText, totalLabel) {
  return (
    `Re-added your previous order:\n` +
    `${linesText}\n` +
    (totalLabel ? `Food: ${totalLabel}\n` : '') +
    `\nReview cart: Checkout, or edit items.`
  );
}

/**
 * Soft community invite — append after order touchpoints when link is configured.
 * @param {string} [url]
 */
export function communityInviteBlock(url) {
  const link = String(url || '').trim();
  if (!link) return '';
  return (
    `\n\n———\n` +
    `📢 For daily menu, offers & kitchen updates, join our WhatsApp Community:\n` +
    `${link}\n` +
    `ఆఫర్లు, మెనూ ఉప్డేట్ల కోసం Community join అవ్వండి.`
  );
}
