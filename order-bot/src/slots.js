/**
 * Food delivery time slots — continuous 30-min windows, 90-min lead (IST).
 * Serve: 12:30 PM–11:30 PM (last window 11:00–11:30). Last WA/web order 9:30 PM
 * so 9:30 + 90 min lead still reaches the 11:00 PM start.
 * Meal label for kitchen: before 4:00 PM = lunch, else dinner.
 * Slot id: YYYY-MM-DDTHHMM (start). No per-slot capacity limit.
 */

import { config } from './config.js';
import {
  cutoffLabel,
  dayFromIso,
  isKitchenServiceDayAvailable,
  isMealCallConfirmWindow,
  istCalendarOffset,
  nowIst,
} from './cutoffs.js';

/** Kept for optional ops / Fresh-style counting; Food does not enforce capacity. */
export const SLOT_OCCUPYING_STATUSES = [
  'pending_payment',
  'paid',
  'preparing',
  'out_for_delivery',
];

export const SLOT_LEAD_MINUTES = Number(process.env.DELIVERY_SLOT_LEAD_MINUTES || 90);
export const SLOT_STEP_MINUTES = 30;
/** 0 = unlimited (default). Positive values would cap orders per window. */
export const SLOT_CAPACITY = Number(process.env.DELIVERY_SLOT_CAPACITY || 0);

/** Full-day serve window (inclusive start / exclusive end), minutes from midnight IST.
 * endMin 23:30 → last bookable start 23:00 (11:00–11:30 PM) for last-order 9:30 + 90 lead.
 */
export const DAY_SLOT_WINDOW = {
  startMin: 12 * 60 + 30,
  endMin: 23 * 60 + 30,
};

/** Split continuous day for kitchen meal labels (no gap between windows). */
export const MEAL_SPLIT_MIN = 16 * 60;

/** Inclusive start / exclusive end (minutes from midnight IST). */
export const MEAL_SLOT_WINDOWS = {
  lunch: { startMin: DAY_SLOT_WINDOW.startMin, endMin: MEAL_SPLIT_MIN },
  dinner: { startMin: MEAL_SPLIT_MIN, endMin: DAY_SLOT_WINDOW.endMin },
};

function mealKey(meal) {
  return meal === 'dinner' ? 'dinner' : 'lunch';
}

function windowFor(meal) {
  return MEAL_SLOT_WINDOWS[mealKey(meal)];
}

export function slotId(isoDate, startMin) {
  const m = Math.max(0, Math.min(23 * 60 + 30, Math.floor(Number(startMin))));
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `${String(isoDate).slice(0, 10)}T${hh}${mm}`;
}

export function parseSlotId(id) {
  const m = String(id || '').match(/^(\d{4}-\d{2}-\d{2})[Tt](\d{2})(\d{2})$/);
  if (!m) return null;
  const hour = Number(m[2]);
  const minute = Number(m[3]);
  if (hour > 23 || minute > 59) return null;
  return {
    isoDate: m[1],
    hour,
    minute,
    startMin: hour * 60 + minute,
  };
}

export function slotLabelFromStartMin(startMin, step = SLOT_STEP_MINUTES) {
  const startH = Math.floor(startMin / 60);
  const startM = startMin % 60;
  const end = startMin + step;
  const endH = Math.floor(end / 60) % 24;
  const endM = end % 60;
  return `${cutoffLabel(startH, startM)}–${cutoffLabel(endH, endM)}`;
}

export function slotLabelFromId(id) {
  const p = parseSlotId(id);
  if (!p) return String(id || '');
  return slotLabelFromStartMin(p.startMin);
}

/** Ceil (now + lead) up to next slot step. */
export function earliestBookableStartMin(now = nowIst(), lead = SLOT_LEAD_MINUTES) {
  const nowMin = now.hour * 60 + now.minute;
  const earliest = nowMin + Math.max(0, Number(lead) || 0);
  return Math.ceil(earliest / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES;
}

/**
 * Whether this slot start is still bookable given lead time (IST).
 * Future service days: always open (kitchen day checked by caller).
 */
export function isSlotTimeOpen(isoDate, startMin, now = nowIst()) {
  if (config.bypassCutoffs) return true;
  const day = String(isoDate).slice(0, 10);
  if (day < now.isoDate) return false;
  if (day > now.isoDate) return true;
  return earliestBookableStartMin(now) <= Number(startMin);
}

/** Raw 30-min starts for a meal on a calendar day (no lead/capacity). */
export function listMealSlotStarts(meal, isoDate) {
  const win = windowFor(meal);
  const out = [];
  for (let t = win.startMin; t + SLOT_STEP_MINUTES <= win.endMin; t += SLOT_STEP_MINUTES) {
    out.push({
      id: slotId(isoDate, t),
      isoDate: String(isoDate).slice(0, 10),
      meal: mealKey(meal),
      startMin: t,
      label: slotLabelFromStartMin(t),
      capacity: SLOT_CAPACITY,
    });
  }
  return out;
}

export function enrichSlotsWithCounts(slots, countBySlotId = {}) {
  const capacity = SLOT_CAPACITY;
  return (slots || []).map((s) => {
    const booked = Number(countBySlotId[s.id] || 0);
    const unlimited = !Number.isFinite(capacity) || capacity <= 0;
    const remaining = unlimited ? 999 : Math.max(0, capacity - booked);
    const timeOpen = isSlotTimeOpen(s.isoDate, s.startMin);
    const locked = !timeOpen || (!unlimited && remaining <= 0);
    return {
      ...s,
      capacity: unlimited ? 0 : capacity,
      booked,
      remaining: unlimited ? 999 : remaining,
      locked,
      available: !locked,
    };
  });
}

/**
 * Bookable slots for a meal on its service day (lead + kitchen day).
 * @returns {Array<object>}
 */
export function planMealSlotCandidates({
  meal,
  serviceDate,
  now = nowIst(),
} = {}) {
  const m = mealKey(meal);
  const iso = String(serviceDate || now.isoDate).slice(0, 10);
  const day = dayFromIso(iso);
  if (!isKitchenServiceDayAvailable(m, day)) return [];

  return listMealSlotStarts(m, iso)
    .filter((s) => isSlotTimeOpen(s.isoDate, s.startMin, now))
    .map((s) => ({
      ...s,
      dayLabel: day.dayDateLabel,
      serviceDay: day,
    }));
}

export function mealFromSlotStartMin(startMin) {
  const t = Number(startMin);
  if (!Number.isFinite(t)) return null;
  if (t < DAY_SLOT_WINDOW.startMin || t >= DAY_SLOT_WINDOW.endMin) return null;
  return t < MEAL_SPLIT_MIN ? 'lunch' : 'dinner';
}

export function mealFromSlotId(id) {
  const p = parseSlotId(id);
  return p ? mealFromSlotStartMin(p.startMin) : null;
}

/**
 * Bookable delivery windows (continuous 12:30–11:00 PM), today first.
 * daysAhead 0 = today only (WhatsApp); the website passes 1 so tomorrow is always bookable.
 * After last-order / call-confirm (9:30 PM) today's windows drop out; later days stay open.
 */
export function planAllMealSlotCandidates({ now = nowIst(), daysAhead = 0 } = {}) {
  const out = [];
  // Both meal labels share the same last-order time; either being in call-confirm closes today.
  const todayClosed = isMealCallConfirmWindow('dinner') || isMealCallConfirmWindow('lunch');

  for (let d = 0; d <= daysAhead; d += 1) {
    if (d === 0 && todayClosed) continue;
    const day = d === 0 ? now : istCalendarOffset(d);
    for (const meal of ['lunch', 'dinner']) {
      if (!isKitchenServiceDayAvailable(meal, day)) continue;
      for (const s of listMealSlotStarts(meal, day.isoDate)) {
        if (!isSlotTimeOpen(s.isoDate, s.startMin, now)) continue;
        out.push({
          ...s,
          meal,
          dayOffset: d,
          dayLabel: day.dayDateLabel,
          serviceDay: day,
        });
      }
    }
  }
  out.sort((a, b) => a.isoDate.localeCompare(b.isoDate) || a.startMin - b.startMin);
  return out;
}

export function slotOptionDescription(slot) {
  const meal = slot.meal || mealFromSlotId(slot.id) || '';
  const mealBit = meal === 'dinner' ? 'Dinner' : meal === 'lunch' ? 'Lunch' : '';
  // Today-only list — keep row subtitle short
  return mealBit.slice(0, 72);
}

/** Build service_label with day · window. */
export function serviceLabelWithSlot(serviceDayOrIso, slotIdOrLabel) {
  const day =
    typeof serviceDayOrIso === 'object' && serviceDayOrIso?.dayDateLabel
      ? serviceDayOrIso
      : dayFromIso(serviceDayOrIso);
  const window =
    parseSlotId(slotIdOrLabel) ? slotLabelFromId(slotIdOrLabel) : String(slotIdOrLabel || '');
  if (!window) return day.dayDateLabel;
  return `${day.dayDateLabel} · ${window}`;
}

export function getSlotCapacity() {
  return SLOT_CAPACITY;
}

export function getSlotLeadMinutes() {
  return SLOT_LEAD_MINUTES;
}
