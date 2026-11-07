import { getDb } from '../db.js';
import { config, isWhatsappFlowAllowed } from '../config.js';
import {
  mealStatusText,
  canCustomerCancelOrder,
  isSessionBookingValid,
  isMealOpen,
  isMealCallConfirmWindow,
  mealCallConfirmMessage,
  acrSupportCallLine,
  lateOrderCallHint,
  orderDayForMeal,
  nextServiceDayForMeal,
  advanceSlotPrompt,
  otherMealOpenToday,
  mealTitle,
  mealCutoffLabel,
  mealServeLabel,
  nowIst,
  dayFromIso,
  isSundayPartyDinnerService,
  sundayPartyOrderNotice,
  sundayPartyOrderNoticeShort,
} from '../cutoffs.js';
import {
  buildUpiPayUri,
  sendButtons,
  sendCtaUrl,
  sendFlow,
  sendList,
  sendLocationRequest,
  sendText,
  sendUpiQr,
} from '../whatsapp.js';
import { sendMenuPosters, sendWelcomePosters } from '../posters.js';
import { loadPosterAutoSettings } from '../poster-settings.js';
import { buildReorderCart } from '../orders/reorder-cart.js';
import { storefrontFoodUrl } from '../storefront/link.js';
import {
  captureReferralFromText,
  referPromoLine,
  referInfoMessages,
  referralAppliedText,
  referralWelcomeFor,
  walletUseFor,
  walletSummaryText,
} from '../referrals.js';
import { tryHandleAdmin } from './admin.js';
import {
  REFER_COMMANDS,
  WALLET_COMMANDS,
  isStaleOrderingState,
  websiteModeAllows,
  websiteOrderingOnly,
} from '../website-only.js';
import { notifyAdmins, formatUnpaidOrderAlert, orderPinLine } from '../ops-notify.js';
import {
  applyOrderStatus,
  customerStatusLabel,
  paymentThanksMessage,
  tryHandleFeedbackReply,
} from '../orders/status.js';
import {
  getSlotLeadMinutes,
  isSlotTimeOpen,
  mealFromSlotId,
  parseSlotId,
  planAllMealSlotCandidates,
  planMealSlotCandidates,
  serviceLabelWithSlot,
  slotOptionDescription,
} from '../slots.js';
import { BROWSE_CATEGORIES, browseCategoryLabel, categoryLabel, DELIVERY_ZONES } from '../menu.js';
import { hoursAndRangeBlurb, isIceBreakerHours, isIceBreakerPrices } from '../menu-text.js';
import { deliveryTrackLines, resolveDeliveryTrack } from '../delivery-track.js';
import {
  buildSingleItemCart,
  cartViolatesSundayPartyRule,
  filterCartForMeal,
  listDishesForBrowse,
  resolveBooking,
} from '../orders/checkout-shared.js';
import {
  applyPickupPricing,
  confirmCustomerCod,
  isPickupSession,
  orderAcceptsOnlinePayment,
  orderHasOpenCod,
  onlinePaymentAmountPaise,
} from '../orders/fulfillment-pay.js';
import { encodeFlowToken } from '../flows/screens.js';
import {
  addToCart,
  cartFoodPaise,
  cartLineFromDish,
  cartQtyForDish,
  cartTotalQty,
  dishSummaryName,
  formatCartMessage,
  formatLinesText,
  formatPaise,
  formatPriceWithMrp,
  getOrderLines,
  lineDisplayName,
  MAX_LINE_QTY,
  maxQtyForCartLine,
  remainingForDish,
  setCartLineQty,
} from '../orders/cart.js';
import { formatDishLabel, formatDishListDescription, formatDishListTitle } from '../ammas.js';
import * as copy from '../copy.js';
import { isRazorpayReady, publicPayUrl } from '../razorpay.js';
import {
  applyOffers,
  applyWalletCredit,
  formatOffersPublicLines,
  freeDeliveryThresholdPaise,
  qualifiesFreeDelivery,
  DELIVERY_MODES,
} from '../offers.js';
import {
  deliveryZoneFromPin,
  formatDistanceKm,
  formatLocationAddress,
  resolveGoogleMapsLocation,
  extractGoogleMapsUrl,
} from '../geo.js';

const MAX_CART_LINES = 10;
/** Don't re-send welcome menu posters (or Hi community bubble) within this window. */
const POSTER_COOLDOWN_MS = 6 * 60 * 60 * 1000;

/** WhatsApp reply-button title max 20 chars. */
const ORDER_CTA_TITLE = 'View Menu & Order';

function orderCtaButton() {
  return { id: 'order', title: ORDER_CTA_TITLE };
}

/** Start over / home — do not use `menu` (that opens View Menu & Order). */
function isStartOverCommand(lower) {
  const t = String(lower || '').trim().toLowerCase();
  return (
    t === 'start_over' ||
    t === 'start over' ||
    t === 'startover' ||
    t === 'home' ||
    t === 'restart'
  );
}

/** Previous step — button id `nav_back` or typed BACK / prev. */
function isBackCommand(lower) {
  const t = String(lower || '').trim().toLowerCase();
  return (
    t === 'back' ||
    t === 'nav_back' ||
    t === '← back' ||
    t === 'previous' ||
    t === 'prev' ||
    t === 'go back' ||
    t === 'goback'
  );
}

const BACK_BTN = { id: 'nav_back', title: '← Back' };

/** Clear cart/mid-flow and show home (View Menu & Order). */
async function sendReferInfo(phone, profile = '') {
  try {
    const name = (await getDb().getCustomer(phone))?.name || profile;
    const info = await referInfoMessages(phone, name);
    if (!info) {
      await sendText(phone, 'Referral program is paused right now. Tap View Menu & Order to order.');
      return;
    }
    await sendText(phone, info.intro);
    await sendText(phone, info.share);
  } catch (err) {
    console.error('[referrals] REFER failed', err.message || err);
    await sendText(phone, 'Could not load your referral code. Please try again in a minute.');
  }
}

async function sendWalletInfo(phone) {
  try {
    const text = await walletSummaryText(phone);
    await sendText(phone, text || 'ACR Credit is not available right now.');
  } catch (err) {
    console.error('[referrals] WALLET failed', err.message || err);
    await sendText(phone, 'Could not load ACR Credit. Please try again in a minute.');
  }
}

async function goStartOver(phone, profile = '') {
  const db = getDb();
  await clearOrderingSession(db, phone);
  if (!(await db.getCustomer(phone))?.name) {
    await ensureCustomerName(phone, 'menu', profile);
    return;
  }
  await sendMainMenu(phone);
}

/**
 * One step back in the order flow (keeps cart when possible).
 * Categories ← home · Dish ← categories · Qty ← dish · Cart ← dish · Address ← cart · Delivery ← address
 */
async function goBackOneStep(phone, session) {
  const db = getDb();
  const state = session?.state || 'idle';

  if (state === 'await_qty') {
    await db.setSession(phone, { dish_code: null, qty: null, state: 'await_dish' });
    if (sessionIsSundayPartyDinner(session)) {
      await db.setSession(phone, { category: 'packs' });
      await sendDishList(phone, session.meal || 'dinner', 'packs');
      return;
    }
    if (session.category && session.meal) {
      await sendDishList(phone, session.meal, session.category);
      return;
    }
    await db.setSession(phone, { state: 'await_category', category: null });
    if (session.meal) await sendCategoryPicker(phone, session.meal, session);
    else await sendMainMenu(phone);
    return;
  }

  if (state === 'await_dish') {
    if (sessionIsSundayPartyDinner(session)) {
      // Party-only: previous step is meal home
      await goStartOver(phone);
      return;
    }
    await db.setSession(phone, { state: 'await_category', category: null, dish_code: null });
    await sendCategoryPicker(phone, session.meal || 'lunch', session);
    return;
  }

  if (state === 'await_category' || state === 'await_slot_confirm' || state === 'await_catalog_meal') {
    await goStartOver(phone);
    return;
  }

  if (state === 'await_cart_line') {
    await sendCartEditList(phone, session);
    return;
  }

  if (state === 'await_cart_edit') {
    await sendCartActions(phone, session);
    return;
  }

  if (state === 'await_cart') {
    if (!session.meal) {
      await goStartOver(phone);
      return;
    }
    if (sessionIsSundayPartyDinner(session)) {
      await db.setSession(phone, {
        state: 'await_dish',
        category: 'packs',
        dish_code: null,
        qty: null,
        edit_code: null,
      });
      await sendDishList(phone, session.meal, 'packs');
      return;
    }
    if (session.category) {
      await db.setSession(phone, {
        state: 'await_dish',
        dish_code: null,
        qty: null,
        edit_code: null,
      });
      await sendDishList(phone, session.meal, session.category);
      return;
    }
    await db.setSession(phone, {
      state: 'await_category',
      dish_code: null,
      qty: null,
      edit_code: null,
    });
    await sendCategoryPicker(phone, session.meal, session);
    return;
  }

  if (state === 'await_fulfillment') {
    if (session.flow_checkout) {
      await db.setSession(phone, {
        state: 'await_cart',
        fulfillment_type: null,
        delivery_slot: null,
        flow_checkout: false,
      });
      await sendMainMenu(phone);
      return;
    }
    await db.setSession(phone, {
      state: 'await_cart',
      fulfillment_type: null,
      delivery_slot: null,
    });
    await sendCartActions(phone, await db.getSession(phone));
    return;
  }

  if (state === 'await_delivery_slot') {
    await db.setSession(phone, {
      delivery_slot: null,
      fulfillment_type: null,
      pending_action: null,
      meal: null,
    });
    await sendMainMenu(phone);
    return;
  }

  if (state === 'await_address_pick') {
    await db.setSession(phone, { fulfillment_type: null });
    await sendCartActions(phone, await db.getSession(phone));
    return;
  }

  if (state === 'await_flow_pin') {
    // Back keeps the cart — ask for pin again (Start over is the only full reset)
    await continueFlowDelivery(phone, session, session.address || '');
    return;
  }

  if (state === 'await_address') {
    await db.setSession(phone, { fulfillment_type: null });
    const next = await db.getSession(phone);
    await sendCartActions(phone, next);
    return;
  }

  if (state === 'await_delivery') {
    await db.setSession(phone, { fulfillment_type: null });
    await sendCartActions(phone, await db.getSession(phone));
    return;
  }

  if (state === 'await_help_detail') {
    await sendHelpMenu(phone);
    return;
  }

  if (state === 'await_help_topic') {
    await sendMainMenu(phone);
    return;
  }

  if (state === 'await_name' || state === 'await_name_confirm') {
    await goStartOver(phone);
    return;
  }

  await goStartOver(phone);
}

/** UPI QR / manual PAID: always if no Razorpay; only if UPI_FALLBACK=1 when Razorpay is on */
function useUpiPayment() {
  return !isRazorpayReady() || config.upiFallback;
}

/** Admin-managed min food total (paise) for a service day / session. */
async function minOrderPaiseForDay(dayIso) {
  return getDb().getMinOrderPaise(dayIso || nowIst().isoDate);
}

async function minOrderPaiseForSession(session) {
  return minOrderPaiseForDay(session?.service_date || nowIst().isoDate);
}

/** WhatsApp button title ≤20 chars for next available service day */
function nextSlotButtonTitle(meal, day) {
  const today = nowIst();
  if (day.isoDate === today.isoDate) {
    return meal === 'dinner' ? 'Dinner today' : 'Lunch today';
  }
  const wd = String(day.weekday || '').slice(0, 3);
  const m = meal === 'dinner' ? 'dinner' : 'lunch';
  return `${wd} ${m}`.slice(0, 20);
}

function advanceSlotButtons(meal) {
  const info = orderDayForMeal(meal);
  const other = otherMealOpenToday(meal);
  const buttons = [
    {
      id: `slot_next_${meal}`,
      title: nextSlotButtonTitle(meal, info.serviceDay),
    },
  ];
  if (other) {
    buttons.push({
      id: `slot_today_${other}`,
      title: other === 'dinner' ? 'Dinner today' : 'Lunch today',
    });
  }
  buttons.push({ id: 'start_over', title: 'Start over' });
  return buttons.slice(0, 3);
}

async function customerName(phone) {
  return (await getDb().getCustomer(phone))?.name || null;
}

async function customerIsFirstOrder(phone) {
  if (!phone) return true;
  try {
    return !(await getDb().customerHasPaidOrder(phone));
  } catch {
    return true;
  }
}

async function offerLinesForPhone(phone, dayIso = nowIst().isoDate) {
  const offers = await getDb().listOffers();
  const isFirstOrderCustomer = await customerIsFirstOrder(phone);
  return formatOffersPublicLines(offers, { dayIso, isFirstOrderCustomer });
}

async function welcomeBody(phone) {
  const db = getDb();
  // Refresh ops cutoffs from DB so Hi/welcome always shows live Admin → Offers times
  try {
    await db.getOpsSettings();
  } catch {
    /* keep in-memory cache */
  }
  const offers = await db.listOffers();
  // Only advertise free delivery when an enabled free_delivery offer exists.
  // Do not fall back to FREE_DELIVERY_ABOVE_PAISE — that caused welcome vs checkout conflict.
  const freeTh = freeDeliveryThresholdPaise(offers);
  const offerLines = await offerLinesForPhone(phone, nowIst().isoDate);
  const minOrder = await minOrderPaiseForDay(nowIst().isoDate);
  return copy.welcomeBody({
    businessName: config.businessName,
    mealStatus: mealStatusText(),
    minOrder: formatPaise(minOrder),
    freeDelivery: freeTh != null ? formatPaise(freeTh) : null,
    offerLines,
    name: await customerName(phone),
  });
}

/** Next cookable calendar day for rice-plate / daily poster (today if any meal open). */
function nextSlotServiceDay() {
  if (isMealOpen('lunch') || isMealOpen('dinner')) return nowIst();
  const lunch = orderDayForMeal('lunch').serviceDay;
  const dinner = orderDayForMeal('dinner').serviceDay;
  if (String(lunch.isoDate) <= String(dinner.isoDate)) return lunch;
  return dinner;
}

/** Primary order CTA: open Food web storefront (signed link). Flow/buttons are fallback. */
/**
 * Self-order closed (after last order / no slots left). Never re-offer the `order` button here —
 * it lands back on this message. Link to the website menu (browse-only while closed) instead.
 */
async function sendOrderingClosed(phone) {
  let body = copy.orderSlotPickerEmptyBody(acrSupportCallLine());
  if (isMealCallConfirmWindow('lunch')) {
    body = mealCallConfirmMessage('lunch');
  } else if (isMealCallConfirmWindow('dinner')) {
    body = mealCallConfirmMessage('dinner');
  }
  try {
    await sendCtaUrl(
      phone,
      body,
      { displayText: 'View menu', url: storefrontFoodUrl(phone) },
      { footer: 'Online ordering reopens after 12 AM' },
    );
    return;
  } catch (err) {
    console.error('closed-menu CTA failed — falling back', err.message || err);
  }
  await sendButtons(
    phone,
    body,
    [
      { id: 'start_over', title: 'Start over' },
      { id: 'help', title: 'Help' },
    ],
    { footer: 'Call ACR if kitchen is still open' },
  );
}

async function sendOrderStart(phone, profileName) {
  try {
    await getDb().getOpsSettings();
  } catch {
    /* keep cache */
  }
  if (!(await ensureCustomerName(phone, 'order', profileName))) return;
  if (await blockIfUnpaidPending(phone)) return;

  const lunchOpen = isMealOpen('lunch');
  const dinnerOpen = isMealOpen('dinner');
  if (!lunchOpen && !dinnerOpen) {
    await sendOrderingClosed(phone);
    return;
  }

  const sess = await getDb().getSession(phone);
  const keepReorder = sess?.pending_action === 'reorder';
  await getDb().setSession(phone, {
    state: 'await_category',
    meal: null,
    service_date: null,
    service_label: null,
    delivery_slot: null,
    fulfillment_type: null,
    category: null,
    dish_code: null,
    qty: null,
    address: null,
    delivery_zone: null,
    cart: [],
    pending_action: keepReorder ? 'reorder' : null,
    pending_meal: null,
    flow_checkout: false,
  });

  try {
    const url = storefrontFoodUrl(phone);
    await sendCtaUrl(
      phone,
      copy.storefrontOrderCtaBody(await referPromoLine()),
      { displayText: 'Order on website', url },
      { footer: 'Menu · cart · pay' },
    );
    return;
  } catch (err) {
    console.error('storefront CTA failed — falling back', err.message || err);
  }

  if (config.whatsappFlowId && isWhatsappFlowAllowed(phone)) {
    const token = encodeFlowToken({ phone, meal: '', serviceDate: '' });
    try {
      await sendFlow(phone, {
        body: copy.flowPlaceOrderBody({ browseFirst: true }),
        flowToken: token,
        flowCta: 'Place order',
      });
      return;
    } catch (err) {
      console.error('sendFlow failed — falling back to buttons', err.message || err);
    }
  }

  if (lunchOpen && dinnerOpen) {
    await sendButtons(
      phone,
      'Pick Lunch or Dinner to browse the menu.\nDelivery / pickup time comes after checkout.',
      [
        { id: 'lunch', title: 'Lunch' },
        { id: 'dinner', title: 'Dinner' },
        { id: 'start_over', title: 'Start over' },
      ],
      { footer: 'Menu first · time later' },
    );
    return;
  }

  await beginMealOrdering(phone, lunchOpen ? 'lunch' : 'dinner', nowIst());
}

/** Combined lunch+dinner delivery windows — used when slot is missing mid-checkout (button path). */
async function sendOrderSlotPicker(phone) {
  const candidates = planAllMealSlotCandidates();
  if (!candidates.length) {
    await sendOrderingClosed(phone);
    return;
  }

  const rows = candidates.slice(0, 9).map((s) => ({
    id: `slot_${s.id}`,
    title: `${s.label}`.slice(0, 24),
    description: slotOptionDescription(s),
  }));
  rows.push({
    id: 'nav_back',
    title: '← Home',
    description: 'Back to home',
  });

  const sess = await getDb().getSession(phone);
  await getDb().setSession(phone, {
    state: 'await_delivery_slot',
    meal: sess?.meal || null,
    service_date: sess?.service_date || null,
    service_label: sess?.service_label || null,
    delivery_slot: null,
    fulfillment_type: sess?.fulfillment_type || null,
    cart: sess?.cart || [],
    pending_action: sess?.pending_action === 'reorder' ? 'reorder' : sess?.pending_action || null,
  });

  await sendList(phone, {
    header: 'Delivery time',
    body: copy.orderSlotPickerBody(getSlotLeadMinutes()),
    button: 'Choose time',
    footer: 'Today only · call if late',
    sections: [{ title: 'Today\'s slots', rows }],
  });
}

/** Old Catalog taps / Place order → point customers to Flow Order. */
async function redirectCatalogToOrder(phone, { reason = '' } = {}) {
  const intro = reason
    ? `${reason}\n\n`
    : 'Catalog ordering is off. Please order with the form.\n\n';
  await sendText(phone, intro.trimEnd());
  await sendOrderStart(phone);
}

/** View menu → same as Order (posters no longer a customer browse path). */
async function sendViewMenu(phone) {
  await sendOrderStart(phone);
}

async function sendMainMenu(phone, { posters = true } = {}) {
  const db = getDb();
  // Load live cutoffs before meal/poster day logic (IST)
  try {
    await db.getOpsSettings();
  } catch {
    /* keep cache */
  }

  const sessionSnap = await db.getSession(phone);
  const lastPosterAt = sessionSnap?.posters_sent_at
    ? Date.parse(sessionSnap.posters_sent_at)
    : 0;
  const inPosterCooldown =
    Boolean(lastPosterAt) && Date.now() - lastPosterAt < POSTER_COOLDOWN_MS;

  // Hi posters — kinds from Admin → Posters auto toggles (6h cool-off)
  if (posters && !inPosterCooldown) {
    try {
      const auto = await loadPosterAutoSettings(db);
      const serviceDay = nextSlotServiceDay();
      let result = { sent: 0, skipped: [], errors: [] };
      if (auto.hi_enabled) {
        result = await sendWelcomePosters(phone, { serviceDay, auto });
        if (!result.sent && auto.hi_full_menu_fallback) {
          result = await sendMenuPosters(phone, {
            intro: false,
            includeFullMenu: true,
            includeDaily: false,
            includeSpecials: false,
          });
        }
      } else {
        result.skipped.push('hi_disabled');
      }
      console.log(
        `Welcome posters → ${phone} day=${serviceDay.isoDate} (${serviceDay.weekday}) sent=${result.sent} skipped=${result.skipped.join(',') || '-'}`,
      );
      if (result.sent > 0 || auto.hi_enabled) {
        await db.setSession(phone, {
          posters_sent_at: new Date().toISOString(),
          last_poster_day: serviceDay.isoDate,
        });
      }
    } catch (err) {
      console.error('Welcome posters failed', err.message || err);
    }
  } else if (posters && inPosterCooldown) {
    console.log(`Welcome posters skipped (6h cool-off) → ${phone}`);
  }

  const rateOrder = await db.findLatestDeliveredWithoutFeedback(phone);
  const canRate = Boolean(rateOrder);

  const body = await welcomeBody(phone);

  // Home: View Menu & Order (Flow) · More · Help
  await sendButtons(
    phone,
    body,
    [
      orderCtaButton(),
      { id: 'more_menu', title: 'More' },
      { id: 'help', title: 'Help' },
    ],
    {
      footer: canRate
        ? 'MORE → rate · HELP anytime'
        : 'Menu + order in form · HELP',
    },
  );

  // Community invite once per cool-off window (also appended on some order statuses — trim later)
  const lastCommunityAt = sessionSnap?.community_invite_sent_at
    ? Date.parse(sessionSnap.community_invite_sent_at)
    : 0;
  const inCommunityCooldown =
    Boolean(lastCommunityAt) && Date.now() - lastCommunityAt < POSTER_COOLDOWN_MS;
  const communityMsg = copy.communityInviteHiMessage(config.communityInviteUrl);
  if (communityMsg && !inCommunityCooldown) {
    try {
      await sendText(phone, communityMsg);
      await db.setSession(phone, {
        community_invite_sent_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Community invite send failed', err.message || err);
    }
  }

  // Mark nudge "offered" so we never auto-spam a second message later
  if (canRate && !rateOrder.feedback_nudge_sent) {
    await db.updateOrderStatus(rateOrder.order_ref, 'delivered', {
      feedback_nudge_sent: true,
      feedback_nudge_at: new Date().toISOString(),
    });
  }
}

async function sendMoreMenu(phone) {
  const db = getDb();
  const rateOrder = await db.findLatestDeliveredWithoutFeedback(phone);
  const rows = [
    { id: 'order', title: ORDER_CTA_TITLE, description: 'Browse menu · place order' },
    { id: 'reorder', title: 'Order again', description: 'Re-add last dishes' },
    { id: 'refer', title: 'Refer & earn', description: 'Friend gets discount · you earn credit' },
  ];
  if (rateOrder) {
    rows.push({
      id: 'rate',
      title: 'Rate last order',
      description: String(rateOrder.order_ref || '').slice(0, 72),
    });
  }
  rows.push(
    { id: 'help', title: 'Help', description: 'Payment, cancel, delivery' },
    { id: 'status', title: 'My status', description: 'Track latest order' },
    { id: 'start_over', title: 'Start over', description: 'Back to home' },
  );

  await sendList(phone, {
    header: 'More options',
    body: rateOrder
      ? `Optional: rate ${rateOrder.order_ref}, reorder, or get help.`
      : 'Choose what you need:',
    button: 'Open options',
    footer: 'Or type Order',
    sections: [
      {
        title: 'Actions',
        rows: rows.slice(0, 10),
      },
    ],
  });
}

/** Unpaid checkout OR COD-open kitchen order that can still pay online. */
async function findPayableOrder(phone) {
  const db = getDb();
  const pending = await db.findLatestPendingOrder(phone);
  if (pending) return pending;
  const latest = await db.findLatestOrder(phone);
  if (latest && orderAcceptsOnlinePayment(latest)) return latest;
  return null;
}

/** Resend Pay now CTA for pending or COD-open orders. */
async function sendPayableOrderLink(phone, order) {
  const due = onlinePaymentAmountPaise(order);
  const payLink = isRazorpayReady() ? publicPayUrl(order.order_ref) : null;
  const cod = orderHasOpenCod(order);
  const body = cod
    ? `Order ${order.order_ref} — pay *${formatPaise(due)}* online (clears COD).\n` +
      `Kitchen already has your order.\n\n` +
      acrSupportCallLine()
    : `Order ${order.order_ref} — pay *${formatPaise(due)}* to confirm.\n\n` +
      acrSupportCallLine();
  if (payLink) {
    await sendCtaUrl(phone, body, { displayText: 'Pay now', url: payLink }, {
      footer: cod ? 'COD → online pay' : 'STATUS · HELP',
    });
    return;
  }
  await sendText(phone, body + '\nOnline pay is not configured — reply HELP.');
}

/** Block a second open unpaid order on the same phone. */
async function blockIfUnpaidPending(phone) {
  const pending = await getDb().findLatestPendingOrder(phone);
  if (!pending) return false;
  const payLink = isRazorpayReady() ? publicPayUrl(pending.order_ref) : null;
  const body =
    `You already have unpaid order ${pending.order_ref} (${formatPaise(pending.total_paise)}).\n` +
    `Pay it first to place a new order.\n` +
    `To cancel that unpaid order: Help → Cancel unpaid order.\n\n` +
    acrSupportCallLine();
  if (payLink) {
    await sendCtaUrl(phone, body, { displayText: 'Pay now', url: payLink }, {
      footer: 'STATUS · HELP — type or MORE menu',
    });
  } else {
    await sendButtons(phone, body, [
      { id: 'status', title: 'Status' },
      { id: 'help', title: 'Help' },
    ]);
  }
  return true;
}

/** If no name on file, confirm WhatsApp profile name or ask to type */
async function ensureCustomerName(phone, nextAction, profileName) {
  const db = getDb();
  const cust = await db.getCustomer(phone);
  if (cust?.name) return true;

  const waName = String(profileName || '').trim().slice(0, 40);
  if (waName.length >= 2) {
    await db.setSession(phone, {
      state: 'await_name_confirm',
      pending_action: nextAction || 'menu',
      suggested_name: waName,
    });
    await sendButtons(phone, copy.confirmWaNameText(waName), [
      { id: 'name_yes', title: 'Yes' },
      { id: 'name_change', title: 'Change name' },
      { id: 'help', title: 'Help' },
    ]);
    return false;
  }

  await db.setSession(phone, {
    state: 'await_name',
    pending_action: nextAction || 'menu',
    suggested_name: null,
  });
  await sendText(phone, copy.askNameText());
  return false;
}

async function continueAfterName(phone, action) {
  const a = action || 'menu';
  if (a === 'lunch') {
    await startMeal(phone, 'lunch');
    return;
  }
  if (a === 'dinner') {
    await startMeal(phone, 'dinner');
    return;
  }
  if (a === 'reorder') {
    await tryReorderLast(phone);
    return;
  }
  if (a === 'order' || a === 'catalog_cart') {
    await sendOrderStart(phone);
    return;
  }
  await sendMainMenu(phone);
}

async function sendHelpMenu(phone) {
  const db = getDb();
  const latest = await db.findLatestOrder(phone);
  const payable = await findPayableOrder(phone);
  let context = 'How can we help?';
  if (payable && orderHasOpenCod(payable)) {
    context =
      `Order ${payable.order_ref} is confirmed — COD *${formatPaise(onlinePaymentAmountPaise(payable))}* still due.\n` +
      `Tap *Pay now* to pay online, or ask about delivery.\n\n` +
      acrSupportCallLine();
  } else if (payable && payable.status === 'pending_payment') {
    context =
      `Your order ${payable.order_ref} is waiting for payment (${formatPaise(payable.total_paise)}).\n` +
      `Pick an option below.\n\n` +
      acrSupportCallLine();
  } else if (latest?.status === 'cancelled') {
    context =
      `Order ${latest.order_ref} was cancelled.\n` +
      `We can rebook, check a refund, or answer payment questions.\n\n` +
      acrSupportCallLine();
  } else if (latest) {
    context =
      `Latest order ${latest.order_ref} · ${latest.status}\n` +
      `What do you need help with?\n\n` +
      acrSupportCallLine();
  } else {
    context = `How can we help?\n\n${acrSupportCallLine()}`;
  }

  await sendList(phone, {
    header: 'Help & support',
    body: context,
    button: 'Choose topic',
    footer: 'Call or WhatsApp — kitchen replies',
    sections: [
      {
        title: 'Support',
        rows: [
          {
            id: 'help_payment',
            title: 'Payment failed / paid',
            description: 'Paid but not confirmed, UPI issues',
          },
          {
            id: 'help_cancel',
            title: 'Cancel unpaid order',
            description: 'Only before payment',
          },
          {
            id: 'help_refund',
            title: 'Refund / paid order',
            description: 'Already paid — refund or stop delivery',
          },
          {
            id: 'help_status',
            title: 'Order / delivery status',
            description: 'Where is my food?',
          },
          {
            id: 'help_other',
            title: 'Other issue',
            description: 'Address, taste, packing…',
          },
        ],
      },
    ],
  });
  await db.setSession(phone, { state: 'await_help_topic' });
}

async function handleHelpTopic(phone, topicId) {
  const db = getDb();
  const map = {
    help_payment: 'payment',
    help_cancel: 'cancel_unpaid',
    help_refund: 'refund',
    help_status: 'status',
    help_other: 'other',
    payment: 'payment',
    cancel_unpaid: 'cancel_unpaid',
    refund: 'refund',
    cancelled: 'refund',
    status: 'status',
    other: 'other',
  };
  const topic = map[String(topicId || '').toLowerCase()] || 'other';
  const payable = await findPayableOrder(phone);
  const pending = payable?.status === 'pending_payment' ? payable : null;
  const latest = await db.findLatestOrder(phone);

  if (topic === 'payment' && payable) {
    await db.setSession(phone, { state: 'idle', help_topic: null });
    if (orderHasOpenCod(payable) || payable.status !== 'pending_payment') {
      await sendPayableOrderLink(phone, payable);
      return;
    }
    // Resend full payment card (Pay now button + summary)
    await sendOrderPayment(phone, {
      orderRef: payable.order_ref,
      itemsText: formatLinesText(getOrderLines(payable)),
      foodPaise: payable.food_paise ?? payable.total_paise - (payable.delivery_fee_paise || 0),
      deliveryFeePaise: payable.delivery_fee_paise || 0,
      deliveryLabel: payable.delivery_zone || 'Tenali',
      totalPaise: payable.total_paise,
      address: payable.address,
      customerName: payable.customer_name,
      serviceLabel: payable.service_label,
      meal: payable.meal,
    });
    return;
  }

  if (topic === 'cancel_unpaid') {
    if (pending) {
      await db.setSession(phone, { state: 'idle', help_topic: null });
      await sendButtons(
        phone,
        `Order ${pending.order_ref} is unpaid (${formatPaise(pending.total_paise)}).\n\n` +
          `Tap *Cancel order* to remove it, or *Pay* to complete checkout.\n\n` +
          acrSupportCallLine(),
        [
          { id: 'cancel', title: 'Cancel order' },
          { id: 'help_payment', title: 'Pay now' },
          { id: 'help', title: 'Help menu' },
        ],
      );
      return;
    }
    await db.setSession(phone, { state: 'idle', help_topic: null });
    await sendButtons(
      phone,
      `No unpaid order on this number.\n` +
        (latest
          ? `Latest: ${latest.order_ref} · ${customerStatusLabel(latest.status)}`
          : 'You have not placed an order yet.') +
        `\n\nNeed a refund on a paid order? Tap Help → Refund / paid order.\n\n` +
        acrSupportCallLine(),
      [
        { id: 'status', title: 'My status' },
        { id: 'help', title: 'Help menu' },
        { id: 'start_over', title: 'Start over' },
      ],
    );
    return;
  }

  if (topic === 'refund') {
    if (latest?.status === 'cancelled') {
      await db.setSession(phone, { state: 'await_help_detail', help_topic: 'refund' });
      await sendButtons(
        phone,
        `Order ${latest.order_ref} was cancelled.\n` +
          `${formatLinesText(getOrderLines(latest))} · ${formatPaise(latest.total_paise)}\n\n` +
          `Reply with what you need (refund check / re-order / other).\n` +
          `Or tap Order for a fresh order.\n\n` +
          acrSupportCallLine(),
        [
          orderCtaButton(),
          { id: 'help', title: 'Help again' },
          { id: 'start_over', title: 'Start over' },
        ],
      );
      return;
    }
    if (latest && ['paid', 'preparing', 'out_for_delivery'].includes(latest.status)) {
      await db.setSession(phone, { state: 'await_help_detail', help_topic: 'refund' });
      await sendText(
        phone,
        `Order ${latest.order_ref} is already paid (${latest.status}).\n` +
          `Reply in a short message if you need kitchen to stop/refund — include order ID if you have it.\n\n` +
          `${acrSupportCallLine()}\n\n` +
          `Type Cancel to leave help.`,
      );
      return;
    }
    await db.setSession(phone, { state: 'await_help_detail', help_topic: 'refund' });
    await sendText(
      phone,
      `Tell us what you need (refund / re-order / other). Include order ID if you have it.\n` +
        `Kitchen will reply on WhatsApp.\n\n` +
        `${acrSupportCallLine()}\n\n` +
        `Type Cancel to go back.`,
    );
    return;
  }

  if (topic === 'status' && latest) {
    await db.setSession(phone, { state: 'idle', help_topic: null });
    await sendStatus(phone);
    return;
  }

  await db.setSession(phone, { state: 'await_help_detail', help_topic: topic });
  await sendText(
    phone,
    `Got it — ${
      topic === 'payment'
        ? 'payment issue'
        : topic === 'refund'
          ? 'refund / paid order'
          : topic === 'cancel_unpaid'
            ? 'cancel unpaid order'
            : 'support'
    }.\n\n` +
      `Please type a short message (order ID if any, what went wrong).\n` +
      `We will message you from the kitchen number.\n\n` +
      `${acrSupportCallLine()}\n\n` +
      `Type Cancel to go back.`,
  );
}

async function submitHelpTicket(phone, topic, message) {
  const db = getDb();
  const pending = await db.findLatestPendingOrder(phone);
  const latest = await db.findLatestOrder(phone);
  const orderRef = pending?.order_ref || latest?.order_ref || null;
  const ticket = await db.saveHelpTicket({
    phone,
    topic,
    message: String(message || '').slice(0, 800),
    order_ref: orderRef,
    order_status: pending?.status || latest?.status || null,
  });

  await db.setSession(phone, { state: 'idle', help_topic: null });

  await notifyAdmins(
    `HELP #${ticket.id} · ${topic}\n` +
      `From: ${phone}\n` +
      (orderRef ? `Order: ${orderRef} (${ticket.order_status || '—'})\n` : '') +
      `Msg: ${ticket.message}\n\n` +
      `Reply on WhatsApp to the customer number.`,
  );

  await sendButtons(
    phone,
    `Thanks — we received your request (#${ticket.id}).\n` +
      `Kitchen will check and reply on this chat soon.\n\n` +
      acrSupportCallLine(),
    [
      { id: 'status', title: 'My status' },
      orderCtaButton(),
      { id: 'help', title: 'Help' },
    ],
  );
}

function sessionServiceLabel(session) {
  if (session?.service_label) return session.service_label;
  if (session?.service_date) return session.service_date;
  return nowIst().dayDateLabel;
}

function sessionServiceDay(session) {
  if (session?.service_date) return dayFromIso(session.service_date);
  return nowIst();
}

function sessionIsSundayPartyDinner(session) {
  return isSundayPartyDinnerService(session?.meal, sessionServiceDay(session));
}

async function sendCategoryPicker(phone, meal, session = null) {
  const sess = session || (await getDb().getSession(phone));
  const day = sessionServiceLabel(sess);
  const title = mealTitle(meal);
  const partyOnly = isSundayPartyDinnerService(meal, sessionServiceDay(sess));
  const cats = partyOnly
    ? [{ id: 'packs', title: 'Party packs', emoji: '🍱' }]
    : BROWSE_CATEGORIES;
  const rows = cats.map((c) => ({
    id: `cat_${c.id}`,
    title: `${c.emoji} ${c.title}`.slice(0, 24),
    description: partyOnly
      ? 'Sunday party orders'
      : c.id === 'student'
        ? '₹80 plates · school menu'
        : 'All items in this group',
  }));
  rows.push({
    id: 'nav_back',
    title: '← Back',
    description: 'Home · pick delivery time',
  });
  await sendList(phone, {
    header: `${title} menu`.slice(0, 60),
    body: partyOnly
      ? `${config.businessName}\n` +
        `📅 ${title} · ${day}\n` +
        sundayPartyOrderNoticeShort()
      : `${config.businessName}\n` +
        `📅 ${title} · ${day}\n` +
        `Pick Veg or Non-veg, then add items one by one.`,
    button: 'Categories',
    footer: partyOnly ? 'PARTY PACKS ONLY · or Back' : 'Or tap ← Back',
    sections: [
      {
        title: partyOnly ? 'Party Packs' : 'Menu',
        rows,
      },
    ],
  });
}

async function sendDishList(phone, meal, category, page = 0) {
  const session = await getDb().getSession(phone);
  const cart = Array.isArray(session.cart) ? session.cart : [];
  const dishes = await listDishesForBrowse(meal, category);
  if (!dishes.length) {
    await sendText(phone, `No ${browseCategoryLabel(category)} items available right now.`);
    await sendCategoryPicker(phone, meal);
    return;
  }

  // Leave room for "More" + "← Back" (WhatsApp max 10 rows)
  const pageSize = 8;
  const start = page * pageSize;
  const slice = dishes.slice(start, start + pageSize);
  const hasMore = start + pageSize < dishes.length;
  const day = sessionServiceLabel(await getDb().getSession(phone));

  const rows = slice.map((d) => {
    const inCart = cartQtyForDish(cart, d.code);
    const desc = formatDishListDescription(d, [
      inCart > 0 ? `✓ ${inCart} in cart` : null,
      formatPriceWithMrp(d),
      d.advance_only ? 'Advance' : null,
      d.note || null,
    ]);
    return {
      id: d.code,
      title: formatDishListTitle(d),
      description: desc,
    };
  });

  if (hasMore) {
    rows.push({
      id: `more_${category}_${page + 1}`,
      title: 'More items…',
      description: `Page ${page + 2}`,
    });
  }
  rows.push({
    id: 'nav_back',
    title: '← Back',
    description: sessionIsSundayPartyDinner(session)
      ? 'Home · pick delivery time'
      : 'Back to categories',
  });

  const cartHint =
    cart.length > 0
      ? `\n🛒 ${cartTotalQty(cart)} item(s) in cart — keep picking or checkout when ready.`
      : '';
  await sendList(phone, {
    header: browseCategoryLabel(category).slice(0, 60),
    body:
      `${browseCategoryLabel(category)}` +
      (page > 0 ? ` (page ${page + 1})` : '') +
      `\n📅 ${day}\n` +
      `Tap items one by one — each goes to cart, then pick another.${cartHint}\n` +
      `Or type a code (e.g. ${dishes[0].code}).`,
    button: 'Choose item',
    footer: 'Or tap ← Back',
    sections: [{ title: 'Available', rows }],
  });
}

async function sendQtyPrompt(phone, dish, left) {
  // Hard cap avoids typos / spam (cutoffs + active flag control availability)
  const max = Math.max(0, Math.min(Number(left) || 0, MAX_LINE_QTY));
  if (max < 1) {
    await sendText(
      phone,
      `${formatDishLabel(dish)} is already at the max quantity in your cart (${MAX_LINE_QTY}). Pick another item or edit cart.`,
    );
    return;
  }

  /** Meta reply buttons: max 3 — keep qty step, reserve one slot for ← Back. */
  const buttons = [];
  if (max === 1) {
    buttons.push({ id: 'qty_1', title: '1' });
    buttons.push(BACK_BTN);
  } else {
    buttons.push({ id: 'qty_1', title: '1' });
    buttons.push({ id: 'qty_2', title: '2' });
    buttons.push(BACK_BTN);
  }

  const body =
    `How many of ${formatDishLabel(dish)}?\n` +
    `${formatPaise(dish.price_paise)} each` +
    (max > 2
      ? `\n\nTap 1 or 2, or type a number 1–${max}. Tap ← Back to pick another dish.`
      : `\n\nTap a quantity, or ← Back to pick another dish.`) +
    (dish.note ? `\n(${dish.note})` : '') +
    (dish.advance_only ? `\nNote: advance order item — we will confirm with kitchen.` : '');

  await sendButtons(phone, body, buttons, { footer: `Max ${max} · type qty or BACK` });
}

/** Block any further ordering steps if cutoff passed while browsing */
/** Block cart if same-day window closed mid-order (advance bookings stay open) */
async function guardSessionMealOpen(phone, session) {
  if (isSessionBookingValid(session)) return true;

  const meal = session.meal || 'lunch';
  await getDb().setSession(phone, {
    state: 'idle',
    pending_meal: null,
    meal: null,
    service_date: null,
    service_label: null,
    category: null,
    dish_code: null,
    qty: null,
    address: null,
    delivery_zone: null,
    cart: [],
  });

  if (isMealCallConfirmWindow(meal)) {
    await sendText(phone, mealCallConfirmMessage(meal));
    await sendOrderStart(phone);
    return false;
  }

  await getDb().setSession(phone, {
    state: 'await_slot_confirm',
    pending_meal: meal,
    meal: null,
    service_date: null,
    service_label: null,
    category: null,
    dish_code: null,
    qty: null,
    address: null,
    delivery_zone: null,
    cart: [],
  });
  await sendButtons(
    phone,
    `Today's ${mealTitle(meal)} ordering window closed while you were browsing — cart cleared.\n\n` +
      lateOrderCallHint() + '\n' +
      acrSupportCallLine(),
    [
      orderCtaButton(),
      { id: 'start_over', title: 'Start over' },
      { id: 'help', title: 'Help' },
    ],
    { footer: 'Today only · call if late' },
  );
  return false;
}

async function sendDeliveryPicker(phone, foodPaise, offers) {
  const list = offers || (await getDb().listOffers());
  if (qualifiesFreeDelivery(foodPaise, list)) {
    return false;
  }
  const freeTh = freeDeliveryThresholdPaise(list);
  const freeLine =
    freeTh != null
      ? `Free delivery on food above ${formatPaise(freeTh)}.`
      : 'Delivery fee by distance.';
  const discLines = (await offerLinesForPhone(phone, nowIst().isoDate)).filter((l) =>
    l.includes('off'),
  );
  // List (not 3 reply buttons) so we can include ← Back
  await sendList(phone, {
    header: 'Delivery distance',
    body:
      `Food total: ${formatPaise(foodPaise)}\n\n` +
      `Delivery (Tenali) — approximate distance (kitchen may confirm):\n` +
      `• 0–3 km — ₹30\n` +
      `• 3–6 km — ₹45\n` +
      `• Above 6 km — ₹60\n` +
      `${freeLine}\n` +
      (discLines.length ? `${discLines.join('\n')}\n` : '') +
      `\nHow far is your address?`,
    button: 'Choose distance',
    footer: 'Or tap ← Back to address',
    sections: [
      {
        title: 'Distance',
        rows: [
          { id: 'z1', title: '0–3 km', description: 'Delivery ₹30' },
          { id: 'z2', title: '3–6 km', description: 'Delivery ₹45' },
          { id: 'z3', title: 'Above 6 km', description: 'Delivery ₹60' },
          { id: 'nav_back', title: '← Back', description: 'Change address' },
        ],
      },
    ],
  });
  return true;
}

function parseCategory(raw) {
  const t = String(raw || '').trim().toLowerCase();
  if (t.startsWith('cat_')) return t.slice(4);
  const map = {
    veg: 'veg',
    'veg curries': 'veg',
    nonveg: 'nonveg',
    'non-veg': 'nonveg',
    'non veg': 'nonveg',
    student: 'student',
    'student lunch': 'student',
    school: 'student',
    meals: 'meals',
    rice: 'meals',
    packs: 'packs',
    pack: 'packs',
    party: 'packs',
    'party packs': 'packs',
    combos: 'packs',
    combo: 'packs',
    extras: 'extras',
    extra: 'extras',
  };
  return map[t] || null;
}

/** Start browsing menu for a resolved service day (keeps delivery_slot if already chosen). */
async function beginMealOrdering(phone, meal, serviceDay) {
  const day = serviceDay || orderDayForMeal(meal).serviceDay;
  const partyOnly = isSundayPartyDinnerService(meal, day);
  const prev = await getDb().getSession(phone);
  const deliverySlot = prev?.delivery_slot || null;
  const serviceLabel = deliverySlot
    ? serviceLabelWithSlot(day, deliverySlot)
    : day.dayDateLabel;
  await getDb().setSession(phone, {
    state: 'await_category',
    meal,
    service_date: day.isoDate,
    service_label: serviceLabel,
    delivery_slot: deliverySlot,
    category: partyOnly ? 'packs' : null,
    dish_code: null,
    qty: null,
    address: null,
    delivery_zone: null,
    cart: [],
    pending_action: null,
    pending_meal: null,
  });
  const today = nowIst();
  const isAdvance = day.isoDate !== today.isoDate;

  // WhatsApp Flow — primary path; buttons stay as silent fallback (reply BUTTONS)
  if (config.whatsappFlowId && isWhatsappFlowAllowed(phone)) {
    const token = encodeFlowToken({
      phone,
      meal,
      serviceDate: day.isoDate,
    });
    try {
      await sendFlow(phone, {
        body: copy.flowPlaceOrderBody({
          mealTitle: mealTitle(meal),
          serviceLabel,
          partyOnly,
          partyNotice: partyOnly ? sundayPartyOrderNotice() : '',
        }),
        flowToken: token,
        flowCta: 'Place order',
      });
      return;
    } catch (err) {
      console.error('sendFlow failed — falling back to buttons', err.message || err);
    }
  }

  if (partyOnly) {
    await sendText(
      phone,
      sundayPartyOrderNotice() +
        `\n\n📅 ${mealTitle(meal)} · ${serviceLabel}`,
    );
    await sendDishList(phone, meal, 'packs');
    return;
  }
  await sendText(
    phone,
    copy.buttonMenuFallbackBody({
      mealTitle: mealTitle(meal),
      serviceLabel,
      isAdvance,
    }),
  );
  await sendCategoryPicker(phone, meal);
}

async function continueWithButtons(phone, session) {
  const meal = session.meal || 'dinner';
  const day = session.service_date ? dayFromIso(session.service_date) : orderDayForMeal(meal).serviceDay;
  if (isSundayPartyDinnerService(meal, day)) {
    await getDb().setSession(phone, { state: 'await_dish', category: 'packs' });
    await sendDishList(phone, meal, 'packs');
    return;
  }
  await getDb().setSession(phone, { state: 'await_category', category: null });
  await sendCategoryPicker(phone, meal, session);
}

async function handleFlowCompletion(phone, flowResponse, profileName) {
  // Meta may flatten SUCCESS params at top level or nest under .params
  const params =
    flowResponse?.params && typeof flowResponse.params === 'object'
      ? { ...flowResponse, ...flowResponse.params }
      : flowResponse || {};
  console.log('Flow completion params', {
    keys: Object.keys(params || {}),
    meal: params.meal || null,
    hasAddress: Boolean(String(params.address || '').trim()),
    fulfillment: params.fulfillment_type || null,
    cart_count: params.cart_count || null,
  });
  const meal = params.meal === 'lunch' ? 'lunch' : params.meal === 'dinner' ? 'dinner' : null;
  let address = String(params.address || '').trim();
  let fulfillmentType = String(params.fulfillment_type || '').toLowerCase();
  if (fulfillmentType !== 'pickup' && fulfillmentType !== 'delivery') {
    const sessPeek = await getDb().getSession(phone);
    fulfillmentType = String(sessPeek?.fulfillment_type || '').toLowerCase();
  }
  if (fulfillmentType === 'pickup' && !address) {
    address = 'Pickup at kitchen (Tenali)';
  }
  if (!meal || !address) {
    await sendText(phone, 'Order was incomplete. Tap Order to try again.');
    await sendMainMenu(phone);
    return;
  }
  const booking = resolveBooking(meal, params.service_date || null);
  if (!booking.ok) {
    await sendText(phone, booking.error || 'That meal slot is closed.');
    await sendMainMenu(phone);
    return;
  }

  let cart = [];
  const sessionNow = await getDb().getSession(phone);
  if (Array.isArray(sessionNow?.cart) && sessionNow.cart.length) {
    cart = sessionNow.cart;
  } else {
    // Legacy single-item Flow completion
    const code = String(params.dish_code || '').toUpperCase();
    const built = await buildSingleItemCart({ meal, code, qty: params.qty });
    if (!built.ok) {
      await sendText(phone, built.error || 'Could not add that item.');
      await beginMealOrdering(phone, meal, booking.serviceDay);
      return;
    }
    cart = built.cart;
  }

  if (!cart.length) {
    await sendText(phone, 'Your form cart was empty. Tap Order to try again.');
    await sendMainMenu(phone);
    return;
  }

  if (cartViolatesSundayPartyRule(cart, meal, booking.serviceDay)) {
    await sendText(
      phone,
      sundayPartyOrderNotice() + `\n\nParty Packs only today — please pick again.`,
    );
    await beginMealOrdering(phone, meal, booking.serviceDay);
    return;
  }

  if (profileName) {
    const cust = await getDb().getCustomer(phone);
    if (!cust?.name) await getDb().setCustomerName(phone, profileName);
  }

  // Prefer fulfillment chosen inside Flow; only fall back to chat buttons if missing.
  if (fulfillmentType !== 'pickup' && fulfillmentType !== 'delivery') {
    await getDb().setSession(phone, {
      state: 'await_fulfillment',
      meal,
      service_date: booking.serviceDay.isoDate,
      service_label: booking.serviceDay.dayDateLabel,
      cart,
      address,
      flow_checkout: true,
      fulfillment_type: null,
      category: cart[0]?.category || null,
      dish_code: null,
      qty: null,
      address_lat: null,
      address_lng: null,
      delivery_distance_km: null,
    });
    const session = await getDb().getSession(phone);
    await promptFulfillmentChoice(phone, session);
    return;
  }

  await getDb().setSession(phone, {
    meal,
    service_date: booking.serviceDay.isoDate,
    service_label:
      params.delivery_slot || sessionNow?.delivery_slot
        ? serviceLabelWithSlot(
            booking.serviceDay,
            params.delivery_slot || sessionNow.delivery_slot,
          )
        : booking.serviceDay.dayDateLabel,
    cart,
    address,
    flow_checkout: true,
    fulfillment_type: fulfillmentType,
    delivery_slot:
      fulfillmentType === 'pickup'
        ? null
        : String(params.delivery_slot || sessionNow?.delivery_slot || '').trim() || null,
    category: cart[0]?.category || null,
    dish_code: null,
    qty: null,
  });
  const session = await getDb().getSession(phone);

  if (fulfillmentType === 'pickup') {
    await getDb().setSession(phone, {
      fulfillment_type: 'pickup',
      address: address || 'Pickup at kitchen (Tenali)',
      address_lat: null,
      address_lng: null,
      delivery_distance_km: null,
    });
    await finalizeOrder(
      phone,
      {
        ...session,
        fulfillment_type: 'pickup',
        address: address || 'Pickup at kitchen (Tenali)',
      },
      'pickup',
    );
    return;
  }

  await continueFlowAfterFulfillmentDelivery(phone, {
    ...session,
    fulfillment_type: 'delivery',
    address,
  });
}

/** Shared Delivery | Pickup buttons (button checkout + Flow completion). */
async function promptFulfillmentChoice(phone, session) {
  const cart = Array.isArray(session?.cart) ? session.cart : [];
  const minOrder = await minOrderPaiseForSession(session);
  await getDb().setSession(phone, { state: 'await_fulfillment' });
  await sendButtons(
    phone,
    `How should we fulfil this order?\n\n` + formatCartMessage(cart, { minOrderPaise: minOrder }),
    [
      { id: 'fulfill_delivery', title: 'Delivery' },
      { id: 'fulfill_pickup', title: 'Pickup' },
      { id: 'nav_back', title: '← Cart' },
    ],
    { footer: 'Pickup = collect at kitchen' },
  );
}

/**
 * After Flow customer picks Delivery — continue pin / fee path (prefill pin if any).
 */
async function continueFlowAfterFulfillmentDelivery(phone, session) {
  if (!session.delivery_slot) {
    await sendSlotPicker(phone, { ...session, fulfillment_type: 'delivery', flow_checkout: true });
    return;
  }
  const address = String(session.address || '').trim();
  const preLat = session.flow_prefill_lat != null ? Number(session.flow_prefill_lat) : null;
  const preLng = session.flow_prefill_lng != null ? Number(session.flow_prefill_lng) : null;
  if (Number.isFinite(preLat) && Number.isFinite(preLng)) {
    await getDb().setSession(phone, {
      flow_prefill_lat: null,
      flow_prefill_lng: null,
      flow_prefill_name: null,
      suggest_pin_lat: preLat,
      suggest_pin_lng: preLng,
      fulfillment_type: 'delivery',
      flow_checkout: true,
    });
    await proceedWithLocationPin(phone, await getDb().getSession(phone), {
      latitude: preLat,
      longitude: preLng,
      name: session.flow_prefill_name || null,
      address,
    });
    return;
  }
  await continueFlowDelivery(phone, { ...session, fulfillment_type: 'delivery' }, address);
}

/**
 * After Flow Delivery chosen: offer map pin (optional) for kitchen + fee zone.
 * Customer can skip pin and pick km band instead.
 */
async function continueFlowDelivery(phone, session, addressText) {
  const db = getDb();
  const landmark = String(addressText || session.address || '').trim();

  const cust = await db.getCustomer(phone);
  const savedPins = (cust?.addresses || [])
    .filter((a) => a.lat != null && a.lng != null && Number.isFinite(Number(a.lat)))
    .slice()
    .sort((a, b) =>
      String(b.last_used_at || '').localeCompare(String(a.last_used_at || '')),
    );
  const best = savedPins[0] || null;

  if (best) {
    await db.setSession(phone, {
      state: 'await_flow_pin',
      flow_checkout: true,
      address: landmark,
      suggest_pin_lat: Number(best.lat),
      suggest_pin_lng: Number(best.lng),
      suggest_pin_name: best.location_name || null,
      suggest_pin_text: best.text || null,
    });
    const approx = deliveryZoneFromPin(Number(best.lat), Number(best.lng));
    const zoneLabel =
      approx.zone === 'z1' ? '0–3 km' : approx.zone === 'z2' ? '3–6 km' : '6+ km';
    await sendButtons(
      phone,
      copy.flowSavedPinPrompt({
        landmark,
        distanceLabel: formatDistanceKm(approx.km),
        zoneLabel,
      }),
      [
        { id: 'flow_pin_saved', title: 'Use saved pin' },
        { id: 'flow_pin_new', title: 'New pin' },
        { id: 'flow_pin_skip', title: 'Skip pin' },
      ],
      { footer: 'Pin optional · Skip → distance' },
    );
    return;
  }

  await promptFlowDeliveryPin(phone, landmark);
}

async function promptFlowDeliveryPin(phone, landmark) {
  await getDb().setSession(phone, {
    state: 'await_flow_pin',
    flow_checkout: true,
    address: String(landmark || '').trim(),
    suggest_pin_lat: null,
    suggest_pin_lng: null,
  });
  await sendLocationRequest(phone, copy.flowDeliveryPinPrompt(landmark));
  await sendButtons(
    phone,
    'Pin skip చేసి distance pick చేయాలా?',
    [
      { id: 'flow_pin_skip', title: 'Skip pin' },
      { id: 'start_over', title: 'Start over' },
    ],
    { footer: 'Share location · Maps link · or Skip' },
  );
}

/** Skip optional pin → address + km-band fee path (same as button checkout). */
async function skipFlowPinAndContinue(phone, session) {
  const address = String(session.address || '').trim();
  if (address.length < 8) {
    await sendText(
      phone,
      'Please send a fuller address (tower / flat / landmark), then Skip pin again.',
    );
    return;
  }
  await getDb().setSession(phone, {
    flow_checkout: false,
    catalog_checkout: false,
    address_lat: null,
    address_lng: null,
    delivery_distance_km: null,
  });
  await proceedWithAddress(
    phone,
    {
      ...session,
      flow_checkout: false,
      catalog_checkout: false,
      address_lat: null,
      address_lng: null,
      delivery_distance_km: null,
    },
    address,
    null,
  );
}

/** After Catalog Place order (or resume after name): ask Lunch/Dinner, then address → pay. */
async function promptCatalogMeal(phone, { skipped = [] } = {}) {
  const session = await getDb().getSession(phone);
  const cart = Array.isArray(session.cart) ? session.cart : [];
  if (!cart.length) {
    await sendText(phone, 'Catalog cart was empty. Open the catalog and tap Place order again.');
    await sendMainMenu(phone);
    return;
  }
  await getDb().setSession(phone, {
    state: 'await_catalog_meal',
    meal: null,
    service_date: null,
    service_label: null,
    pending_action: 'catalog_cart',
    dish_code: null,
    qty: null,
  });
  let body =
    `🛒 ${formatLinesText(cart)}\n\n` +
    `Catalog checkout is paused — tap *View Menu & Order* to continue.`;
  if (skipped.length) body += `\nSkipped: ${skipped.slice(0, 6).join(', ')}`;
  await sendButtons(
    phone,
    body,
    [
      orderCtaButton(),
      { id: 'help', title: 'Help' },
      { id: 'start_over', title: 'Start over' },
    ],
    { footer: 'Menu + order in form' },
  );
}

async function applyCatalogMealChoice(phone, meal) {
  const m = meal === 'dinner' ? 'dinner' : 'lunch';
  const session = await getDb().getSession(phone);
  const rawCart = Array.isArray(session.cart) ? session.cart : [];
  const { cart, skipped } = await filterCartForMeal(rawCart, m);
  if (!cart.length) {
    await sendText(
      phone,
      `None of those items are available for ${mealTitle(m)}` +
        (skipped.length ? ` (skipped: ${skipped.slice(0, 8).join(', ')})` : '') +
        '.\nTap Order to pick a delivery time, or Start over.',
    );
    await sendOrderStart(phone);
    return;
  }

  if (isMealCallConfirmWindow(m)) {
    await sendText(phone, mealCallConfirmMessage(m));
    await sendOrderStart(phone);
    return;
  }

  if (!isMealOpen(m)) {
    await getDb().setSession(phone, {
      pending_meal: m,
      pending_action: 'catalog_cart',
      meal: null,
      cart,
      category: cart[0]?.category || null,
    });
    await offerAdvanceOrToday(phone, m);
    return;
  }

  const booking = resolveBooking(m);
  if (!booking.ok) {
    await sendText(phone, booking.error || 'That meal slot is closed.');
    await promptCatalogMeal(phone);
    return;
  }

  await startCatalogPinCheckout(phone, {
    meal: booking.meal,
    serviceDay: booking.serviceDay,
    cart,
    skipped,
  });
}

/** Catalog meal locked → address pick (saved/new), then map pin like Flow. */
async function startCatalogPinCheckout(phone, { meal, serviceDay, cart, skipped = [] }) {
  const foodPaise = cartFoodPaise(cart);
  const minOrder = await minOrderPaiseForSession({ meal, service_date: serviceDay.isoDate, cart });
  if (foodPaise < minOrder) {
    await sendText(
      phone,
      `Minimum order is ${formatPaise(minOrder)} (food).\n` +
        `Your cart is ${formatPaise(foodPaise)}. Add more in the catalog, then Place order again.`,
    );
    await sendMainMenu(phone);
    return;
  }

  await getDb().setSession(phone, {
    state: 'await_cart',
    meal,
    service_date: serviceDay.isoDate,
    service_label: serviceDay.dayDateLabel,
    cart,
    category: cart[0]?.category || null,
    pending_meal: null,
    pending_action: null,
    dish_code: null,
    qty: null,
    address: null,
    flow_checkout: true,
    catalog_checkout: true,
    address_lat: null,
    address_lng: null,
    delivery_distance_km: null,
  });

  let note = `🛒 ${mealTitle(meal)} · ${serviceDay.dayDateLabel}\n${formatLinesText(cart)}`;
  if (skipped.length) note += `\nSkipped: ${skipped.slice(0, 6).join(', ')}`;
  await sendText(phone, note);

  const next = await getDb().getSession(phone);
  await beginCheckout(phone, next);
}

/**
 * Native Catalog cart / product tap — ordering is Flow-only; redirect.
 */
async function handleCatalogOrder(phone, _productItems, _profileName) {
  if (await blockIfUnpaidPending(phone)) return;
  await redirectCatalogToOrder(phone, {
    reason: 'Catalog checkout is no longer used. Please order with the form.',
  });
}

async function handleCatalogEnquiry(phone, _code, _profileName) {
  await redirectCatalogToOrder(phone, {
    reason: 'Please order with the form (not Catalog).',
  });
}

/** After same-day cutoff / closed: other meal today via Order, else call (no next-day WA). */
async function offerAdvanceOrToday(phone, meal) {
  try {
    await getDb().getOpsSettings();
  } catch {
    /* keep cache */
  }
  if (isMealCallConfirmWindow(meal)) {
    await sendText(phone, mealCallConfirmMessage(meal));
    await sendOrderStart(phone);
    return;
  }
  if (isMealOpen(meal)) {
    await beginMealOrdering(phone, meal, nowIst());
    return;
  }

  const other = otherMealOpenToday(meal);
  if (other) {
    await sendText(
      phone,
      `${mealTitle(meal)} ఈరోజు online మూసి.\n` +
        `${mealTitle(other)} open ఉంటే *View Menu & Order* నొక్కండి.\n` +
        lateOrderCallHint() + '\n\n' +
        acrSupportCallLine(),
    );
    await sendOrderStart(phone);
    return;
  }

  await getDb().setSession(phone, {
    state: 'idle',
    pending_meal: null,
    meal: null,
    cart: [],
  });
  await sendButtons(
    phone,
    advanceSlotPrompt(meal),
    [
      orderCtaButton(),
      { id: 'start_over', title: 'Start over' },
      { id: 'help', title: 'Help' },
    ],
    { footer: 'Today only · call if late' },
  );
}

async function startMeal(phone, meal, profileName) {
  // Explicit Lunch/Dinner (button fallback) → browse that meal; time later in Flow/checkout.
  if (!(await ensureCustomerName(phone, 'order', profileName))) return;
  if (await blockIfUnpaidPending(phone)) return;
  const m = meal === 'dinner' ? 'dinner' : 'lunch';
  if (!isMealOpen(m)) {
    await sendOrderStart(phone, profileName);
    return;
  }
  await beginMealOrdering(phone, m, nowIst());
}

/** Re-load last successful order lines after customer picks meal in Flow / buttons */
async function tryReorderLast(phone, profileName) {
  if (!(await ensureCustomerName(phone, 'reorder', profileName))) return;
  if (await blockIfUnpaidPending(phone)) return;

  const db = getDb();
  const last = await db.findLatestOrder(phone);
  if (!last) {
    await sendText(phone, 'No previous order found. Tap View Menu & Order to start.');
    await sendMainMenu(phone);
    return;
  }
  const lines = getOrderLines(last);
  if (!lines.length) {
    await sendText(phone, 'Could not re-add previous order. Please order again.');
    await sendMainMenu(phone);
    return;
  }

  await db.setSession(phone, {
    pending_action: 'reorder',
    cart: [],
    meal: null,
    delivery_slot: null,
  });
  await sendText(
    phone,
    'We will re-add your previous dishes when you pick Lunch or Dinner in the form (if still available).',
  );
  await sendOrderStart(phone, profileName);
}

async function fillReorderCart(phone, meal, serviceDay) {
  const db = getDb();
  const built = await buildReorderCart({ phone, meal, serviceDay });
  if (built.partyNotice) {
    await sendText(phone, built.partyNotice + `\n\nPlease pick a Party Pack.`);
    await beginMealOrdering(phone, meal, serviceDay);
    return;
  }
  if (!built.cart.length) {
    await sendText(phone, 'Previous items are not available. Please order fresh from the menu.');
    await beginMealOrdering(phone, meal, serviceDay);
    return;
  }

  await db.setSession(phone, {
    state: 'await_cart',
    meal,
    service_date: serviceDay.isoDate,
    service_label: serviceDay.dayDateLabel,
    cart: built.cart,
    dish_code: null,
    qty: null,
    category: null,
    pending_action: null,
    pending_meal: null,
  });

  const food = cartFoodPaise(built.cart);
  await sendText(
    phone,
    `📅 Service: ${serviceDay.dayDateLabel} · ${mealTitle(meal)}\n` +
      copy.reorderConfirm(formatLinesText(built.cart), formatPaise(food)) +
      (built.missing.length ? `\n\nNote: ${built.missing.slice(0, 3).join(', ')} unavailable.` : ''),
  );
  await sendCartActions(phone, { ...(await db.getSession(phone)), cart: built.cart, meal });
}

async function pickDish(phone, session, code) {
  const db = getDb();
  const cart = Array.isArray(session.cart) ? session.cart : [];
  const dish = await db.getDish(code);
  if (!dish || !dish.active) {
    await sendText(phone, 'Unknown or unavailable item. Pick from the list or type BACK.');
    if (session.category) await sendDishList(phone, session.meal, session.category);
    else await sendCategoryPicker(phone, session.meal, session);
    return;
  }
  if (sessionIsSundayPartyDinner(session) && dish.category !== 'packs') {
    await sendText(
      phone,
      sundayPartyOrderNotice() +
        `\n\n${formatDishLabel(dish)} is not available on Sundays. Please choose a Party Pack.`,
    );
    await sendDishList(phone, session.meal, 'packs');
    return;
  }
  if (session.meal && dish.meal !== 'both' && dish.meal !== session.meal) {
    await sendText(phone, `${formatDishLabel(dish)} is not available for ${session.meal}.`);
    return;
  }
  if (cart.length >= MAX_CART_LINES) {
    await sendText(
      phone,
      `Cart can hold up to ${MAX_CART_LINES} different items. Checkout or remove items (CLEAR).`,
    );
    await sendCartActions(phone, session);
    return;
  }
  const left = remainingForDish(dish, cart);
  if (left <= 0) {
    await sendText(
      phone,
      `${formatDishLabel(dish)} is already at max quantity in your cart (${MAX_LINE_QTY}). Edit cart or pick another.`,
    );
    await sendDishList(phone, session.meal, dish.category);
    return;
  }
  await db.setSession(phone, {
    state: 'await_qty',
    category: dish.category,
    dish_code: dish.code,
  });
  await sendQtyPrompt(phone, dish, left);
}

async function sendCartActions(phone, session) {
  const cart = Array.isArray(session.cart) ? session.cart : [];
  const minOrder = await minOrderPaiseForSession(session);
  const food = cartFoodPaise(cart);
  const canCheckout = food >= minOrder && cart.length > 0;
  const hasItems = cart.length > 0;
  const offerLines = await offerLinesForPhone(phone, session.service_date || nowIst().isoDate);

  let buttons;
  if (canCheckout) {
    // Max 3 buttons: Edit via typing EDIT / Edit cart
    buttons = [
      { id: 'cart_add', title: 'Add more' },
      { id: 'cart_checkout', title: 'Checkout' },
      BACK_BTN,
    ];
  } else if (hasItems) {
    buttons = [
      { id: 'cart_add', title: 'Add more' },
      { id: 'cart_edit', title: 'Edit cart' },
      BACK_BTN,
    ];
  } else {
    buttons = [
      { id: 'cart_add', title: 'Add items' },
      orderCtaButton(),
      BACK_BTN,
    ];
  }

  await sendButtons(
    phone,
    `${formatCartMessage(cart, { minOrderPaise: minOrder, offerLines })}\n\n` +
      `📅 Service: ${sessionServiceLabel(session)} · ${mealTitle(session.meal || 'lunch')}\n` +
      (canCheckout
        ? 'Add more, checkout, or ← Back. Type EDIT to change qty.'
        : hasItems
          ? minOrder > 0
            ? `Add more or edit cart. Min order ${formatPaise(minOrder)}. ← Back to menu.`
            : 'Edit cart, add items, or ← Back.'
          : 'Cart empty — add dishes to continue.'),
    buttons,
    { footer: canCheckout ? 'EDIT · CLEAR · BACK' : 'CLEAR cart · BACK · Cancel' },
  );
  await getDb().setSession(phone, { state: 'await_cart', edit_code: null });
}

/** After adding an item — quick loop back to same category or browse elsewhere. */
async function sendPostAddActions(phone, session) {
  const cart = Array.isArray(session.cart) ? session.cart : [];
  const minOrder = await minOrderPaiseForSession(session);
  const food = cartFoodPaise(cart);
  const canCheckout = food >= minOrder && cart.length > 0;
  const cat = session.category;
  const catName = cat ? categoryLabel(cat) : null;

  const buttons = [];
  if (cat) buttons.push({ id: 'add_same_cat', title: 'Add another' });
  else buttons.push({ id: 'cart_add', title: 'Add more' });
  if (canCheckout) buttons.push({ id: 'cart_checkout', title: 'Checkout' });
  else buttons.push({ id: 'cart_view', title: 'View cart' });
  buttons.push(BACK_BTN);

  const nextStep = cat
    ? `Add another from ${catName}, ← Back to dishes, or ${canCheckout ? 'checkout' : 'view cart'}.`
    : canCheckout
      ? 'Add more items, checkout, or ← Back.'
      : 'Add more items, view cart, or ← Back.';

  await sendButtons(
    phone,
    `${formatCartMessage(cart, { minOrderPaise: minOrder })}\n\n` +
      `📅 ${sessionServiceLabel(session)} · ${mealTitle(session.meal || 'lunch')}\n` +
      nextStep,
    buttons,
    { footer: 'Edit cart · CLEAR · BACK' },
  );
  await getDb().setSession(phone, { state: 'await_cart', edit_code: null });
}

/** Pick a cart line to change qty or remove (list, max 9 lines + Done) */
async function sendCartEditList(phone, session) {
  const cart = Array.isArray(session.cart) ? session.cart : [];
  if (!cart.length) {
    await sendText(phone, 'Cart is empty — nothing to edit.');
    await sendCartActions(phone, { ...session, cart: [] });
    return;
  }

  const rows = cart.slice(0, 9).map((i) => {
    const lineTotal = formatPaise((i.unit_price_paise || 0) * (i.qty || 0));
    return {
      id: `editline_${i.code}`,
      title: `${i.qty}x ${lineDisplayName(i)}`.slice(0, 24),
      description: `${lineTotal} · tap to change/remove`.slice(0, 72),
    };
  });
  rows.push({
    id: 'edit_done',
    title: '← Back',
    description: 'Back to cart options',
  });

  await sendList(phone, {
    header: 'Edit cart',
    body:
      `${formatCartMessage(cart, { minOrderPaise: await minOrderPaiseForSession(session), numbered: true })}\n\n` +
      `Select a line to change quantity or remove.`,
    button: 'Choose line',
    footer: 'Or tap ← Back / Done',
    sections: [{ title: 'Your items', rows }],
  });
  await getDb().setSession(phone, { state: 'await_cart_edit', edit_code: null });
}

async function sendCartLineEditor(phone, session, code) {
  const db = getDb();
  const cart = Array.isArray(session.cart) ? session.cart : [];
  const line = cart.find((i) => String(i.code).toUpperCase() === String(code).toUpperCase());
  if (!line) {
    await sendText(phone, 'That item is not in your cart.');
    await sendCartEditList(phone, session);
    return;
  }

  const maxQ = maxQtyForCartLine(null, cart, line.code);
  const cap = Math.max(1, maxQ || line.qty || 1);

  const rows = [];
  // WhatsApp list: max 10 rows. Use 1–8 qty + type-custom note + remove + back
  const listCap = Math.min(8, cap);
  for (let n = 1; n <= listCap; n++) {
    rows.push({
      id: `setqty_${n}`,
      title: n === line.qty ? `${n} (current)` : `Set qty ${n}`,
      description: formatPaise((line.unit_price_paise || 0) * n),
    });
  }
  if (cap > 8) {
    rows.push({
      id: 'setqty_type',
      title: 'Type a number',
      description: `Enter 1–${cap} as text`,
    });
  }
  rows.push({
    id: 'setremove',
    title: 'Remove item',
    description: `Remove ${lineDisplayName(line)}`,
  });
  rows.push({
    id: 'edit_back',
    title: '← Back',
    description: 'Pick another item',
  });

  await sendList(phone, {
    header: 'Change line',
    body:
      `${line.qty}x ${lineDisplayName(line)}\n` +
      `Unit: ${formatPaise(line.unit_price_paise)}\n` +
      `Max per item: ${cap}\n` +
      (cap > 8
        ? `\nPick 1–${listCap} below, or Type a number then reply with 1–${cap}.`
        : `\nPick new quantity, or remove.`),
    button: 'Change',
    footer: 'Or ← Back · type 0 to remove',
    sections: [{ title: 'Options', rows: rows.slice(0, 10) }],
  });
  await db.setSession(phone, { state: 'await_cart_line', edit_code: line.code });
}

async function applyCartLineChange(phone, session, qtyOrRemove) {
  const db = getDb();
  const cart = Array.isArray(session.cart) ? session.cart : [];
  const code = session.edit_code;
  if (!code) {
    await sendCartEditList(phone, session);
    return;
  }

  const dish = await db.getDish(code);
  const line = cart.find((i) => String(i.code).toUpperCase() === String(code).toUpperCase());
  const name = line ? lineDisplayName(line) : code;

  if (qtyOrRemove === 'remove' || qtyOrRemove === 0) {
    const { cart: next } = setCartLineQty(cart, code, 0);
    await db.setSession(phone, { cart: next, edit_code: null });
    await sendText(phone, `Removed ${name} from cart.`);
    if (!next.length) {
      await sendCartActions(phone, { ...session, cart: next });
      return;
    }
    await sendCartEditList(phone, { ...session, cart: next });
    return;
  }

  const qty = Number(qtyOrRemove);
  const maxQ = maxQtyForCartLine(dish, cart, code);
  if (!Number.isInteger(qty) || qty < 1 || qty > maxQ) {
    await sendText(phone, `Choose a quantity from 1 to ${Math.max(1, maxQ)} (or remove).`);
    await sendCartLineEditor(phone, session, code);
    return;
  }

  const { cart: next, error } = setCartLineQty(cart, code, qty);
  if (error) {
    await sendText(phone, error);
    await sendCartEditList(phone, session);
    return;
  }
  await db.setSession(phone, { cart: next, edit_code: null });
  await sendText(phone, `Updated: ${qty}x ${name}.`);
  await sendCartEditList(phone, { ...session, cart: next });
}

async function beginCheckout(phone, session) {
  if (!(await guardSessionMealOpen(phone, session))) return;
  const cart = Array.isArray(session.cart) ? session.cart : [];
  const foodPaise = cartFoodPaise(cart);
  const minOrder = await minOrderPaiseForSession(session);
  if (!cart.length) {
    await sendText(phone, 'Cart is empty. Tap Order to start.');
    await sendMainMenu(phone);
    return;
  }
  if (foodPaise < minOrder) {
    await sendText(
      phone,
      `Minimum order is ${formatPaise(minOrder)} (food).\n` +
        `Your cart is ${formatPaise(foodPaise)}. Add more items.`,
    );
    await sendCartActions(phone, session);
    return;
  }

  // Food: ask Pickup vs Delivery once before address / fee
  if (!session.fulfillment_type) {
    await promptFulfillmentChoice(phone, session);
    return;
  }

  if (isPickupSession(session)) {
    const address = String(session.address || '').trim() || 'Pickup at kitchen (Tenali)';
    await getDb().setSession(phone, {
      fulfillment_type: 'pickup',
      address,
      address_lat: null,
      address_lng: null,
      delivery_distance_km: null,
      delivery_slot: null,
    });
    await finalizeOrder(
      phone,
      { ...session, fulfillment_type: 'pickup', address, delivery_slot: null },
      'pickup',
    );
    return;
  }

  // Delivery: pick 30-min window before address / pin
  if (!session.delivery_slot) {
    await sendSlotPicker(phone, session);
    return;
  }

  const cust = await getDb().getCustomer(phone);
  const saved = (cust?.addresses || []).slice().sort((a, b) =>
    String(b.last_used_at || '').localeCompare(String(a.last_used_at || '')),
  );

  if (saved.length) {
    await getDb().setSession(phone, {
      state: 'await_address_pick',
      dish_code: null,
      qty: null,
    });
    const rows = saved.slice(0, 8).map((a, i) => ({
      id: `addr_${a.id}`,
      title: `${i + 1}. ${(a.location_name || a.text || '').slice(0, 18)}`.slice(0, 24),
      description: a.lat
        ? `📍 Saved pin · ${(a.text || '').slice(0, 55)}`
        : (a.text || '').slice(0, 72),
    }));
    rows.push({
      id: 'addr_new',
      title: 'New address',
      description: 'Share location pin or type address',
    });
    rows.push({
      id: 'nav_back',
      title: '← Back',
      description: 'Back to cart',
    });
    await sendList(phone, {
      header: 'Delivery address',
      body: copy.savedAddressPrompt(formatCartMessage(cart, { minOrderPaise: minOrder })),
      button: 'Addresses',
      footer: 'Or tap ← Back to cart',
      sections: [{ title: 'Addresses', rows }],
    });
    return;
  }

  await getDb().setSession(phone, {
    state: 'await_address',
    dish_code: null,
    qty: null,
  });
  await promptNewDeliveryAddress(phone, session);
}

async function promptNewDeliveryAddress(phone, session) {
  const minOrder = await minOrderPaiseForSession(session);
  const body = copy.askAddressNewText(
    formatCartMessage(session.cart || [], { minOrderPaise: minOrder }),
  );
  await sendLocationRequest(phone, body);
  await sendButtons(
    phone,
    '← Back to cart, or Start over.',
    [BACK_BTN, { id: 'start_over', title: 'Start over' }],
    { footer: 'Share pin above' },
  );
}

async function sendSlotPicker(phone, session) {
  // Prefer combined windows (order-start / missing slot). Meal-scoped if meal already locked.
  const meal = session.meal === 'dinner' || session.meal === 'lunch' ? session.meal : null;
  const candidates = meal
    ? planMealSlotCandidates({
        meal,
        serviceDate: session.service_date || nowIst().isoDate,
      }).map((s) => ({ ...s, meal }))
    : planAllMealSlotCandidates();
  if (!candidates.length) {
    await sendButtons(
      phone,
      `No delivery slots left right now.\nLead time is ${getSlotLeadMinutes()} min.\n\n` +
        acrSupportCallLine(),
      [
        orderCtaButton(),
        { id: 'start_over', title: 'Start over' },
        { id: 'help', title: 'Help' },
      ],
      { footer: 'Slots closed' },
    );
    return;
  }

  const rows = candidates.slice(0, 9).map((s) => ({
    id: `slot_${s.id}`,
    title: `${s.label}`.slice(0, 24),
    description: slotOptionDescription(s),
  }));
  rows.push({
    id: 'nav_back',
    title: '← Back',
    description: 'Back',
  });

  await getDb().setSession(phone, {
    state: 'await_delivery_slot',
    meal: meal || session.meal || null,
    service_date: session.service_date || null,
  });
  await sendList(phone, {
    header: 'Delivery time',
    body:
      `🛒 ${formatLinesText(session.cart || [])}\n\n` +
      `Pick a delivery window (${getSlotLeadMinutes()} min lead).`,
    button: 'Choose time',
    footer: 'Or ← Back',
    sections: [{ title: 'Available slots', rows }],
  });
}

async function applyDeliverySlot(phone, session, slotIdRaw) {
  const db = getDb();
  const idRaw = String(slotIdRaw || '').replace(/^slot_/i, '');
  const parsed = parseSlotId(idRaw);
  if (!parsed || !isSlotTimeOpen(parsed.isoDate, parsed.startMin)) {
    await sendText(phone, 'That slot is no longer available. Pick another.');
    await sendOrderSlotPicker(phone);
    return;
  }
  const slotKey = `${parsed.isoDate}T${String(parsed.hour).padStart(2, '0')}${String(parsed.minute).padStart(2, '0')}`;
  const meal = mealFromSlotId(slotKey);
  if (!meal) {
    await sendText(phone, 'Invalid delivery window. Pick another.');
    await sendOrderSlotPicker(phone);
    return;
  }
  if (isMealCallConfirmWindow(meal) && parsed.isoDate === nowIst().isoDate) {
    await sendText(phone, mealCallConfirmMessage(meal));
    await sendOrderSlotPicker(phone);
    return;
  }
  if (parsed.isoDate !== nowIst().isoDate) {
    await sendText(
      phone,
      `${lateOrderCallHint()}\n\n` + acrSupportCallLine(),
    );
    await sendOrderSlotPicker(phone);
    return;
  }
  const day = dayFromIso(parsed.isoDate);
  const label = serviceLabelWithSlot(day, slotKey);
  const wantReorder = session.pending_action === 'reorder';
  await db.setSession(phone, {
    delivery_slot: slotKey,
    service_date: parsed.isoDate,
    service_label: label,
    meal,
    pending_meal: null,
  });
  const next = await db.getSession(phone);

  if (wantReorder) {
    await db.setSession(phone, { pending_action: null });
    await fillReorderCart(phone, meal, day);
    return;
  }

  if (next.flow_checkout && String(next.address || '').trim().length >= 5) {
    await continueFlowAfterFulfillmentDelivery(phone, {
      ...next,
      fulfillment_type: 'delivery',
      delivery_slot: slotKey,
    });
    return;
  }

  // Cart already building (late slot pick at checkout)
  if (Array.isArray(next.cart) && next.cart.length && next.fulfillment_type === 'delivery') {
    await beginCheckout(phone, next);
    return;
  }

  // Order-start: browse menu for inferred meal
  await beginMealOrdering(phone, meal, day);
}

async function tryAcceptMapsLinkPin(phone, session, text) {
  const coords = await resolveGoogleMapsLocation(text);
  if (!coords) return false;
  await proceedWithLocationPin(phone, session, {
    latitude: coords.latitude,
    longitude: coords.longitude,
    name: null,
    address: String(text || '').trim().slice(0, 200),
  });
  return true;
}

function textLooksLikeMapsLink(text) {
  return Boolean(extractGoogleMapsUrl(text) || /maps\.app\.goo\.gl|goo\.gl\/maps|google\.[^\s]*\/maps/i.test(String(text || '')));
}

async function proceedWithLocationPin(phone, session, location) {
  const lat = Number(location?.latitude);
  const lng = Number(location?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    await sendText(
      phone,
      'Could not read that location pin. Please share again or type your address.',
    );
    return;
  }

  const { km, zone, withinService } = deliveryZoneFromPin(lat, lng);
  if (!withinService) {
    await sendText(
      phone,
      `క్షమించండి — ~${formatDistanceKm(km)}. ` +
        `మేము తెనాలి ~${config.maxDeliveryKm} కి.మీ వరకే డెలివరీ చేస్తాము. ` +
        `దగ్గరి location పంపండి.`,
    );
    if (session.flow_checkout || session.state === 'await_flow_pin') {
      await promptFlowDeliveryPin(phone, session.address || '');
    }
    return;
  }

  // Flow already collected landmark/door — keep it; pin only sets fee zone
  const preferLandmark =
    (session.flow_checkout || session.state === 'await_flow_pin') &&
    String(session.address || '').trim().length >= 8;
  const addressText = preferLandmark
    ? String(session.address).trim()
    : formatLocationAddress(location);
  const zoneLabel = zone === 'z1' ? '0–3 km' : zone === 'z2' ? '3–6 km' : '6+ km';
  await sendText(
    phone,
    `📍 Pin OK · ~${formatDistanceKm(km)} · ${zoneLabel}`,
  );

  const enriched = {
    ...session,
    address: addressText,
    address_lat: lat,
    address_lng: lng,
    location_name: location?.name || session.location_name || null,
    delivery_distance_km: km,
    flow_checkout: false,
  };
  await proceedWithAddress(phone, enriched, addressText, zone, { fromPin: true });
}

async function proceedWithAddress(phone, session, addressText, preferredZone, opts = {}) {
  const db = getDb();
  const address = String(addressText || '').trim();
  if (address.length < 8) {
    await sendText(phone, 'Please send a fuller address (area + landmark).');
    return;
  }
  const cart = Array.isArray(session.cart) ? session.cart : [];
  const foodPaise = cartFoodPaise(cart);
  const offers = await db.listOffers();
  const dayIso = session.service_date || nowIst().isoDate;
  const deliv = await db.getEffectiveDeliverySettings(dayIso);
  await db.setSession(phone, {
    state: 'await_delivery',
    address: addressText,
    address_lat: session.address_lat ?? null,
    address_lng: session.address_lng ?? null,
    location_name: session.location_name ?? null,
    delivery_distance_km: session.delivery_distance_km ?? null,
  });

  const autoFromPin =
    opts.fromPin && preferredZone && ['z1', 'z2', 'z3'].includes(preferredZone);

  // Free-delivery offer OR flat admin mode → no km picker
  if (qualifiesFreeDelivery(foodPaise, offers)) {
    await finalizeOrder(phone, { ...session, address: addressText }, preferredZone || 'z1');
    return;
  }
  if (deliv.mode === DELIVERY_MODES.flat) {
    await sendText(
      phone,
      `Delivery today is a flat rate of ${formatPaise(deliv.flat_paise)} to all Tenali addresses` +
        (deliv.source === 'day_override' ? ' (today’s admin setting)' : '') +
        `.`,
    );
    await finalizeOrder(phone, { ...session, address: addressText }, 'flat');
    return;
  }
  if (autoFromPin) {
    await finalizeOrder(phone, { ...session, address: addressText }, preferredZone);
    return;
  }
  if (preferredZone && ['z1', 'z2', 'z3'].includes(preferredZone)) {
    await finalizeOrder(phone, { ...session, address: addressText }, preferredZone);
    return;
  }

  const custZone = (await db.getCustomer(phone))?.default_zone;
  if (custZone && ['z1', 'z2', 'z3'].includes(custZone)) {
    await sendButtons(
      phone,
      `Use last delivery distance, or change it?\n` +
        `Food ${formatPaise(foodPaise)}`,
      [
        { id: custZone, title: 'Same zone' },
        { id: 'z_pick', title: 'Change km' },
        { id: 'help', title: 'Help' },
      ],
    );
    await db.setSession(phone, {
      state: 'await_delivery',
      address: addressText,
      suggest_zone: custZone,
      address_lat: session.address_lat ?? null,
      address_lng: session.address_lng ?? null,
      location_name: session.location_name ?? null,
      delivery_distance_km: session.delivery_distance_km ?? null,
    });
    return;
  }

  await sendDeliveryPicker(phone, foodPaise, offers);
}

async function finalizeOrder(phone, session, deliveryZone) {
  if (!(await guardSessionMealOpen(phone, session))) return;
  const db = getDb();
  if (await blockIfUnpaidPending(phone)) return;
  const cart = Array.isArray(session.cart) ? session.cart : [];
  if (!cart.length) {
    await sendText(phone, 'Order expired. Start again with Order.');
    await db.setSession(phone, { state: 'idle', cart: [] });
    return;
  }

  const pickup = isPickupSession(session) || deliveryZone === 'pickup';
  let deliverySlot = session.delivery_slot || null;
  if (!pickup) {
    if (!deliverySlot) {
      await sendText(phone, 'Pick a delivery time window first.');
      await sendSlotPicker(phone, session);
      return;
    }
    const parsed = parseSlotId(deliverySlot);
    if (!parsed || !isSlotTimeOpen(parsed.isoDate, parsed.startMin)) {
      await sendText(phone, 'That delivery window closed. Pick another.');
      await db.setSession(phone, { delivery_slot: null });
      await sendSlotPicker(phone, { ...session, delivery_slot: null });
      return;
    }
  } else {
    deliverySlot = null;
  }

  for (const line of cart) {
    const dish = await db.getDish(line.code);
    if (!dish || !dish.active) {
      await sendText(phone, `${lineDisplayName(line)} is unavailable. Update your cart.`);
      await sendCartActions(phone, { ...session, cart });
      return;
    }
    if (line.qty > MAX_LINE_QTY) {
      await sendText(
        phone,
        `Max ${MAX_LINE_QTY} of ${formatDishLabel(dish)} per order. Adjust cart.`,
      );
      await sendCartActions(phone, session);
      return;
    }
  }

  const foodPaise = cartFoodPaise(cart);
  const minOrder = await minOrderPaiseForSession(session);
  if (foodPaise < minOrder) {
    await sendText(
      phone,
      `Minimum order is ${formatPaise(minOrder)}. Cart is ${formatPaise(foodPaise)}.`,
    );
    await sendCartActions(phone, session);
    return;
  }

  const offers = await db.listOffers();
  const dayIso = session.service_date || nowIst().isoDate;
  const deliverySettings = await db.getDeliverySettings();
  const isFirstOrderCustomer = await customerIsFirstOrder(phone);
  const referralWelcome = await referralWelcomeFor(phone);
  let pricing = applyOffers({
    foodPaise,
    zoneId: pickup ? 'z1' : deliveryZone,
    offers,
    deliverySettings,
    dayIso,
    cart,
    isFirstOrderCustomer,
    referralWelcome,
  });
  if (pickup) pricing = applyPickupPricing(pricing, foodPaise);
  pricing = applyWalletCredit(pricing, await walletUseFor(phone, pricing));
  const fee = pricing.delivery_fee_paise;
  const total = pricing.total_paise;
  const discount = pricing.discount_paise;
  const serviceDate = session.service_date || nowIst().isoDate;
  const orderRef = await db.nextOrderRef(session.meal, serviceDate);
  const zone = DELIVERY_ZONES.find((z) => z.id === deliveryZone);
  const storeZone = pickup ? 'pickup' : pricing.zone_id || deliveryZone;
  const primary = cart[0];
  const items = cart.map((i) => ({
    code: i.code,
    name: i.name,
    base_name: i.base_name || null,
    qty: i.qty,
    unit_price_paise: i.unit_price_paise,
    category: i.category,
    cook_name: i.cook_name || null,
    amma_id: i.amma_id || null,
  }));
  const cust = await db.getCustomer(phone);
  const addressText = pickup
    ? String(session.address || '').trim() || 'Pickup at kitchen (Tenali)'
    : session.address;
  const serviceLabel = deliverySlot
    ? serviceLabelWithSlot(serviceDate, deliverySlot)
    : session.service_label || nowIst().dayDateLabel;

  if (!pickup) {
    await db.saveCustomerAddress(phone, {
      text: addressText,
      zone: storeZone === 'flat' ? undefined : storeZone,
      lat: session.address_lat ?? undefined,
      lng: session.address_lng ?? undefined,
      location_name: session.location_name ?? undefined,
    });
  }
  await db.noteCustomerOrder(phone);
  await db.createOrder({
    order_ref: orderRef,
    phone,
    customer_name: cust?.name || null,
    meal: session.meal,
    service_date: serviceDate,
    service_label: serviceLabel,
    delivery_slot: deliverySlot,
    items,
    dish_code: primary.code,
    dish_name: dishSummaryName(cart),
    category: primary.category,
    qty: cartTotalQty(cart),
    unit_price_paise: primary.unit_price_paise,
    food_paise: foodPaise,
    delivery_zone: storeZone,
    delivery_fee_paise: fee,
    discount_paise: discount,
    free_delivery: pricing.free_delivery,
    offers_applied: pricing.applied,
    total_paise: total,
    address: addressText,
    status: 'pending_payment',
    source: 'whatsapp',
    meta: {
      discount_paise: discount,
      free_delivery: pricing.free_delivery,
      offers_applied: pricing.applied,
      delivery_mode: pricing.delivery_mode,
      delivery_settings_source: pricing.delivery_settings_source,
      fulfillment_type: pickup ? 'pickup' : 'delivery',
      ...(pricing.applied.some((a) => a.id === 'referral_welcome')
        ? { referral_code: referralWelcome.code }
        : {}),
      ...(pricing.wallet_paise > 0 ? { wallet_paise: pricing.wallet_paise } : {}),
      ...(deliverySlot ? { delivery_slot: deliverySlot } : {}),
      ...(session.address_lat != null ? { delivery_lat: session.address_lat } : {}),
      ...(session.address_lng != null ? { delivery_lng: session.address_lng } : {}),
      ...(session.delivery_distance_km != null
        ? { delivery_distance_km: session.delivery_distance_km }
        : {}),
    },
  });

  // Kitchen alert: unpaid order created (trigger B). Free while admins keep 24h window open.
  try {
    await notifyAdmins(
      formatUnpaidOrderAlert({
        order_ref: orderRef,
        phone,
        customer_name: cust?.name || null,
        meal: session.meal,
        service_date: serviceDate,
        service_label: serviceLabel,
        items,
        food_paise: foodPaise,
        discount_paise: discount,
        delivery_fee_paise: fee,
        total_paise: total,
        address: addressText,
        delivery_lat: session.address_lat ?? null,
        delivery_lng: session.address_lng ?? null,
      }) + (pickup ? '\nFulfilment: PICKUP' : ''),
    );
  } catch (err) {
    console.error('Admin unpaid-order notify failed', err);
  }

  await db.setSession(phone, {
    state: 'idle',
    meal: null,
    service_date: null,
    service_label: null,
    delivery_slot: null,
    category: null,
    dish_code: null,
    qty: null,
    address: null,
    delivery_zone: null,
    fulfillment_type: null,
    cart: [],
    suggest_zone: null,
  });

  await sendOrderPayment(phone, {
    orderRef,
    itemsText: formatLinesText(items),
    foodPaise,
    deliveryFeePaise: fee,
    deliveryLabel:
      pricing.delivery_label ||
      (fee === 0 ? (pickup ? 'Pickup' : 'FREE') : zone?.title || deliveryZone),
    discountPaise: discount,
    offersApplied: pricing.applied,
    totalPaise: total,
    address: addressText,
    customerName: cust?.name,
    serviceLabel: session.service_label || nowIst().dayDateLabel,
    meal: session.meal,
    fulfillmentType: pickup ? 'pickup' : 'delivery',
  });
}

async function sendOrderPayment(phone, {
  orderRef,
  itemsText,
  foodPaise,
  deliveryFeePaise: fee,
  deliveryLabel,
  discountPaise = 0,
  offersApplied = [],
  totalPaise,
  address,
  customerName: cname,
  serviceLabel,
  meal,
  fulfillmentType = 'delivery',
}) {
  const amountRupees = totalPaise / 100;
  const upiUri = buildUpiPayUri({ amountRupees, orderRef });
  const who = cname ? `${cname}, ` : '';
  const when =
    serviceLabel || meal
      ? `Service: ${mealTitle(meal || 'lunch')} · ${serviceLabel || 'today'}\n`
      : '';
  const payLink = isRazorpayReady() ? publicPayUrl(orderRef) : null;
  const withUpi = useUpiPayment();
  const pickup = fulfillmentType === 'pickup';
  const fulfillLine = pickup ? 'Fulfilment: *Pickup* at kitchen\n' : '';
  const codHint = pickup ? 'Cash at pickup' : 'Cash on delivery';

  let payBlock;
  if (payLink && withUpi) {
    payBlock =
      `Pay online (recommended), or choose *${codHint}* below.\n\n` +
      `UPI:\n` +
      `UPI: ${config.upiId}\n` +
      `Name: ${config.upiPayeeName}\n` +
      `Amount: ${formatPaise(totalPaise)}\n` +
      `Note: ${orderRef}\n\n` +
      `After online pay, status updates automatically.\n` +
      `After UPI only, reply: PAID ${orderRef}`;
  } else if (payLink) {
    payBlock =
      `Tap *Pay now* for online payment, or *${codHint}* below.\n` +
      `Online payment updates status automatically.`;
  } else {
    payBlock =
      `Pay via UPI, or choose *${codHint}* below.\n` +
      `UPI: ${config.upiId}\n` +
      `Name: ${config.upiPayeeName}\n` +
      `Amount: ${formatPaise(totalPaise)}\n` +
      `Note: ${orderRef}\n\n` +
      `After UPI, reply: PAID ${orderRef}`;
  }

  const discountLine =
    discountPaise > 0
      ? `Discount: −${formatPaise(discountPaise)}\n` +
        (offersApplied?.length
          ? `  (${offersApplied.map((a) => a.title).join('; ')})\n`
          : '')
      : offersApplied?.length
        ? `Offers: ${offersApplied.map((a) => a.title).join('; ')}\n`
        : '';

  const feeLine = pickup
    ? `Pickup: ${formatPaise(0)}\n`
    : `Delivery (${deliveryLabel}): ${formatPaise(fee)}\n`;

  const summary =
    `${who}Order ${orderRef} noted ✅\n` +
    when +
    fulfillLine +
    `${itemsText}\n` +
    `Food: ${formatPaise(foodPaise)}\n` +
    discountLine +
    feeLine +
    `Total: ${formatPaise(totalPaise)}\n` +
    `Address: ${address}\n\n` +
    payBlock +
    `\n\n` +
    acrSupportCallLine();

  if (payLink) {
    await sendCtaUrl(phone, summary, { displayText: 'Pay now', url: payLink }, {
      footer: 'Or COD below · STATUS · HELP',
    });
    await sendButtons(
      phone,
      `Prefer cash? Tap *${codHint}*.`,
      [
        { id: `pay_cod_${orderRef}`, title: pickup ? 'Cash at pickup' : 'Cash on delivery' },
        { id: 'status', title: 'My status' },
        { id: 'help', title: 'Help' },
      ],
    );
  } else {
    await sendButtons(
      phone,
      summary,
      [
        { id: `pay_cod_${orderRef}`, title: pickup ? 'Cash at pickup' : 'Cash on delivery' },
        { id: 'status', title: 'My status' },
        { id: 'help', title: 'Help' },
      ],
    );
  }

  if (!withUpi) return;

  try {
    await sendUpiQr(
      phone,
      payLink
        ? `UPI fallback · ${formatPaise(totalPaise)} · ${orderRef}\nOr use Pay now / COD above`
        : `Scan & pay ${formatPaise(totalPaise)} · ${orderRef}\nUPI: ${config.upiId}`,
    );
  } catch (err) {
    console.error('UPI QR send failed', err);
    if (!payLink) {
      await sendText(
        phone,
        `Could not send QR.\nPay ${formatPaise(totalPaise)} to ${config.upiId}\nOrder: ${orderRef}\n\n${upiUri}`,
      );
    }
  }
}

async function sendStatus(phone) {
  const order = await getDb().findLatestOrder(phone);
  if (!order) {
    await sendText(phone, 'No orders yet. Tap Order to start.');
    await sendMainMenu(phone);
    return;
  }
  const fee = order.delivery_fee_paise ?? 0;
  const disc = order.discount_paise ?? 0;
  const name = order.customer_name || await customerName(phone);
  let extra = '';
  let pendingPayUrl = null;
  if (order.status === 'pending_payment') {
    pendingPayUrl = isRazorpayReady() ? publicPayUrl(order.order_ref) : null;
    if (pendingPayUrl && useUpiPayment()) {
      extra = `\n\nTap Pay now below, or UPI then reply PAID ${order.order_ref} · Help.\n` + acrSupportCallLine();
    } else if (pendingPayUrl) {
      extra = `\n\nTap Pay now below (status updates after payment) · Help.\n` + acrSupportCallLine();
    } else {
      extra = `\n\nAfter UPI, reply: PAID ${order.order_ref} · or Help.\n` + acrSupportCallLine();
    }
  } else if (order.status === 'cancelled') {
    extra = `\n\nRefund / re-order — type HELP.\n` + acrSupportCallLine();
  } else if (order.status === 'delivered' && !await getDb().getFeedbackByOrder(order.order_ref)) {
    extra = '\n\nRate your food: reply RATE.\n' + acrSupportCallLine();
  } else if (order.status === 'out_for_delivery') {
    const deliv = await getDb().getDeliverySettings();
    const track = resolveDeliveryTrack({ order, settings: deliv });
    const trackExtra = deliveryTrackLines(track).join('\n');
    if (trackExtra) extra = `\n\n${trackExtra}\n` + acrSupportCallLine();
    else extra = `\n\n` + acrSupportCallLine();
  } else {
    // paid / preparing / other kitchen states
    extra = `\n\n` + acrSupportCallLine();
  }

  const statusBody =
    (name ? `${name} · ` : '') +
    `Order ${order.order_ref}\n` +
    `Status: ${customerStatusLabel(order.status)}\n` +
    `${formatLinesText(getOrderLines(order))}\n` +
    `Food: ${formatPaise(order.food_paise ?? order.total_paise - fee + disc)}\n` +
    (disc > 0 ? `Discount: −${formatPaise(disc)}\n` : '') +
    `Delivery: ${formatPaise(fee)}\n` +
    `Total: ${formatPaise(order.total_paise)}\n` +
    `Address: ${order.address}\n` +
    `Meal: ${order.meal}` +
    (order.service_label || order.service_date
      ? `\nService: ${order.service_label || order.service_date}`
      : '') +
    extra;

  if (pendingPayUrl) {
    await sendCtaUrl(phone, statusBody, { displayText: 'Pay now', url: pendingPayUrl }, {
      footer: 'STATUS · HELP — type or MORE menu',
    });
  } else if (order.status === 'out_for_delivery') {
    const deliv = await getDb().getDeliverySettings();
    const track = resolveDeliveryTrack({ order, settings: deliv });
    if (track.track_map_url) {
      await sendCtaUrl(phone, statusBody, {
        displayText: 'Track on map',
        url: track.track_map_url,
      }, { footer: 'On the way' });
      await sendButtons(phone, 'Need anything else?', [
        { id: 'help', title: 'Help' },
        { id: 'status', title: 'My status' },
      ]);
    } else {
      await sendButtons(phone, statusBody, [
        { id: 'help', title: 'Help' },
        { id: 'status', title: 'My status' },
        orderCtaButton(),
      ]);
    }
  } else {
    await sendButtons(phone, statusBody, [
      { id: 'help', title: 'Help' },
      { id: 'status', title: 'My status' },
      orderCtaButton(),
    ]);
  }
}

/** Ordering lives on the website — one CTA with the signed link (wallet / phone prefill). */
async function sendWebsiteOrderLink(phone) {
  await clearOrderingSession(getDb(), phone);
  const url = storefrontFoodUrl(phone);
  try {
    await sendCtaUrl(
      phone,
      copy.storefrontOrderCtaBody(await referPromoLine()),
      { displayText: 'Order on website', url },
      { footer: 'Menu · cart · slot · pay' },
    );
  } catch (err) {
    console.error('storefront CTA failed', err.message || err);
    await sendText(phone, `Open this link to order:\n${url}`);
  }
}

async function clearOrderingSession(db, phone, extra = {}) {
  await db.setSession(phone, {
    state: 'idle',
    meal: null,
    service_date: null,
    service_label: null,
    delivery_slot: null,
    pending_meal: null,
    category: null,
    dish_code: null,
    qty: null,
    address: null,
    delivery_zone: null,
    fulfillment_type: null,
    cart: [],
    help_topic: null,
    poster_slot: null,
    ...extra,
  });
}

async function handleSlotConfirm(phone, lower, session) {
  const db = getDb();
  try {
    await db.getOpsSettings();
  } catch {
    /* keep cache */
  }

  // Hi / Start over always resets to home (do not re-show stale "closed" prompt)
  if (
    ['hi', 'hello', 'hii', 'hey', 'start', 'నమస్కారం'].includes(lower) ||
    isStartOverCommand(lower) ||
    lower === 'cancel' ||
    lower === 'stop'
  ) {
    await goStartOver(phone);
    return;
  }

  const wantReorder = session.pending_action === 'reorder';
  const wantCatalogCart = session.pending_action === 'catalog_cart';
  const pendingMeal = session.pending_meal === 'dinner' ? 'dinner' : 'lunch';

  // If the meal is open again, skip the advance UI
  if (isMealOpen(pendingMeal) && !lower.startsWith('slot_') && lower !== 'lunch' && lower !== 'dinner') {
    await db.setSession(phone, { pending_meal: null, pending_action: null });
    if (wantReorder) {
      await fillReorderCart(phone, pendingMeal, nowIst());
      return;
    }
    if (wantCatalogCart) {
      await redirectCatalogToOrder(phone);
      return;
    }
    await beginMealOrdering(phone, pendingMeal, nowIst());
    return;
  }

  let meal = null;
  let serviceDay = null;

  if (lower.startsWith('slot_next_')) {
    await sendButtons(
      phone,
      `${lateOrderCallHint()}\n\n` + acrSupportCallLine(),
      [
        orderCtaButton(),
        { id: 'start_over', title: 'Start over' },
        { id: 'help', title: 'Help' },
      ],
      { footer: 'Today only · call if late' },
    );
    return;
  } else if (lower.startsWith('slot_today_')) {
    meal = lower === 'slot_today_dinner' ? 'dinner' : 'lunch';
    if (!isMealOpen(meal)) {
      await sendText(phone, `${mealTitle(meal)} is no longer open for today. Pick another option.`);
      await offerAdvanceOrToday(phone, session.pending_meal || meal);
      return;
    }
    serviceDay = nowIst();
  } else if (
    [
      'tomorrow',
      'yes',
      'y',
      'ok',
      'order tomorrow',
      'preorder',
      'pre-order',
      'open day',
      'opening day',
      'book opening',
      'first day',
    ].includes(lower)
  ) {
    await sendButtons(
      phone,
      `${lateOrderCallHint()}\n\n` + acrSupportCallLine(),
      [
        orderCtaButton(),
        { id: 'start_over', title: 'Start over' },
        { id: 'help', title: 'Help' },
      ],
      { footer: 'Today only · call if late' },
    );
    return;
  } else if (lower === 'dinner' || lower === 'lunch') {
    meal = lower;
    if (isMealOpen(meal)) serviceDay = nowIst();
    else {
      await offerAdvanceOrToday(phone, meal);
      return;
    }
  } else {
    await offerAdvanceOrToday(phone, pendingMeal);
    return;
  }

  await db.setSession(phone, { pending_meal: null, pending_action: null });

  if (wantReorder) {
    await fillReorderCart(phone, meal, serviceDay);
    return;
  }
  if (wantCatalogCart) {
    await redirectCatalogToOrder(phone);
    return;
  }
  await beginMealOrdering(phone, meal, serviceDay);
}

export async function handleIncoming(msg) {
  const phone = String(msg.from || msg.phone || '').replace(/\D/g, '');
  const location = msg.location || null;
  const raw = String(msg.text || '').trim();
  const lower = raw.toLowerCase();
  const profile = String(msg.profileName || '').trim().slice(0, 40);
  const db = getDb();
  const session = await db.getSession(phone);

  if (msg.kind === 'flow') {
    if (websiteOrderingOnly()) {
      await sendWebsiteOrderLink(phone);
      return;
    }
    await handleFlowCompletion(phone, msg.flowResponse || {}, profile);
    return;
  }

  if (msg.kind === 'catalog_order') {
    if (websiteOrderingOnly()) {
      await sendWebsiteOrderLink(phone);
      return;
    }
    console.log('Catalog order webhook', {
      phone,
      items: (msg.productItems || []).length,
      catalogId: msg.catalogId || null,
    });
    await handleCatalogOrder(phone, msg.productItems || [], profile);
    return;
  }

  if (msg.kind === 'catalog' && msg.catalogCode) {
    if (websiteOrderingOnly()) {
      await sendWebsiteOrderLink(phone);
      return;
    }
    await handleCatalogEnquiry(phone, msg.catalogCode, profile);
    return;
  }

  // Admin before customer traps (pin / catalog meal) so POSTER + image always reply
  if (await tryHandleAdmin({
    from: phone,
    text: raw,
    kind: msg.kind || 'text',
    image: msg.image || null,
  })) return;

  // Referral code ("Hi SHYAM27") before name / greeting traps, which would swallow it
  if (
    msg.kind === 'text' &&
    raw &&
    !['await_address', 'await_address_pick', 'await_flow_pin'].includes(session.state)
  ) {
    const ref = await captureReferralFromText(phone, raw).catch((err) => {
      console.error('[referrals] capture failed', err.message || err);
      return null;
    });
    if (ref && ref.status !== 'disabled') {
      console.log(`Referral ${ref.status} → ${phone} code=${ref.code || '-'}`);
      const note = referralAppliedText(ref);
      if (note) await sendText(phone, note);
      if (websiteOrderingOnly()) await sendWebsiteOrderLink(phone);
      else await goStartOver(phone, profile);
      return;
    }
  }

  if (websiteOrderingOnly()) {
    if (await tryHandleFeedbackReply({ phone, text: raw })) return;
    if (!websiteModeAllows(lower, session.state)) {
      await sendWebsiteOrderLink(phone);
      return;
    }
    if (isStaleOrderingState(session.state)) {
      await clearOrderingSession(db, phone);
      session.state = 'idle';
    }
  }

  if (session.state === 'await_catalog_meal') {
    // Legacy mid-flight Catalog sessions → Flow order
    await getDb().setSession(phone, {
      state: 'idle',
      pending_action: null,
      cart: [],
      catalog_checkout: false,
    });
    await redirectCatalogToOrder(phone);
    return;
  }

  if (location?.latitude != null && location?.longitude != null) {
    if (
      session.state === 'await_address' ||
      session.state === 'await_address_pick' ||
      session.state === 'await_flow_pin'
    ) {
      await proceedWithLocationPin(phone, session, location);
      return;
    }
    await sendText(
      phone,
      'Thanks for the location pin. Tap Order to order, then share the pin again at checkout.',
    );
    return;
  }

  // Pin step: location / saved-pin / skip / Maps link / Start over
  if (session.state === 'await_flow_pin') {
    if (
      lower === 'start_over' ||
      lower === 'start over' ||
      lower === 'startover' ||
      lower === 'cancel' ||
      lower === 'stop'
    ) {
      await goStartOver(phone, profile);
      return;
    }
    if (
      lower === 'flow_pin_skip' ||
      lower === 'skip pin' ||
      lower === 'skip' ||
      lower === 'no pin'
    ) {
      await skipFlowPinAndContinue(phone, session);
      return;
    }
    if (lower === 'flow_pin_new' || lower === 'new pin' || lower === 'new') {
      await promptFlowDeliveryPin(phone, session.address || '');
      return;
    }
    if (
      lower === 'flow_pin_saved' ||
      lower === 'use saved pin' ||
      lower === 'saved'
    ) {
      const lat = Number(session.suggest_pin_lat);
      const lng = Number(session.suggest_pin_lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        await promptFlowDeliveryPin(phone, session.address || '');
        return;
      }
      await proceedWithLocationPin(phone, session, {
        latitude: lat,
        longitude: lng,
        name: session.suggest_pin_name || null,
        address: session.suggest_pin_text || session.address,
      });
      return;
    }
    if (await tryAcceptMapsLinkPin(phone, session, raw)) return;
    if (textLooksLikeMapsLink(raw)) {
      await sendText(
        phone,
        'Could not read that Maps link.\n' +
          'Try WhatsApp *Share location*, or paste: maps.google.com/?q=16.24,80.64',
      );
      await sendButtons(
        phone,
        'Pin optional — share again or skip.',
        [
          { id: 'flow_pin_skip', title: 'Skip pin' },
          { id: 'start_over', title: 'Start over' },
        ],
        { footer: 'Share location · Maps link · or Skip' },
      );
      return;
    }
    await sendText(
      phone,
      'Map pin optional — share location / Maps link, or tap *Skip pin* for distance fee.',
    );
    if (session.suggest_pin_lat != null) {
      await sendButtons(
        phone,
        'Use saved pin, new pin, or skip?',
        [
          { id: 'flow_pin_saved', title: 'Use saved pin' },
          { id: 'flow_pin_new', title: 'New pin' },
          { id: 'flow_pin_skip', title: 'Skip pin' },
        ],
        { footer: 'Pin optional' },
      );
    } else {
      await sendButtons(
        phone,
        'Share pin or skip to distance?',
        [
          { id: 'flow_pin_skip', title: 'Skip pin' },
          { id: 'start_over', title: 'Start over' },
        ],
        { footer: 'Share location · or Skip' },
      );
    }
    return;
  }

  // Post-delivery item feedback (ratings for ordered dishes only)
  if (await tryHandleFeedbackReply({ phone, text: raw })) return;

  if (lower === 'use_buttons' || lower === 'buttons' || lower === 'use button') {
    if (session.meal) {
      await continueWithButtons(phone, session);
      return;
    }
    await sendMainMenu(phone);
    return;
  }

  if (REFER_COMMANDS.includes(lower)) {
    await sendReferInfo(phone, profile);
    return;
  }
  if (WALLET_COMMANDS.includes(lower)) {
    await sendWalletInfo(phone);
    return;
  }

  // Hi / Start over must win over a stuck "pick lunch/dinner slot" screen
  if (['hi', 'hello', 'hii', 'hey', 'start', 'నమస్కారం'].includes(lower) || isStartOverCommand(lower)) {
    await goStartOver(phone, profile);
    return;
  }

  // ← Back / previous step (keep cart when possible)
  if (isBackCommand(lower) || lower === 'edit_back') {
    if (
      [
        'await_category',
        'await_dish',
        'await_qty',
        'await_cart',
        'await_cart_edit',
        'await_cart_line',
        'await_address_pick',
        'await_address',
        'await_flow_pin',
        'await_delivery',
        'await_fulfillment',
        'await_delivery_slot',
      ].includes(session.state)
    ) {
      if (!(await guardSessionMealOpen(phone, session))) return;
    }
    await goBackOneStep(phone, session);
    return;
  }

  // Delivery window from Order list — always honor (even mid-Flow / after another slot)
  if (
    lower.startsWith('slot_') &&
    !lower.startsWith('slot_next_') &&
    !lower.startsWith('slot_today_')
  ) {
    await applyDeliverySlot(phone, session, lower.replace(/^slot_/i, ''));
    return;
  }

  // After cut-off: confirm tomorrow pre-order or open same-day slot
  if (session.state === 'await_slot_confirm') {
    await handleSlotConfirm(phone, lower, session);
    return;
  }

  if (session.state === 'await_delivery_slot') {
    if (lower === 'nav_back' || isBackCommand(lower)) {
      await goBackOneStep(phone, session);
      return;
    }
    // slot_* already handled above
    await sendSlotPicker(phone, session);
    return;
  }

  // Delivery vs Pickup (button checkout + Order Flow after CONFIRM)
  if (session.state === 'await_fulfillment') {
    if (lower === 'fulfill_delivery' || lower === 'delivery') {
      await db.setSession(phone, { fulfillment_type: 'delivery', delivery_slot: null });
      const next = await db.getSession(phone);
      if (next.flow_checkout) {
        await continueFlowAfterFulfillmentDelivery(phone, {
          ...next,
          fulfillment_type: 'delivery',
          delivery_slot: null,
        });
        return;
      }
      await db.setSession(phone, { state: 'await_cart' });
      await beginCheckout(phone, { ...next, fulfillment_type: 'delivery', delivery_slot: null });
      return;
    }
    if (lower === 'fulfill_pickup' || lower === 'pickup') {
      await db.setSession(phone, {
        fulfillment_type: 'pickup',
        address: 'Pickup at kitchen (Tenali)',
        address_lat: null,
        address_lng: null,
        delivery_distance_km: null,
        flow_prefill_lat: null,
        flow_prefill_lng: null,
      });
      const next = await db.getSession(phone);
      await beginCheckout(phone, {
        ...next,
        fulfillment_type: 'pickup',
        address: 'Pickup at kitchen (Tenali)',
      });
      return;
    }
    if (lower === 'nav_back' || isBackCommand(lower)) {
      if (session.flow_checkout) {
        await db.setSession(phone, {
          state: 'await_cart',
          fulfillment_type: null,
          flow_checkout: false,
        });
        await sendMainMenu(phone);
        return;
      }
      await db.setSession(phone, { state: 'await_cart', fulfillment_type: null });
      await sendCartActions(phone, await db.getSession(phone));
      return;
    }
    await promptFulfillmentChoice(phone, session);
    return;
  }

  // Customer COD on pending payment
  {
    const codMatch = lower.match(/^pay_cod[_ ]([a-z0-9-]+)$/i) || lower.match(/^cod[_ ]([a-z0-9-]+)$/i);
    if (
      codMatch ||
      lower === 'cash on delivery' ||
      lower === 'cash at pickup' ||
      lower === 'cod'
    ) {
      let ref = codMatch?.[1]?.toUpperCase();
      if (!ref) {
        const pending = await db.findLatestPendingOrder(phone);
        ref = pending?.order_ref;
      }
      if (!ref) {
        await sendText(phone, 'No unpaid order found for COD. Tap Order to start.');
        return;
      }
      const result = await confirmCustomerCod(ref);
      if (!result.ok) {
        await sendText(phone, result.error || 'Could not confirm COD.');
        return;
      }
      // Customer WhatsApp comes from applyOrderStatus → paymentThanksMessage (COD copy)
      return;
    }
  }

  // HELP — payment stuck, cancelled, delivery questions
  if (lower === 'help' || lower === 'support') {
    await sendHelpMenu(phone);
    return;
  }

  // List/button help topics work even if session left the help menu
  if (lower.startsWith('help_')) {
    await handleHelpTopic(phone, lower);
    return;
  }

  if (session.state === 'await_help_topic') {
    const topicKey = lower.startsWith('help_')
      ? lower
      : `help_${lower === 'cancelled' || lower === 'cancel' ? 'cancel' : lower}`;
    await handleHelpTopic(phone, topicKey);
    return;
  }

  if (session.state === 'await_help_detail') {
    if (lower === 'cancel' || lower === 'stop') {
      await db.setSession(phone, { state: 'idle', help_topic: null });
      await sendMainMenu(phone);
      return;
    }
    if (lower === 'help') {
      await sendHelpMenu(phone);
      return;
    }
    if (lower === 'lunch' || lower === 'dinner') {
      await db.setSession(phone, { state: 'idle', help_topic: null });
    } else {
      await submitHelpTicket(phone, session.help_topic || 'other', raw);
      return;
    }
  }

  // Confirm WhatsApp profile display name
  if (session.state === 'await_name_confirm') {
    if (isStartOverCommand(lower)) {
      await goStartOver(phone, profile);
      return;
    }
    if (lower === 'name_yes' || lower === 'yes' || lower === 'y' || lower === 'అవును' || lower === 'sare' || lower === 'ok') {
      const name = session.suggested_name || profile;
      const saved = await db.setCustomerName(phone, name);
      const next = session.pending_action || 'menu';
      await db.setSession(phone, { state: 'idle', pending_action: null, suggested_name: null });
      if (saved) await sendText(phone, copy.nameSavedText(saved.name));
      await continueAfterName(phone, next);
      return;
    }
    if (lower === 'name_change' || lower === 'change' || lower === 'change name' || lower === 'no') {
      await db.setSession(phone, { state: 'await_name' });
      await sendText(phone, copy.askNameText());
      return;
    }
    // Typed a different name directly
    if (
      raw.length >= 2 &&
      !['hi', 'hello', 'help', 'lunch', 'dinner', 'menu', 'start_over', 'start over', 'status'].includes(lower)
    ) {
      const saved = await db.setCustomerName(phone, raw);
      if (!saved) {
        await sendText(phone, 'సరైన పేరు రాయండి (కనీసం 2 అక్షరాలు).');
        return;
      }
      const next = session.pending_action || 'menu';
      await db.setSession(phone, { state: 'idle', pending_action: null, suggested_name: null });
      await sendText(phone, copy.nameSavedText(saved.name));
      await continueAfterName(phone, next);
      return;
    }
    await sendButtons(
      phone,
      copy.confirmWaNameText(session.suggested_name || profile || '…'),
      [
        { id: 'name_yes', title: 'Yes' },
        { id: 'name_change', title: 'Change name' },
        { id: 'help', title: 'Help' },
      ],
    );
    return;
  }

  // First-time name capture (type)
  if (session.state === 'await_name') {
    if (['cancel', 'stop'].includes(lower) || isStartOverCommand(lower)) {
      await goStartOver(phone, profile);
      return;
    }
    const saved = await db.setCustomerName(phone, raw);
    if (!saved) {
      await sendText(phone, 'సరైన పేరు రాయండి (కనీసం 2 అక్షరాలు).');
      return;
    }
    const next = session.pending_action || 'menu';
    await db.setSession(phone, { state: 'idle', pending_action: null });
    await sendText(phone, copy.nameSavedText(saved.name));
    await continueAfterName(phone, next);
    return;
  }

  if (lower === 'status' || lower === 'my status') {
    await sendStatus(phone);
    return;
  }

  const paidMatch = raw.match(/^paid(?:\s+([A-Za-z0-9_-]+))?$/i);
  if (paidMatch) {
    const refFromMsg = paidMatch[1];
    let order = refFromMsg
      ? await db.findOrderByRef(refFromMsg)
      : await db.findLatestPendingOrder(phone);

    if (refFromMsg && order && order.phone !== phone) {
      await sendText(phone, 'That order ID does not belong to this WhatsApp number.');
      return;
    }
    if (!order) {
      await sendButtons(
        phone,
        refFromMsg
          ? `Order ${refFromMsg.toUpperCase()} not found. Try PAID L123456, or tap Help.`
          : 'No pending payment order found. Reply PAID with your order ID, or tap Help if you already paid.',
        [
          { id: 'help', title: 'Help' },
          { id: 'status', title: 'My status' },
          orderCtaButton(),
        ],
      );
      return;
    }
    if (orderAcceptsOnlinePayment(order) && order.status !== 'pending_payment') {
      // COD confirmed earlier — still can pay online
      await sendPayableOrderLink(phone, order);
      return;
    }
    if (order.status === 'paid' || order.status === 'preparing' || order.status === 'out_for_delivery' || order.status === 'delivered') {
      await sendText(phone, `Already marked paid / in kitchen.\n\n${paymentThanksMessage(order)}`);
      return;
    }
    if (order.status !== 'pending_payment') {
      await sendButtons(
        phone,
        `Order ${order.order_ref} is ${customerStatusLabel(order.status)}. Cannot mark PAID from here.`,
        [
          { id: 'help', title: 'Help' },
          { id: 'status', title: 'My status' },
          orderCtaButton(),
        ],
      );
      return;
    }

    // Razorpay primary: customer "PAID" is a claim for kitchen review — no auto-confirm
    if (isRazorpayReady() && !config.upiFallback) {
      await db.saveHelpTicket({
        phone,
        topic: 'payment_claim',
        message: `Customer claims PAID for ${order.order_ref} (${formatPaise(order.total_paise)}). Confirm in bank/Razorpay, then Mark paid in admin.`,
        order_ref: order.order_ref,
        order_status: order.status,
        ticket_status: 'open',
      });
      await notifyAdmins(
        `💳 Payment claim\n${order.order_ref} · ${formatPaise(order.total_paise)}\n${phone}\n` +
          `${order.address || '—'}${orderPinLine(order)}\n` +
          `Customer replied PAID — verify then Mark paid.`,
      );
      await sendButtons(
        phone,
        `Thanks — we received your payment claim for ${order.order_ref}.\n` +
          `Kitchen will confirm shortly. If you used Pay now, wait a moment for auto-update.\n` +
          `Type STATUS anytime.`,
        [
          { id: 'status', title: 'My status' },
          { id: 'help', title: 'Help' },
          { id: 'start_over', title: 'Start over' },
        ],
      );
      return;
    }

    // UPI / fallback path: auto mark paid + alert kitchen
    const result = await applyOrderStatus(order.order_ref, 'paid', {
      notifyCustomer: true,
      extra: { paid_via: 'whatsapp_paid' },
    });
    if (!result.ok) {
      await sendText(phone, result.error || 'Could not update payment.');
      return;
    }
    return;
  }

  if (
    lower === 'order' ||
    lower === 'order_by_list' ||
    lower === 'order by list' ||
    lower === 'list order' ||
    lower === 'order form' ||
    lower === 'place order' ||
    lower === 'placeorder' ||
    lower === 'order_catalog' ||
    lower === 'catalog' ||
    lower === 'shop' ||
    lower === 'browse catalog' ||
    lower === 'open catalog'
  ) {
    await sendOrderStart(phone);
    return;
  }

  if (
    lower === 'view_menu' ||
    lower === 'view menu' ||
    lower === 'menu' ||
    lower === 'menu poster' ||
    lower === 'show menu' ||
    lower === 'prices' ||
    lower === 'view_menu_posters' ||
    lower === 'menu posters'
  ) {
    await sendOrderStart(phone);
    return;
  }

  // Meta Ice Breakers (default restaurant prompts) — answer then show shop paths
  if (isIceBreakerHours(raw) || isIceBreakerHours(lower)) {
    await sendButtons(
      phone,
      hoursAndRangeBlurb(),
      [
        orderCtaButton(),
        { id: 'more_menu', title: 'More' },
        { id: 'help', title: 'Help' },
      ],
      { footer: 'Or send Hi' },
    );
    return;
  }
  if (isIceBreakerPrices(raw) || isIceBreakerPrices(lower)) {
    await sendOrderStart(phone);
    return;
  }

  if (lower === 'more_menu' || lower === 'more') {
    await sendMoreMenu(phone);
    return;
  }

  if (lower === 'cancel' || lower === 'stop') {
    const pending = await db.findLatestPendingOrder(phone);
    if (pending) {
      const cancelOk = canCustomerCancelOrder(pending);
      if (!cancelOk.ok) {
        await sendButtons(phone, cancelOk.message, [
          { id: 'help', title: 'Help' },
          { id: 'status', title: 'Status' },
          { id: 'start_over', title: 'Start over' },
        ]);
        return;
      }
      await applyOrderStatus(pending.order_ref, 'cancelled', { notifyCustomer: false });
      await clearOrderingSession(db, phone);
      await sendButtons(
        phone,
        `Done — order ${pending.order_ref} cancelled.\n` +
          `No payment is needed for that order.\n` +
          `If money already left your account, type HELP for a refund check.\n\n` +
          acrSupportCallLine(),
        [
          orderCtaButton(),
          { id: 'help', title: 'Help' },
          { id: 'start_over', title: 'Start over' },
        ],
      );
      return;
    }

    const latest = await db.findLatestOrder(phone);
    if (latest && ['paid', 'preparing', 'out_for_delivery'].includes(latest.status)) {
      await sendButtons(
        phone,
        `Order ${latest.order_ref} is already paid (${latest.status}).\n` +
          `After payment, cancel isn’t available from chat.\n` +
          `Tap Help so kitchen can assist, or Status for a live update.\n\n` +
          acrSupportCallLine(),
        [
          { id: 'help', title: 'Help' },
          { id: 'status', title: 'Status' },
          { id: 'start_over', title: 'Start over' },
        ],
      );
      return;
    }

    if (latest?.status === 'cancelled') {
      await clearOrderingSession(db, phone);
      await sendButtons(
        phone,
        `No open order to cancel (last one ${latest.order_ref} is already cancelled).\nWhat next?`,
        [
          orderCtaButton(),
          { id: 'help', title: 'Help' },
          { id: 'start_over', title: 'Start over' },
        ],
      );
      return;
    }

    // Mid-browse cart/session — no kitchen order yet
    const hadCart =
      Array.isArray(session.cart) && session.cart.length > 0
        ? true
        : Boolean(session.state && session.state !== 'idle' && session.state !== 'await_help_topic');
    await clearOrderingSession(db, phone);
    await sendButtons(
      phone,
      hadCart
        ? 'OK — cart cleared. What next?'
        : 'Nothing open to cancel. What next?',
      [
        orderCtaButton(),
        { id: 'help', title: 'Help' },
        { id: 'start_over', title: 'Start over' },
      ],
    );
    return;
  }

  if (isStartOverCommand(lower)) {
    await goStartOver(phone, profile);
    return;
  }

  if (lower === 'lunch') {
    await startMeal(phone, 'lunch', profile);
    return;
  }

  if (lower === 'dinner') {
    await startMeal(phone, 'dinner', profile);
    return;
  }

  if (lower === 'reorder' || lower === 'again' || lower === 'order again' || lower === 'మళ్లీ') {
    await tryReorderLast(phone, profile);
    return;
  }

  // Mid-order / cart after cutover → block
  if (
    [
      'await_category',
      'await_dish',
      'await_qty',
      'await_cart',
      'await_cart_edit',
      'await_cart_line',
      'await_address_pick',
      'await_address',
      'await_delivery',
      'await_fulfillment',
      'await_delivery_slot',
    ].includes(session.state)
  ) {
    if (!(await guardSessionMealOpen(phone, session))) return;
  }

  // Cart actions (after adding an item, or typed CART)
  if (
    session.state === 'await_cart' ||
    session.state === 'await_cart_edit' ||
    session.state === 'await_cart_line' ||
    [
      'cart',
      'view cart',
      'cart_view',
      'cart_add',
      'add_same_cat',
      'cart_categories',
      'cart_checkout',
      'cart_clear',
      'cart_edit',
      'edit',
      'edit cart',
      'checkout',
      'add more',
      'clear',
      'clear cart',
      'clear all',
      'edit_done',
      'edit_back',
      'setremove',
    ].includes(lower) ||
    lower.startsWith('editline_') ||
    lower.startsWith('setqty_')
  ) {
    // Line qty / remove
    if (session.state === 'await_cart_line') {
      if (lower === 'setremove' || lower === 'remove' || lower === '0') {
        await applyCartLineChange(phone, session, 'remove');
        return;
      }
      if (lower === 'setqty_type' || lower === 'type' || lower === 'other') {
        const cart = Array.isArray(session.cart) ? session.cart : [];
        const maxQ = maxQtyForCartLine(null, cart, session.edit_code);
        await sendText(
          phone,
          `Type a quantity from 1 to ${maxQ} for this line.\nOr type 0 to remove.`,
        );
        return;
      }
      const setm = lower.match(/^setqty_(\d+)$/) || lower.match(/^qty_(\d+)$/);
      if (setm || /^\d+$/.test(lower)) {
        const qty = setm ? Number(setm[1]) : Number(lower);
        await applyCartLineChange(phone, session, qty);
        return;
      }
      await sendText(phone, 'Pick a quantity from the list, type a number, or 0 to remove.');
      await sendCartLineEditor(phone, session, session.edit_code);
      return;
    }

    // Pick which line to edit
    if (session.state === 'await_cart_edit' || lower.startsWith('editline_')) {
      if (lower === 'edit_done' || lower === 'done') {
        await sendCartActions(phone, session);
        return;
      }
      const em = lower.match(/^editline_([a-z0-9_-]+)$/i);
      if (em) {
        await sendCartLineEditor(phone, session, em[1].toUpperCase());
        return;
      }
      // typed number 1..n for line
      if (/^\d+$/.test(lower)) {
        const cart = Array.isArray(session.cart) ? session.cart : [];
        const idx = Number(lower) - 1;
        if (idx >= 0 && idx < cart.length) {
          await sendCartLineEditor(phone, session, cart[idx].code);
          return;
        }
      }
      await sendCartEditList(phone, session);
      return;
    }

    if (lower === 'cart_clear' || lower === 'clear' || lower === 'clear cart' || lower === 'clear all') {
      if (session.meal) {
        if (sessionIsSundayPartyDinner(session)) {
          await db.setSession(phone, {
            cart: [],
            state: 'await_dish',
            category: 'packs',
            dish_code: null,
            qty: null,
            edit_code: null,
          });
          await sendText(phone, 'Cart cleared. Sunday party orders — pick a Party Pack.');
          await sendDishList(phone, session.meal, 'packs');
        } else {
          await db.setSession(phone, { cart: [], state: 'await_category', dish_code: null, qty: null, edit_code: null });
          await sendText(phone, 'Cart cleared. Pick a category to start again.');
          await sendCategoryPicker(phone, session.meal, session);
        }
      } else {
        await clearOrderingSession(db, phone);
        await sendMainMenu(phone);
      }
      return;
    }
    if (lower === 'cart_edit' || lower === 'edit' || lower === 'edit cart') {
      await sendCartEditList(phone, session);
      return;
    }
    if (lower === 'add_same_cat' || lower === 'add another') {
      if (!session.meal) {
        await sendMainMenu(phone);
        return;
      }
      const cat = sessionIsSundayPartyDinner(session) ? 'packs' : session.category;
      if (!cat) {
        await db.setSession(phone, { state: 'await_category', dish_code: null, qty: null, edit_code: null });
        await sendCategoryPicker(phone, session.meal, session);
        return;
      }
      await db.setSession(phone, {
        state: 'await_dish',
        category: cat,
        dish_code: null,
        qty: null,
        edit_code: null,
      });
      await sendDishList(phone, session.meal, cat);
      return;
    }
    if (lower === 'cart_categories' || lower === 'categories') {
      if (!session.meal) {
        await sendMainMenu(phone);
        return;
      }
      await db.setSession(phone, { state: 'await_category', dish_code: null, qty: null, edit_code: null });
      await sendCategoryPicker(phone, session.meal, session);
      return;
    }
    if (lower === 'cart_add' || lower === 'add more' || lower === 'add' || lower === 'add items') {
      if (!session.meal) {
        await sendMainMenu(phone);
        return;
      }
      if (sessionIsSundayPartyDinner(session)) {
        await db.setSession(phone, { state: 'await_dish', category: 'packs', dish_code: null, qty: null, edit_code: null });
        await sendDishList(phone, session.meal, 'packs');
      } else if (session.category) {
        await db.setSession(phone, { state: 'await_dish', dish_code: null, qty: null, edit_code: null });
        await sendDishList(phone, session.meal, session.category);
      } else {
        await db.setSession(phone, { state: 'await_category', dish_code: null, qty: null, edit_code: null });
        await sendCategoryPicker(phone, session.meal, session);
      }
      return;
    }
    if (lower === 'cart_checkout' || lower === 'checkout') {
      await beginCheckout(phone, session);
      return;
    }
    if (
      session.state === 'await_cart' ||
      lower === 'cart' ||
      lower === 'view cart' ||
      lower === 'cart_view'
    ) {
      if (!(Array.isArray(session.cart) && session.cart.length) && lower === 'cart') {
        await sendText(phone, 'Cart is empty. Tap Order to order.');
        return;
      }
      await sendCartActions(phone, session);
      return;
    }
  }

  if (session.state === 'await_category') {
    const cat = parseCategory(raw);
    if (!cat) {
      await sendText(
        phone,
        sessionIsSundayPartyDinner(session)
          ? 'Sunday is PARTY ORDERS only — please pick Party Packs.'
          : 'Please pick a category from the list (Veg, Non-veg, Meals, Party Packs).',
      );
      await sendCategoryPicker(phone, session.meal, session);
      return;
    }
    if (sessionIsSundayPartyDinner(session) && cat !== 'packs') {
      await sendText(
        phone,
        sundayPartyOrderNotice() +
          `\n\nPlease pick Party Packs only.`,
      );
      await sendCategoryPicker(phone, session.meal, session);
      return;
    }
    await db.setSession(phone, { state: 'await_dish', category: cat });
    await sendDishList(phone, session.meal, cat);
    return;
  }

  if (session.state === 'await_dish') {
    const more = raw.match(/^more_([a-z]+)_(\d+)$/i);
    if (more) {
      const moreCat = more[1].toLowerCase();
      if (sessionIsSundayPartyDinner(session) && moreCat !== 'packs') {
        await sendText(phone, sundayPartyOrderNotice() + `\n\nParty Packs only today.`);
        await sendDishList(phone, session.meal, 'packs');
        return;
      }
      await sendDishList(phone, session.meal, moreCat, Number(more[2]));
      return;
    }
    const cat = parseCategory(raw);
    if (cat) {
      if (sessionIsSundayPartyDinner(session) && cat !== 'packs') {
        await sendText(phone, sundayPartyOrderNotice() + `\n\nParty Packs only today.`);
        await sendDishList(phone, session.meal, 'packs');
        return;
      }
      await db.setSession(phone, { category: cat });
      await sendDishList(phone, session.meal, cat);
      return;
    }
    await pickDish(phone, session, raw.toUpperCase());
    return;
  }

  if (session.state === 'await_qty') {
    const dish = await db.getDish(session.dish_code);
    const cart = Array.isArray(session.cart) ? session.cart : [];
    const left = remainingForDish(dish, cart);
    const max = Math.max(0, Math.min(Number(left) || 0, MAX_LINE_QTY));

    // Customer tapped “Other qty” — stay in this state and ask for a number
    if (lower === 'qty_other' || lower === 'other' || lower === 'other qty') {
      await sendText(
        phone,
        `Type how many of ${dish ? formatDishLabel(dish) : 'this dish'} you want (1–${max}).\n` +
          `Do not type 0 — that does not add the dish. Type Cancel to skip.`,
      );
      return;
    }

    // Explicit cancel / skip (← Back is handled globally via goBackOneStep)
    if (['cancel', 'stop', 'skip', 'no'].includes(lower)) {
      await sendText(phone, 'OK — item not added.');
      if (sessionIsSundayPartyDinner(session)) {
        await db.setSession(phone, { dish_code: null, qty: null, state: 'await_dish', category: 'packs' });
        await sendDishList(phone, session.meal, 'packs');
      } else if (session.category && session.meal) {
        await db.setSession(phone, { dish_code: null, qty: null, state: 'await_dish' });
        await sendDishList(phone, session.meal, session.category);
      } else {
        await db.setSession(phone, { dish_code: null, qty: null, state: 'await_category' });
        if (session.meal) await sendCategoryPicker(phone, session.meal, session);
        else await sendMainMenu(phone);
      }
      return;
    }

    const qtyRaw = lower.startsWith('qty_') ? lower.slice(4) : raw;
    const qty = Number(qtyRaw);

    // 0 / negative: do not add; re-ask
    if (Number.isInteger(qty) && qty === 0) {
      await sendText(
        phone,
        `Quantity cannot be 0 — this dish will not be added.\n` +
          `Type a number from 1 to ${max}, or type Cancel to pick something else.`,
      );
      if (dish && max >= 1) await sendQtyPrompt(phone, dish, left);
      return;
    }

    if (!dish || !Number.isInteger(qty) || qty < 1 || qty > max) {
      await sendText(
        phone,
        max < 1
          ? `This item is already at max quantity in your cart (${MAX_LINE_QTY}). Edit cart or pick another.`
          : `Enter a whole number from 1 to ${max}.\n0 is not allowed.`,
      );
      if (dish && max >= 1) await sendQtyPrompt(phone, dish, left);
      return;
    }
    const nextCart = addToCart(cart, cartLineFromDish(dish, qty));
    const updated = { ...session, cart: nextCart, dish_code: null, qty: null };
    await db.setSession(phone, {
      cart: nextCart,
      dish_code: null,
      qty: null,
      state: 'await_cart',
    });
    await sendText(
      phone,
      `Added ${qty}x ${formatDishLabel(dish)} (${formatPaise(dish.price_paise * qty)}).`,
    );
    await sendPostAddActions(phone, updated);
    return;
  }

  if (session.state === 'await_address_pick') {
    if (lower === 'addr_new' || lower === 'new' || lower === 'కొత్త') {
      await db.setSession(phone, { state: 'await_address' });
      await promptNewDeliveryAddress(phone, session);
      return;
    }
    const m = lower.match(/^addr_(.+)$/);
    const cust = await db.getCustomer(phone);
    let hit = null;
    if (m) hit = (cust?.addresses || []).find((a) => String(a.id) === m[1]);
    if (!hit && /^\d+$/.test(lower)) {
      const sorted = (cust?.addresses || [])
        .slice()
        .sort((a, b) => String(b.last_used_at || '').localeCompare(String(a.last_used_at || '')));
      hit = sorted[Number(lower) - 1];
    }
    if (!hit) {
      await beginCheckout(phone, session);
      return;
    }
    const landmark = String(hit.text || hit.location_name || '').trim();
    // Catalog / Flow-style checkout: pick address, then always confirm map pin
    if (session.flow_checkout || session.catalog_checkout) {
      await db.setSession(phone, {
        address: landmark || session.address,
        suggest_pin_lat: hit.lat != null ? Number(hit.lat) : null,
        suggest_pin_lng: hit.lng != null ? Number(hit.lng) : null,
        suggest_pin_name: hit.location_name || null,
        suggest_pin_text: hit.text || null,
        state: 'await_flow_pin',
        flow_checkout: true,
      });
      await continueFlowDelivery(phone, await db.getSession(phone), landmark || 'Delivery');
      return;
    }
    if (hit.lat != null && hit.lng != null) {
      await proceedWithLocationPin(phone, session, {
        latitude: hit.lat,
        longitude: hit.lng,
        name: hit.location_name,
        address: hit.text,
      });
      return;
    }
    await proceedWithAddress(phone, session, hit.text, hit.zone || null);
    return;
  }

  if (session.state === 'await_address') {
    if (await tryAcceptMapsLinkPin(phone, session, raw)) return;
    if (session.flow_checkout || session.catalog_checkout) {
      const landmark = String(raw || '').trim();
      if (landmark.length < 8) {
        await sendText(
          phone,
          'Please send a fuller address (tower / flat / landmark). Map pin is optional after that.',
        );
        return;
      }
      await db.setSession(phone, {
        address: landmark,
        state: 'await_flow_pin',
        flow_checkout: true,
        suggest_pin_lat: null,
        suggest_pin_lng: null,
      });
      await promptFlowDeliveryPin(phone, landmark);
      return;
    }
    await proceedWithAddress(phone, session, raw, null);
    return;
  }

  if (session.state === 'await_delivery') {
    if (lower === 'z_pick' || lower === 'change km') {
      await sendDeliveryPicker(phone, cartFoodPaise(session.cart));
      return;
    }
    const zone = ['z1', 'z2', 'z3'].includes(lower) ? lower : null;
    if (!zone) {
      await sendText(phone, 'Please pick a delivery distance (0–3 / 3–6 / 6+ km), or ← Back.');
      await sendDeliveryPicker(phone, cartFoodPaise(session.cart));
      return;
    }
    await finalizeOrder(phone, session, zone);
    return;
  }

  // Prefer re-prompt over dumping to main menu when mid-flow state is unknown
  if (session.state && session.state !== 'idle') {
    await sendButtons(
      phone,
      `అర్థం కాలేదు. Continue చేయండి లేదా *Start over*.`,
      [
        { id: 'start_over', title: 'Start over' },
        { id: 'status', title: 'My status' },
        { id: 'help', title: 'Help' },
      ],
    );
    return;
  }

  await sendMainMenu(phone);
}
