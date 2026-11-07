/**
 * ACR-Fresh hourly delivery slots + capacity locks.
 * When a slot reaches max orders (default 5), it locks for new customers.
 * Order occupancy = pending_payment + paid + preparing + out_for_delivery (not cancelled/expired).
 */

import { config } from './config.js';
import {
  getSlotCapacity,
  getSlotOpenHour,
  getSlotCloseHour,
  getSlotLeadMinutes,
} from './ops-settings.js';

/** Occupying statuses count toward slot capacity. */
export const SLOT_OCCUPYING_STATUSES = [
  'pending_payment',
  'paid',
  'preparing',
  'out_for_delivery',
];

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

export function cutoffLabel(hour, minute = 0) {
  const h = Number(hour);
  const m = Math.min(59, Math.max(0, Math.round(Number(minute) || 0)));
  const mm = String(m).padStart(2, '0');
  if (h === 0) return `12:${mm} AM`;
  if (h < 12) return `${String(h).padStart(2, '0')}:${mm} AM`;
  if (h === 12) return `12:${mm} PM`;
  return `${String(h - 12).padStart(2, '0')}:${mm} PM`;
}

/** Slot id: YYYY-MM-DDTHH (hour 0–23 start). */
export function slotId(isoDate, hour) {
  const h = Math.min(23, Math.max(0, Math.floor(Number(hour))));
  return `${String(isoDate).slice(0, 10)}T${String(h).padStart(2, '0')}`;
}

export function parseSlotId(id) {
  const m = String(id || '').match(/^(\d{4}-\d{2}-\d{2})[Tt](\d{2})$/);
  if (!m) return null;
  return { isoDate: m[1], hour: Number(m[2]) };
}

export function slotLabel(hour) {
  const start = cutoffLabel(hour, 0);
  const endH = (Number(hour) + 1) % 24;
  const end = cutoffLabel(endH, 0);
  return `${start}–${end}`;
}

/**
 * Whether this hour slot is still bookable given lead time (IST).
 * Bypass when BYPASS_CUTOFFS=1.
 */
export function isSlotTimeOpen(isoDate, hour, now = nowIst()) {
  if (config.bypassCutoffs) return true;
  const day = String(isoDate).slice(0, 10);
  if (day < now.isoDate) return false;
  const lead = getSlotLeadMinutes();
  const slotStartMin = Number(hour) * 60;
  if (day > now.isoDate) return true;
  const nowMin = now.hour * 60 + now.minute;
  return nowMin + lead <= slotStartMin;
}

/** Build raw hourly windows for a calendar day (no capacity yet). */
export function listDaySlotHours(isoDate = nowIst().isoDate) {
  const openH = getSlotOpenHour();
  const closeH = getSlotCloseHour(); // exclusive end hour of last window
  const hours = [];
  for (let h = openH; h < closeH; h++) hours.push(h);
  return hours.map((hour) => ({
    id: slotId(isoDate, hour),
    isoDate: String(isoDate).slice(0, 10),
    hour,
    label: slotLabel(hour),
    capacity: getSlotCapacity(),
  }));
}

/**
 * Enrich slots with booked counts. `countBySlotId` map from DB.
 * @returns {Array<object>}
 */
export function enrichSlotsWithCounts(slots, countBySlotId = {}) {
  const capacity = getSlotCapacity();
  const unlimited = !(capacity > 0);
  return (slots || []).map((s) => {
    const booked = Number(countBySlotId[s.id] || 0);
    const remaining = unlimited ? null : Math.max(0, capacity - booked);
    const timeOpen = isSlotTimeOpen(s.isoDate, s.hour);
    const locked = !timeOpen || (!unlimited && remaining <= 0);
    return {
      ...s,
      capacity: unlimited ? 0 : capacity,
      booked,
      remaining,
      locked,
      available: !locked,
    };
  });
}

/** First N open slots from today forward (for pickers). */
export function planSlotCandidates({ daysAhead = 2, now = nowIst() } = {}) {
  const out = [];
  for (let d = 0; d <= daysAhead; d++) {
    const day = d === 0 ? now : istCalendarOffset(d);
    for (const s of listDaySlotHours(day.isoDate)) {
      if (!isSlotTimeOpen(s.isoDate, s.hour, now)) continue;
      out.push({
        ...s,
        dayLabel: day.dayDateLabel,
        serviceDay: day,
      });
    }
  }
  return out;
}

export function slotStatusText(availableSlots = []) {
  const today = nowIst();
  const open = (availableSlots || []).filter((s) => s.available);
  const cap = getSlotCapacity();
  const lines = [
    `📅 Today: ${today.dayDateLabel} (IST)`,
    cap > 0
      ? `🚚 Hourly delivery · max ${cap} orders / hour`
      : '🚚 Hourly delivery · no order-count lock',
    `⏱ Book ≥${getSlotLeadMinutes()} min ahead · ${cutoffLabel(getSlotOpenHour())}–${cutoffLabel(getSlotCloseHour())}`,
  ];
  if (!open.length) {
    lines.push('• No open slots right now — try a later hour or tomorrow.');
  } else {
    const show = open.slice(0, 4);
    for (const s of show) {
      const left =
        s.remaining == null || !(s.capacity > 0)
          ? 'open'
          : `${s.remaining}/${s.capacity} left`;
      lines.push(`• ${s.dayLabel || s.isoDate} ${s.label}: ${left}`);
    }
    if (open.length > show.length) lines.push(`• +${open.length - show.length} more slots`);
  }
  if (config.bypassCutoffs) {
    lines.push('⚠️ Test mode: slot lead time BYPASSED (BYPASS_CUTOFFS=1)');
  }
  return lines.join('\n');
}

// ── Compatibility shims (food bot used lunch/dinner; fresh uses one service) ──

export const SCHEDULE = {
  fresh: {
    orderByHour: () => getSlotCloseHour(),
    serveLabel: 'Hourly slots',
    titleEn: 'Delivery',
  },
  lunch: {
    orderByHour: () => getSlotCloseHour(),
    serveLabel: 'Hourly slots',
    titleEn: 'Delivery',
  },
  dinner: {
    orderByHour: () => getSlotCloseHour(),
    serveLabel: 'Hourly slots',
    titleEn: 'Delivery',
  },
};

export function isKitchenServiceDayAvailable(_meal, day) {
  return Boolean(day?.isoDate);
}

export function isSundayPartyDinnerService() {
  return false;
}

export function sundayPartyOrderNotice() {
  return '';
}

export function isMealCutoffOpen() {
  if (config.bypassCutoffs) return true;
  const now = nowIst();
  return listDaySlotHours(now.isoDate).some((s) => isSlotTimeOpen(s.isoDate, s.hour, now));
}

export function isLunchOpen() {
  return isMealCutoffOpen();
}

export function isDinnerOpen() {
  return isMealCutoffOpen();
}

export function isMealOpen(_meal) {
  return isMealCutoffOpen();
}

export function mealTitle(_meal) {
  return 'Delivery';
}

export function mealCutoffLabel(_meal) {
  return cutoffLabel(getSlotCloseHour(), 0);
}

export function mealServeLabel(_meal) {
  return 'hourly slots';
}

export function nextServiceDayForMeal(_meal, startOffset = 0) {
  for (let i = Math.max(0, startOffset); i < 14; i++) {
    const day = i === 0 ? nowIst() : istCalendarOffset(i);
    const hours = listDaySlotHours(day.isoDate);
    if (hours.some((s) => isSlotTimeOpen(s.isoDate, s.hour))) return day;
  }
  return istCalendarOffset(1);
}

export function orderDayForMeal(_meal) {
  const open = isMealOpen('fresh');
  const serviceDay = open ? nowIst() : nextServiceDayForMeal('fresh', 0);
  return {
    open,
    isAdvance: !open || serviceDay.isoDate !== nowIst().isoDate,
    serviceDay,
    orderBy: mealCutoffLabel('fresh'),
    serve: mealServeLabel('fresh'),
  };
}

export function otherMealOpenToday() {
  return null;
}

export function mealStatusText() {
  return slotStatusText(
    enrichSlotsWithCounts(planSlotCandidates({ daysAhead: 1 })).map((s) => ({
      ...s,
      available: true,
      remaining: getSlotCapacity(),
      capacity: getSlotCapacity(),
    })),
  );
}

export function advanceSlotPrompt(_meal) {
  const next = nextServiceDayForMeal('fresh', 0);
  const cap = getSlotCapacity();
  const capNote =
    cap > 0 ? ` (max ${cap} orders each)` : '';
  return (
    `No delivery slots left in the current window.\n\n` +
    `Next day with slots: ${next.dayDateLabel}\n` +
    `Pick an hourly slot at checkout${capNote}.\n\n` +
    `What would you like?`
  );
}

export function isSessionBookingValid(session) {
  if (config.bypassCutoffs) return true;
  if (!session?.delivery_slot) return true;
  const parsed = parseSlotId(session.delivery_slot);
  if (!parsed) return false;
  return isSlotTimeOpen(parsed.isoDate, parsed.hour);
}

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
      return 'paid — packing soon';
    case 'preparing':
      return 'being packed';
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

export function canCustomerCancelOrder(order) {
  if (!order) return { ok: false, message: 'Order not found.' };
  if (order.status === 'pending_payment') return { ok: true };

  const ref = order.order_ref;
  const phrase = customerStatusPhrase(order.status);

  if (order.status === 'cancelled') {
    return {
      ok: false,
      message:
        `Order ${ref} is already cancelled.\n` +
        `Tap Order to start again, or HELP if you need a refund check.`,
    };
  }
  if (order.status === 'delivered') {
    return {
      ok: false,
      message:
        `Order ${ref} was already delivered.\n` +
        `Type HELP if something went wrong with items or delivery.`,
    };
  }
  return {
    ok: false,
    message:
      `Order ${ref} is ${phrase}.\n` +
      `After payment, cancel isn’t available here.\n` +
      `Type HELP so we can help (stop/refund).`,
  };
}
