import { config } from './config.js';
import { getLaunchIso, isBeforeLaunch } from './ops-settings.js';

/**
 * Kitchen schedule (IST) — finalized for pilot.
 */
export const SCHEDULE = {
  lunch: {
    orderByHour: () => config.lunchCutoffHour,
    serveLabel: '12:00–3:00 PM',
    titleEn: 'Lunch',
  },
  dinner: {
    orderByHour: () => config.dinnerCutoffHour,
    serveLabel: '7:00–10:00 PM',
    titleEn: 'Dinner',
  },
};

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
 * - Before launch date: no service
 * - Sunday: full day closed (lunch + dinner)
 * - Saturday: dinner closed (lunch OK)
 */
export function isKitchenServiceDayAvailable(meal, day) {
  if (!day?.isoDate) return false;
  if (isBeforeLaunch(day.isoDate)) return false;
  const wd = String(day.weekday || '');
  if (wd === 'Sunday') return false;
  if (wd === 'Saturday' && meal === 'dinner') return false;
  return true;
}

/** Same-day order window still open by hour (ignores weekend/launch). */
export function isMealCutoffOpen(meal) {
  if (config.bypassCutoffs) return true;
  if (meal === 'dinner') return nowIst().hour < config.dinnerCutoffHour;
  if (meal === 'lunch') return nowIst().hour < config.lunchCutoffHour;
  return false;
}

export function cutoffLabel(hour) {
  const h = Number(hour);
  if (h === 0) return '12:00 AM';
  if (h < 12) return `${String(h).padStart(2, '0')}:00 AM`;
  if (h === 12) return '12:00 PM';
  return `${String(h - 12).padStart(2, '0')}:00 PM`;
}

/**
 * Can cook/serve this meal *today* (launch, week rules, and order-by hour).
 * Pre-orders for future days use nextServiceDayForMeal, not this alone.
 */
export function isLunchOpen() {
  if (config.bypassCutoffs) return true;
  const t = nowIst();
  if (!isKitchenServiceDayAvailable('lunch', t)) return false;
  return t.hour < config.lunchCutoffHour;
}

export function isDinnerOpen() {
  if (config.bypassCutoffs) return true;
  const t = nowIst();
  if (!isKitchenServiceDayAvailable('dinner', t)) return false;
  return t.hour < config.dinnerCutoffHour;
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

export function mealCutoffLabel(meal) {
  if (meal === 'dinner') return cutoffLabel(config.dinnerCutoffHour);
  return cutoffLabel(config.lunchCutoffHour);
}

export function mealServeLabel(meal) {
  return meal === 'dinner' ? SCHEDULE.dinner.serveLabel : SCHEDULE.lunch.serveLabel;
}

/**
 * Next calendar day that can serve this meal (respects launch + weekend rules).
 * @param {number} startOffset 0 = today, 1 = tomorrow, …
 */
export function nextServiceDayForMeal(meal, startOffset = 0) {
  for (let i = Math.max(0, startOffset); i < 28; i++) {
    const day = i === 0 ? nowIst() : istCalendarOffset(i);
    if (!isKitchenServiceDayAvailable(meal, day)) continue;
    if (i === 0 && !isMealCutoffOpen(meal) && !config.bypassCutoffs) continue;
    return day;
  }
  // Fallback: far launch day
  return dayFromIso(getLaunchIso());
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
  if (isBeforeLaunch(day.isoDate)) {
    return `Kitchen open from ${dayFromIso(getLaunchIso()).dayDateLabel}`;
  }
  if (day.weekday === 'Sunday') return 'Closed Sundays';
  if (day.weekday === 'Saturday' && meal === 'dinner') return 'No Saturday evening service';
  return 'Closed';
}

/**
 * Schedule for welcome (single "Today" line).
 */
export function mealStatusText() {
  const today = nowIst();
  const launch = dayFromIso(getLaunchIso());
  const lines = [`📅 Today: ${today.dayDateLabel} (IST)`];

  if (isBeforeLaunch(today.isoDate)) {
    lines.push(
      `🚀 Launching ${launch.dayDateLabel}\n` +
        `Pre-booking is open — you can book lunch/dinner for opening day.`,
    );
  }

  for (const meal of ['lunch', 'dinner']) {
    const title = mealTitle(meal);
    if (!isKitchenServiceDayAvailable(meal, today) && !isBeforeLaunch(today.isoDate)) {
      lines.push(`• ${title}: ${closedReasonLine(meal, today)}`);
    } else {
      const info = orderDayForMeal(meal);
      if (info.open) {
        lines.push(
          `• ${title}: OPEN · order by ${info.orderBy} · serve ~${info.serve}`,
        );
      } else {
        lines.push(
          `• ${title}: book for ${info.serviceDay.dayDateLabel}\n` +
            `  Serve ~${info.serve}` +
            (isBeforeLaunch(today.isoDate) ? ' · opening day' : ''),
        );
      }
    }
  }

  lines.push('• Sunday: kitchen closed · Saturday evening: dinner closed');

  if (config.bypassCutoffs) {
    lines.push(`⚠️ Test mode: cutoffs BYPASSED (set BYPASS_CUTOFFS=0)`);
  }

  return lines.join('\n');
}

/** Prompt body when same-day cutoff has passed / day closed / pre-launch */
export function advanceSlotPrompt(meal) {
  const info = orderDayForMeal(meal);
  const title = mealTitle(meal);
  const other = otherMealOpenToday(meal);
  const today = nowIst();
  const launch = dayFromIso(getLaunchIso());

  let lines = '';
  if (isBeforeLaunch(today.isoDate)) {
    lines =
      `We open on ${launch.dayDateLabel}.\n\n` +
      `You can pre-book ${title.toLowerCase()} from our first service day:\n` +
      `📅 ${info.serviceDay.dayDateLabel}\n` +
      `🍽 Serve ~${info.serve}`;
  } else if (today.weekday === 'Sunday') {
    lines =
      `Kitchen is closed on Sundays.\n\n` +
      `Pre-order ${title.toLowerCase()} for:\n` +
      `📅 ${info.serviceDay.dayDateLabel}\n` +
      `🍽 Serve ~${info.serve}`;
  } else if (today.weekday === 'Saturday' && meal === 'dinner') {
    lines =
      `Saturday dinner is not available.\n\n` +
      `You can book lunch today (if open), or ${title.toLowerCase()} for:\n` +
      `📅 ${info.serviceDay.dayDateLabel}\n` +
      `🍽 Serve ~${info.serve}`;
  } else {
    lines =
      `${title} for today is closed (deadline was ${mealCutoffLabel(meal)} IST).\n\n` +
      `You can pre-order ${title.toLowerCase()} for:\n` +
      `📅 ${info.serviceDay.dayDateLabel}\n` +
      `🍽 Serve ~${info.serve}`;
  }

  if (other) {
    lines +=
      `\n\nOr order ${mealTitle(other).toLowerCase()} for today ` +
      `(open until ${mealCutoffLabel(other)} IST · serve ~${mealServeLabel(other)}).`;
  }

  lines += '\n\nWhat would you like?';
  return lines;
}

/**
 * Whether an active cart/session is still valid.
 * Advance (service_date > today) stays open; same-day needs meal still open + service day cookable.
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

export function canCustomerCancelOrder(order) {
  if (!order) return { ok: false, message: 'Order not found.' };
  const today = nowIst();
  if (order.status !== 'pending_payment') {
    return {
      ok: false,
      message:
        `Order ${order.order_ref} (${order.status}) cannot be cancelled here.\n` +
        `Today: ${today.dayDateLabel}. Type HELP.`,
    };
  }

  const svc = order.service_date || today.isoDate;
  // Pre-orders for a future day can always cancel before kitchen day
  if (svc > today.isoDate) return { ok: true };

  if (!isMealOpen(order.meal)) {
    return {
      ok: false,
      message:
        `Order ${order.order_ref} — cannot cancel after cut-off.\n` +
        `${mealTitle(order.meal)} deadline was ${mealCutoffLabel(order.meal)} IST.\n` +
        `Type HELP to reach the kitchen.`,
    };
  }
  return { ok: true };
}
