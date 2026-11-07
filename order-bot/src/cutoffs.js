import { config } from './config.js';
import {
  getLunchCutoffHour,
  getDinnerCutoffHour,
  getLunchCutoffMinute,
  getDinnerCutoffMinute,
  getLunchCutoffTotalMinutes,
  getDinnerCutoffTotalMinutes,
  getSaturdayDinnerOpen,
  getSundayLunchOpen,
  getSundayDinnerPartyOpen,
} from './ops-settings.js';

/**
 * Kitchen schedule (IST) — cutoffs live in ops-settings (admin-editable).
 * Product rule: continuous delivery 12:30 PM–11:30 PM; WA/web self-order closes at 9:30 PM;
 * until serve end, customers call ORDER_CONFIRM_PHONE and admin places a manual order.
 */
export const SCHEDULE = {
  lunch: {
    orderByHour: () => getLunchCutoffHour(),
    serveLabel: '12:30–4:00 PM',
    serveFromLabel: '12:30 PM',
    /** Shared last-order with dinner (continuous day). */
    callConfirmStartMinutes: 21 * 60 + 30,
    callConfirmEndMinutes: 23 * 60 + 30,
    titleEn: 'Lunch',
    titleTe: 'లంచ్',
  },
  dinner: {
    orderByHour: () => getDinnerCutoffHour(),
    serveLabel: '4:00–11:30 PM',
    serveFromLabel: '4:00 PM',
    callConfirmStartMinutes: 21 * 60 + 30,
    callConfirmEndMinutes: 23 * 60 + 30,
    titleEn: 'Dinner',
    titleTe: 'డిన్నర్',
  },
};

function mealSchedule(meal) {
  return meal === 'dinner' ? SCHEDULE.dinner : SCHEDULE.lunch;
}

/** Product WA self-order end (= call-confirm start), IST minutes. */
export function mealCallConfirmStartMinutes(meal) {
  return mealSchedule(meal).callConfirmStartMinutes;
}

/** Call-confirm / kitchen serve window end for late manual orders, IST minutes. */
export function mealCallConfirmEndMinutes(meal) {
  return mealSchedule(meal).callConfirmEndMinutes;
}

/** Digits-only phone for late same-day confirm (shared Food voice line). */
export function mealCallConfirmPhoneDigits() {
  const raw = String(config.orderConfirmPhone || '').replace(/\D/g, '');
  return raw || '9392044833';
}

export function mealCallConfirmPhoneDisplay() {
  const d = mealCallConfirmPhoneDigits();
  if (d.length === 12 && d.startsWith('91')) {
    return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  }
  if (d.length === 10) return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
  return d.startsWith('+') ? d : `+91 ${d}`;
}

/**
 * Same-day kitchen still serving; WA self-order closed — customer must call.
 * Admin manual orders stay allowed (createManualOrder does not use isMealOpen).
 */
export function isMealCallConfirmWindow(meal) {
  if (config.bypassCutoffs) return false;
  if (meal !== 'lunch' && meal !== 'dinner') return false;
  const t = nowIst();
  if (!isKitchenServiceDayAvailable(meal, t)) return false;
  const nowMin = t.hour * 60 + t.minute;
  return nowMin >= mealCallConfirmStartMinutes(meal) && nowMin < mealCallConfirmEndMinutes(meal);
}

/** Current wall-clock in Asia/Kolkata */
export function nowIst(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value;
  const day = Number(get('day'));
  const month = Number(get('month'));
  const year = Number(get('year'));
  return {
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    day,
    month,
    year,
    weekday: get('weekday'),
    dateLabel: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
    dayDateLabel: `${get('weekday')}, ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
    isoDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  };
}

/** Add calendar days in IST (pure date arithmetic). */
export function istCalendarOffset(days) {
  const t = nowIst();
  const base = Date.UTC(t.year, t.month - 1, t.day + days, 12, 0, 0);
  const d = new Date(base);
  const weekday = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'long',
  }).format(d);
  const dd = d.getUTCDate();
  const mm = d.getUTCMonth() + 1;
  const yyyy = d.getUTCFullYear();
  return {
    weekday,
    day: dd,
    month: mm,
    year: yyyy,
    dateLabel: `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${yyyy}`,
    dayDateLabel: `${weekday}, ${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${yyyy}`,
    isoDate: `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`,
  };
}

/** Parse YYYY-MM-DD into day-ish object for labels (weekday via UTC noon). */
export function dayFromIso(isoDate) {
  const m = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return nowIst();
  const yyyy = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  const d = new Date(Date.UTC(yyyy, mm - 1, dd, 12, 0, 0));
  const weekday = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'long',
  }).format(d);
  return {
    weekday,
    day: dd,
    month: mm,
    year: yyyy,
    dateLabel: `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${yyyy}`,
    dayDateLabel: `${weekday}, ${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${yyyy}`,
    isoDate: `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`,
  };
}

/**
 * Kitchen closed rules (service day):
 * - Sunday lunch: open when admin sunday_lunch_open (default on) — normal lunch menu
 * - Sunday dinner: open for Party Packs when admin sunday_dinner_party_open (default on)
 * - Saturday dinner: open by default; admin can close via saturday_dinner_open
 */
export function isKitchenServiceDayAvailable(meal, day) {
  if (!day?.isoDate) return false;
  const wd = String(day.weekday || '');
  if (wd === 'Sunday') {
    if (meal === 'lunch' && getSundayLunchOpen()) return true;
    if (meal === 'dinner' && getSundayDinnerPartyOpen()) return true;
    return false;
  }
  if (wd === 'Saturday' && meal === 'dinner' && !getSaturdayDinnerOpen()) return false;
  return true;
}

/**
 * Sunday dinner in party-only mode (service day is Sunday + admin flag on).
 * Callers should restrict menu to Party Packs and show the party notice.
 */
export function isSundayPartyDinnerService(meal, day) {
  if (meal !== 'dinner') return false;
  const wd = String(day?.weekday || '');
  return wd === 'Sunday' && getSundayDinnerPartyOpen();
}

/** Short — welcome Hi, Flow headings, category list (space-limited). */
export function sundayPartyOrderNoticeShort() {
  if (getSundayLunchOpen()) {
    return `⚠️ ఆది డిన్నర్: పార్టీ ప్యాక్ మాత్రమే`;
  }
  return `⚠️ ఆది: లంచ్ మూసి · డిన్నర్ పార్టీ ప్యాక్ మాత్రమే`;
}

/** Long — tap Dinner on Sunday, cart errors, Flow CTA body. */
export function sundayPartyOrderNotice() {
  if (getSundayLunchOpen()) {
    return (
      `⚠️ ఆదివారం డిన్నర్: సాధారణ మెనూ లేదు.\n` +
      `పార్టీ ప్యాక్స్ (2–5 KG) మాత్రమే.\n` +
      `(లంచ్ సాధారణ మెనూ అందుబాటులో ఉంది.)`
    );
  }
  return (
    `⚠️ ఆదివారం లంచ్ మూసి · డిన్నర్ సాధారణ మెనూ అందుబాటులో లేదు.\n` +
    `పార్టీ ప్యాక్స్ (2–5 KG) మాత్రమే ఆర్డర్ చేయవచ్చు.`
  );
}

/** Same-day WA self-order still open (IST). Product: last order 9:30 PM (continuous day).
 * After that → call-confirm window (admin places manual order). Ops cutoffs are kept in sync
 * for admin UI labels; WA close is the product call-confirm start.
 */
export function isMealCutoffOpen(meal) {
  if (config.bypassCutoffs) return true;
  if (meal !== 'lunch' && meal !== 'dinner') return false;
  const t = nowIst();
  const nowMin = t.hour * 60 + t.minute;
  return nowMin < mealCallConfirmStartMinutes(meal);
}

export function cutoffLabel(hour, minute = 0) {
  const h = Number(hour);
  const m = Math.min(59, Math.max(0, Math.round(Number(minute) || 0)));
  const mm = String(m).padStart(2, '0');
  if (h === 0) return `12:${mm} AM`;
  if (h < 12) return `${String(h).padStart(2, '0')}:${mm} AM`;
  if (h === 12) return `12:${mm} PM`;
  return `${String(h - 12).padStart(2, '0')}:${mm} PM`;
}

/**
 * Can cook/serve this meal *today* (week rules + order-by time).
 * Pre-orders for future days use nextServiceDayForMeal, not this alone.
 */
export function isLunchOpen() {
  if (config.bypassCutoffs) return true;
  const t = nowIst();
  if (!isKitchenServiceDayAvailable('lunch', t)) return false;
  return isMealCutoffOpen('lunch');
}

export function isDinnerOpen() {
  if (config.bypassCutoffs) return true;
  const t = nowIst();
  if (!isKitchenServiceDayAvailable('dinner', t)) return false;
  return isMealCutoffOpen('dinner');
}

/** @param {'lunch'|'dinner'|string} meal */
export function isMealOpen(meal) {
  if (meal === 'dinner') return isDinnerOpen();
  if (meal === 'lunch') return isLunchOpen();
  return false;
}

export function mealTitle(meal) {
  return meal === 'dinner' ? 'Dinner' : 'Lunch';
}

export function mealTitleTe(meal) {
  return meal === 'dinner' ? SCHEDULE.dinner.titleTe : SCHEDULE.lunch.titleTe;
}

export function mealCutoffLabel(meal) {
  const end = mealCallConfirmStartMinutes(meal);
  return cutoffLabel(Math.floor(end / 60), end % 60);
}

export function mealServeLabel(meal) {
  return meal === 'dinner' ? SCHEDULE.dinner.serveLabel : SCHEDULE.lunch.serveLabel;
}

/** Serve window start only (customer-facing). */
export function mealServeFromLabel(meal) {
  return meal === 'dinner' ? SCHEDULE.dinner.serveFromLabel : SCHEDULE.lunch.serveFromLabel;
}

/** Customer WhatsApp copy when Lunch/Dinner is tapped during the call window. */
export function mealCallConfirmMessage(meal) {
  const te = mealTitleTe(meal);
  const en = mealTitle(meal);
  const phone = mealCallConfirmPhoneDisplay();
  const serve = mealServeLabel(meal);
  return (
    `📞 *${en} · Call to confirm*\n` +
    `${te} ఆన్‌లైన్ ఆర్డర్ ఈ స్లాట్‌కు మూసి.\n\n` +
    `Kitchen is still serving ~${serve}.\n` +
    `Call *${phone}* to check availability — we will place your order from our side.\n\n` +
    `లభ్యత కోసం *${phone}* కి కాల్ చేయండి. అడ్మిన్ మాన్యువల్ ఆర్డర్ వేస్తారు.`
  );
}

/** Always-on support line (cancel, unpaid/paid, help, late orders). */
export function acrSupportCallLine() {
  const phone = mealCallConfirmPhoneDisplay();
  return `📞 Need help / late order? Call ACR: *${phone}*`;
}

/** Online window closed / no slots — late customer should call; kitchen confirms food. */
export function lateOrderCallHint() {
  return 'Help line కి call చేసి food availability confirm చేసుకోండి.';
}

/** @deprecated use lateOrderCallHint */
export function nextDayOrderCallHint() {
  return lateOrderCallHint();
}

/** Kitchen still in today's serve window (before lunch 3PM / dinner 10PM). */
export function isMealKitchenStillServing(meal) {
  if (config.bypassCutoffs) return true;
  if (meal !== 'lunch' && meal !== 'dinner') return false;
  const t = nowIst();
  if (!isKitchenServiceDayAvailable(meal, t)) return false;
  const nowMin = t.hour * 60 + t.minute;
  return nowMin < mealCallConfirmEndMinutes(meal);
}

/**
 * Next calendar day that can serve this meal (respects weekend rules).
 * @param {number} startOffset 0 = today, 1 = tomorrow, …
 */
export function nextServiceDayForMeal(meal, startOffset = 0) {
  for (let i = Math.max(0, startOffset); i < 28; i++) {
    const day = i === 0 ? nowIst() : istCalendarOffset(i);
    if (!isKitchenServiceDayAvailable(meal, day)) continue;
    if (i === 0 && !isMealCutoffOpen(meal) && !config.bypassCutoffs) continue;
    return day;
  }
  // Safety: Mon+28 if loop failed
  return istCalendarOffset(28);
}

/**
 * Service day for a meal: today while open, else next cookable day (pre-order).
 */
export function orderDayForMeal(meal) {
  if (isMealOpen(meal)) {
    const t = nowIst();
    return {
      open: true,
      isAdvance: false,
      serviceDay: t,
      orderBy: mealCutoffLabel(meal),
      serve: mealServeLabel(meal),
    };
  }
  const next = nextServiceDayForMeal(meal, 0);
  return {
    open: false,
    isAdvance: true,
    serviceDay: next,
    orderBy: mealCutoffLabel(meal),
    serve: mealServeLabel(meal),
  };
}

/** Other meal slot still open for same-day cooking */
export function otherMealOpenToday(meal) {
  const other = meal === 'lunch' ? 'dinner' : 'lunch';
  if (!isMealOpen(other)) return null;
  return other;
}

function closedReasonLine(meal, day) {
  if (day.weekday === 'Sunday') {
    if (meal === 'lunch' && !getSundayLunchOpen()) return 'Closed Sundays (lunch)';
    if (meal === 'dinner' && !getSundayDinnerPartyOpen()) return 'Closed Sundays';
    return 'Closed Sundays';
  }
  if (day.weekday === 'Saturday' && meal === 'dinner') return 'No Saturday evening service';
  return 'Closed';
}

/**
 * Schedule for welcome — today's meal state.
 * Order-by times always come from live ops cache (DB via getOpsSettings).
 * Sunday lunch follows sunday_lunch_open; Sunday dinner may be party-packs only.
 */
/**
 * Compact Telugu schedule for welcome Hi.
 * Show delivery windows only (not WA order-by cutoffs) so late customers call to confirm.
 */
export function mealStatusText() {
  const today = nowIst();
  const lines = [`📅 ${today.dayDateLabel}`];
  const phone = mealCallConfirmPhoneDisplay();

  function mealWelcomeLine(meal) {
    const te = mealTitleTe(meal);
    const window = mealServeLabel(meal);
    if (!isKitchenServiceDayAvailable(meal, today)) {
      if (today.weekday === 'Sunday' && meal === 'lunch' && !getSundayLunchOpen()) {
        return `${te}: ఈరోజు మూసి`;
      }
      if (today.weekday === 'Sunday' && meal === 'dinner' && !getSundayDinnerPartyOpen()) {
        return `${te}: ఈరోజు మూసి`;
      }
      if (today.weekday === 'Saturday' && meal === 'dinner' && !getSaturdayDinnerOpen()) {
        return `${te}: ఈరోజు మూసి`;
      }
      // Past serve / not available today — still point to usual window + next chance
      return `${te}: సాధారణం ${window} · ఈరోజు ముగిసింది · రేపు / కాల్ ${phone}`;
    }
    if (isMealCallConfirmWindow(meal)) {
      return `${te}: డెలివరీ ${window} · ఆన్‌లైన్ మూసి — కాల్ చేసి లభ్యత అడగండి`;
    }
    if (meal === 'dinner' && isSundayPartyDinnerService('dinner', today)) {
      return `${te}: డెలివరీ ${window} · పార్టీ ప్యాక్ మాత్రమే`;
    }
    return `${te}: డెలివరీ ${window}`;
  }

  if (today.weekday === 'Sunday') {
    lines.push(mealWelcomeLine('lunch'));
    if (getSundayDinnerPartyOpen()) {
      lines.push(sundayPartyOrderNoticeShort());
    }
    lines.push(mealWelcomeLine('dinner'));
  } else {
    lines.push(mealWelcomeLine('lunch'));
    lines.push(mealWelcomeLine('dinner'));
  }

  lines.push(acrSupportCallLine());

  if (config.bypassCutoffs) {
    lines.push(`⚠️ Test mode: cutoffs BYPASSED (set BYPASS_CUTOFFS=0)`);
  }

  return lines.join('\n');
}

/** Prompt body when same-day cutoff has passed or kitchen day is closed */
export function advanceSlotPrompt(meal) {
  if (isMealCallConfirmWindow(meal) || (isMealKitchenStillServing(meal) && !isMealOpen(meal))) {
    return mealCallConfirmMessage(meal);
  }
  const te = mealTitleTe(meal);
  return (
    `${te}: ఈరోజు online order మూసి.\n` +
    `${lateOrderCallHint()}\n\n` +
    acrSupportCallLine()
  );
}

/**
 * Whether an active cart/session is still valid.
 * Advance (service_date > today) stays open; same-day needs meal still open + service day cookable.
 * Call-confirm window invalidates same-day WA carts (customer must call).
 */
export function isSessionBookingValid(session) {
  if (!session?.meal) return true;
  if (config.bypassCutoffs) return true;

  const today = nowIst().isoDate;
  const svc = session.service_date || today;
  const svcDay = dayFromIso(svc);

  if (!isKitchenServiceDayAvailable(session.meal, svcDay)) return false;
  if (svc > today) return true;
  if (svc < today) return false;
  if (isMealCallConfirmWindow(session.meal)) return false;
  return isMealOpen(session.meal);
}

/** @deprecated use isSessionBookingValid + advance flow; kept for call sites */
export function assertMealOpen(meal) {
  if (isMealOpen(meal)) return { ok: true, isAdvance: false, serviceDay: nowIst() };
  const info = orderDayForMeal(meal);
  return {
    ok: false,
    meal,
    isAdvance: true,
    serviceDay: info.serviceDay,
    message: advanceSlotPrompt(meal),
  };
}

function customerStatusPhrase(status) {
  switch (status) {
    case 'pending_payment':
      return 'waiting for payment';
    case 'paid':
      return 'paid — kitchen will prepare';
    case 'preparing':
      return 'being prepared';
    case 'out_for_delivery':
      return 'out for delivery';
    case 'delivered':
      return 'delivered';
    case 'cancelled':
      return 'already cancelled';
    default:
      return String(status || 'unknown');
  }
}

/**
 * Customer WhatsApp cancel: unpaid orders only (always OK until paid).
 * Paid / kitchen orders need HELP or a call so staff can refund or stop cooking.
 */
export function canCustomerCancelOrder(order) {
  if (!order) return { ok: false, message: 'Order not found.' };
  if (order.status === 'pending_payment') return { ok: true };

  const ref = order.order_ref;
  const phrase = customerStatusPhrase(order.status);
  const call = acrSupportCallLine();

  if (order.status === 'cancelled') {
    return {
      ok: false,
      message:
        `Order ${ref} is already cancelled.\n` +
        `Tap Order for a new order, or HELP if you need a refund check.\n\n` +
        call,
    };
  }
  if (order.status === 'delivered') {
    return {
      ok: false,
      message:
        `Order ${ref} was already delivered.\n` +
        `Type HELP if something went wrong with the food or delivery.\n\n` +
        call,
    };
  }
  return {
    ok: false,
    message:
      `Order ${ref} is ${phrase}.\n` +
      `After payment, cancel isn’t available here.\n` +
      `Type HELP, or call us to stop/refund.\n\n` +
      call,
  };
}
