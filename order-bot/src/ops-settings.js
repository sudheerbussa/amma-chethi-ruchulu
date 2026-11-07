/**
 * Ops flags admin can change: min order, meal cutoffs (hour + minute IST),
 * Saturday dinner, Sunday lunch, Sunday dinner party-orders.
 * launch_iso retained in storage only for backwards compatibility.
 */

import { config } from './config.js';

export const META_KEY_OPS = 'ops_settings_v1';

/** @deprecated Service is live; kept for existing ops meta rows only. */
export const DEFAULT_LAUNCH_ISO = '2026-08-10';

/**
 * Order-by time IST. Open while now (hour:minute) is strictly before cutoff.
 * Continuous day: last WA order 9:30 PM (admin UI defaults; product WA uses SCHEDULE).
 */
/** WA self-order ends here; after this → call-confirm until serve window ends. */
export const DEFAULT_LUNCH_CUTOFF_HOUR = 21;
export const DEFAULT_DINNER_CUTOFF_HOUR = 21;
export const DEFAULT_CUTOFF_MINUTE = 30;

/** Saturday dinner takes orders by default; admin can turn off. */
export const DEFAULT_SATURDAY_DINNER_OPEN = true;

/** Sunday lunch open by default (normal menu); admin can turn off. */
export const DEFAULT_SUNDAY_LUNCH_OPEN = true;

/** Sunday dinner open for Party Packs only by default; admin can turn off. */
export const DEFAULT_SUNDAY_DINNER_PARTY_OPEN = true;

/** Hot-cache so sync schedule helpers see admin-updated values. */
let launchIsoCache = DEFAULT_LAUNCH_ISO;
let lunchCutoffHourCache = DEFAULT_LUNCH_CUTOFF_HOUR;
let dinnerCutoffHourCache = DEFAULT_DINNER_CUTOFF_HOUR;
let lunchCutoffMinuteCache = DEFAULT_CUTOFF_MINUTE;
let dinnerCutoffMinuteCache = DEFAULT_CUTOFF_MINUTE;
let saturdayDinnerOpenCache = DEFAULT_SATURDAY_DINNER_OPEN;
let sundayLunchOpenCache = DEFAULT_SUNDAY_LUNCH_OPEN;
let sundayDinnerPartyOpenCache = DEFAULT_SUNDAY_DINNER_PARTY_OPEN;

/** @deprecated No longer gates ordering. */
export function getLaunchIso() {
  return launchIsoCache || DEFAULT_LAUNCH_ISO;
}

export function setLaunchIsoCache(iso) {
  const s = String(iso || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) launchIsoCache = s;
}

function clampHour(n, fallback) {
  const h = Math.round(Number(n));
  if (!Number.isFinite(h)) return fallback;
  return Math.min(23, Math.max(0, h));
}

function clampMinute(n, fallback = 0) {
  const m = Math.round(Number(n));
  if (!Number.isFinite(m)) return fallback;
  return Math.min(59, Math.max(0, m));
}

export function getLunchCutoffHour() {
  return lunchCutoffHourCache;
}

export function getDinnerCutoffHour() {
  return dinnerCutoffHourCache;
}

export function getLunchCutoffMinute() {
  return lunchCutoffMinuteCache;
}

export function getDinnerCutoffMinute() {
  return dinnerCutoffMinuteCache;
}

/** Minutes since midnight IST for lunch cutoff. */
export function getLunchCutoffTotalMinutes() {
  return lunchCutoffHourCache * 60 + lunchCutoffMinuteCache;
}

export function getDinnerCutoffTotalMinutes() {
  return dinnerCutoffHourCache * 60 + dinnerCutoffMinuteCache;
}

/** Whether Saturday dinner service is open (admin flag; default true). */
export function getSaturdayDinnerOpen() {
  return saturdayDinnerOpenCache !== false;
}

/** Whether Sunday lunch (normal menu) is open (admin flag; default true). */
export function getSundayLunchOpen() {
  return sundayLunchOpenCache !== false;
}

/** Whether Sunday dinner is open for party packs only (admin flag; default true). */
export function getSundayDinnerPartyOpen() {
  return sundayDinnerPartyOpenCache !== false;
}

function parseBoolFlag(raw, defaultTrue = true) {
  if (raw === false || raw === 0 || raw === '0' || raw === 'false') return false;
  if (raw === true || raw === 1 || raw === '1' || raw === 'true') return true;
  return defaultTrue;
}

export function setCutoffHourCache(lunchHour, dinnerHour, lunchMinute, dinnerMinute) {
  lunchCutoffHourCache = clampHour(lunchHour, DEFAULT_LUNCH_CUTOFF_HOUR);
  dinnerCutoffHourCache = clampHour(dinnerHour, DEFAULT_DINNER_CUTOFF_HOUR);
  lunchCutoffMinuteCache = clampMinute(
    lunchMinute != null ? lunchMinute : lunchCutoffMinuteCache,
    DEFAULT_CUTOFF_MINUTE,
  );
  dinnerCutoffMinuteCache = clampMinute(
    dinnerMinute != null ? dinnerMinute : dinnerCutoffMinuteCache,
    DEFAULT_CUTOFF_MINUTE,
  );
}

function applyOpsCaches(settings) {
  setLaunchIsoCache(settings.launch_iso);
  setCutoffHourCache(
    settings.lunch_cutoff_hour,
    settings.dinner_cutoff_hour,
    settings.lunch_cutoff_minute,
    settings.dinner_cutoff_minute,
  );
  saturdayDinnerOpenCache = settings.saturday_dinner_open !== false;
  sundayLunchOpenCache = settings.sunday_lunch_open !== false;
  sundayDinnerPartyOpenCache = settings.sunday_dinner_party_open !== false;
}

export function defaultOpsSettings() {
  const envMin = Number(config.minOrderPaise);
  return {
    min_order_paise: Number.isFinite(envMin) && envMin >= 0 ? Math.round(envMin) : 0,
    min_order_day_override: null,
    launch_iso: DEFAULT_LAUNCH_ISO,
    lunch_cutoff_hour: DEFAULT_LUNCH_CUTOFF_HOUR,
    dinner_cutoff_hour: DEFAULT_DINNER_CUTOFF_HOUR,
    lunch_cutoff_minute: DEFAULT_CUTOFF_MINUTE,
    dinner_cutoff_minute: DEFAULT_CUTOFF_MINUTE,
    saturday_dinner_open: DEFAULT_SATURDAY_DINNER_OPEN,
    sunday_lunch_open: DEFAULT_SUNDAY_LUNCH_OPEN,
    sunday_dinner_party_open: DEFAULT_SUNDAY_DINNER_PARTY_OPEN,
  };
}

export function normalizeOpsSettings(raw) {
  const base = defaultOpsSettings();
  if (!raw || typeof raw !== 'object') {
    applyOpsCaches(base);
    return base;
  }
  const min_order_paise = Math.max(0, Math.round(Number(raw.min_order_paise ?? base.min_order_paise) || 0));
  let min_order_day_override = null;
  const d = raw.min_order_day_override;
  if (d && typeof d === 'object' && d.date) {
    const date = String(d.date).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      min_order_day_override = {
        date,
        min_order_paise: Math.max(0, Math.round(Number(d.min_order_paise) || 0)),
      };
    }
  }
  let launch_iso = String(raw.launch_iso || base.launch_iso).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(launch_iso)) launch_iso = DEFAULT_LAUNCH_ISO;

  const lunch_cutoff_hour = clampHour(
    raw.lunch_cutoff_hour != null ? raw.lunch_cutoff_hour : base.lunch_cutoff_hour,
    DEFAULT_LUNCH_CUTOFF_HOUR,
  );
  const dinner_cutoff_hour = clampHour(
    raw.dinner_cutoff_hour != null ? raw.dinner_cutoff_hour : base.dinner_cutoff_hour,
    DEFAULT_DINNER_CUTOFF_HOUR,
  );
  const lunch_cutoff_minute = clampMinute(
    raw.lunch_cutoff_minute != null ? raw.lunch_cutoff_minute : base.lunch_cutoff_minute,
  );
  const dinner_cutoff_minute = clampMinute(
    raw.dinner_cutoff_minute != null ? raw.dinner_cutoff_minute : base.dinner_cutoff_minute,
  );

  // Default open: missing / undefined → true. Explicit false closes the slot.
  const saturday_dinner_open = parseBoolFlag(raw.saturday_dinner_open, true);
  const sunday_lunch_open = parseBoolFlag(raw.sunday_lunch_open, true);
  const sunday_dinner_party_open = parseBoolFlag(raw.sunday_dinner_party_open, true);

  const next = {
    min_order_paise,
    min_order_day_override,
    launch_iso,
    lunch_cutoff_hour,
    dinner_cutoff_hour,
    lunch_cutoff_minute,
    dinner_cutoff_minute,
    saturday_dinner_open,
    sunday_lunch_open,
    sunday_dinner_party_open,
  };
  applyOpsCaches(next);
  return next;
}

export function effectiveMinOrderPaise(settings, dayIso) {
  const s = normalizeOpsSettings(settings);
  const day = String(dayIso || '').slice(0, 10);
  if (s.min_order_day_override && s.min_order_day_override.date === day) {
    return s.min_order_day_override.min_order_paise;
  }
  return s.min_order_paise;
}

/** @deprecated Always false — service is live. */
export function isBeforeLaunch(_isoDate) {
  return false;
}

/** @deprecated Always true. */
export function isOnOrAfterLaunch(_isoDate) {
  return true;
}
