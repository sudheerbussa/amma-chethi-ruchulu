/**
 * ACR-Fresh ops flags: min order, hourly slot window + capacity.
 */

import { config } from './config.js';

export const META_KEY_OPS = 'ops_settings_v1';

/** @deprecated retained for backwards-compatible meta rows */
export const DEFAULT_LAUNCH_ISO = '2026-08-27';

/** Default: 8:00–20:00 IST (last slot 19–20), no hourly order cap, 30 min lead (packing only). */
export const DEFAULT_SLOT_OPEN_HOUR = 8;
export const DEFAULT_SLOT_CLOSE_HOUR = 20;
/** 0 = unlimited (no capacity lock). Re-enable later with a positive N. */
export const DEFAULT_SLOT_CAPACITY = 0;
export const DEFAULT_SLOT_LEAD_MINUTES = 30;

export const DEFAULT_LUNCH_CUTOFF_HOUR = DEFAULT_SLOT_OPEN_HOUR;
export const DEFAULT_DINNER_CUTOFF_HOUR = DEFAULT_SLOT_CLOSE_HOUR;
export const DEFAULT_CUTOFF_MINUTE = 0;
export const DEFAULT_SATURDAY_DINNER_OPEN = true;
export const DEFAULT_SUNDAY_DINNER_PARTY_OPEN = true;

let launchIsoCache = DEFAULT_LAUNCH_ISO;
let slotOpenHourCache = DEFAULT_SLOT_OPEN_HOUR;
let slotCloseHourCache = DEFAULT_SLOT_CLOSE_HOUR;
let slotCapacityCache = DEFAULT_SLOT_CAPACITY;
let slotLeadMinutesCache = DEFAULT_SLOT_LEAD_MINUTES;
let lunchCutoffHourCache = DEFAULT_SLOT_OPEN_HOUR;
let dinnerCutoffHourCache = DEFAULT_SLOT_CLOSE_HOUR;
let lunchCutoffMinuteCache = DEFAULT_CUTOFF_MINUTE;
let dinnerCutoffMinuteCache = DEFAULT_CUTOFF_MINUTE;
let saturdayDinnerOpenCache = DEFAULT_SATURDAY_DINNER_OPEN;
let sundayDinnerPartyOpenCache = DEFAULT_SUNDAY_DINNER_PARTY_OPEN;

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

function clampPositiveInt(n, fallback, max = 100) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v) || v < 1) return fallback;
  return Math.min(max, v);
}

/** Capacity: 0 = unlimited (no per-hour order lock). */
function clampSlotCapacity(n, fallback = DEFAULT_SLOT_CAPACITY) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v) || v < 0) return fallback;
  return Math.min(999, v);
}

function parseBoolFlag(raw, defaultTrue = true) {
  if (raw === false || raw === 0 || raw === '0' || raw === 'false') return false;
  if (raw === true || raw === 1 || raw === '1' || raw === 'true') return true;
  return defaultTrue;
}

export function getSlotOpenHour() {
  return slotOpenHourCache;
}

export function getSlotCloseHour() {
  return slotCloseHourCache;
}

export function getSlotCapacity() {
  return slotCapacityCache;
}

/** False when capacity is 0 (unlimited — no per-hour order lock). */
export function isSlotCapacityEnabled() {
  return Number(slotCapacityCache) > 0;
}

export function getSlotLeadMinutes() {
  return slotLeadMinutesCache;
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

export function getLunchCutoffTotalMinutes() {
  return lunchCutoffHourCache * 60 + lunchCutoffMinuteCache;
}

export function getDinnerCutoffTotalMinutes() {
  return dinnerCutoffHourCache * 60 + dinnerCutoffMinuteCache;
}

export function getSaturdayDinnerOpen() {
  return saturdayDinnerOpenCache !== false;
}

export function getSundayDinnerPartyOpen() {
  return sundayDinnerPartyOpenCache !== false;
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
  sundayDinnerPartyOpenCache = settings.sunday_dinner_party_open !== false;

  slotOpenHourCache = clampHour(
    settings.slot_open_hour != null ? settings.slot_open_hour : settings.lunch_cutoff_hour,
    DEFAULT_SLOT_OPEN_HOUR,
  );
  const closeRaw =
    settings.slot_close_hour != null ? settings.slot_close_hour : settings.dinner_cutoff_hour;
  slotCloseHourCache = Math.max(
    slotOpenHourCache + 1,
    clampHour(closeRaw, DEFAULT_SLOT_CLOSE_HOUR),
  );
  slotCapacityCache = clampSlotCapacity(
    settings.slot_capacity != null ? settings.slot_capacity : DEFAULT_SLOT_CAPACITY,
    DEFAULT_SLOT_CAPACITY,
  );
  slotLeadMinutesCache = clampPositiveInt(
    settings.slot_lead_minutes != null ? settings.slot_lead_minutes : DEFAULT_SLOT_LEAD_MINUTES,
    DEFAULT_SLOT_LEAD_MINUTES,
    240,
  );
}

export function defaultOpsSettings() {
  const envMin = Number(config.minOrderPaise);
  return {
    min_order_paise: Number.isFinite(envMin) && envMin >= 0 ? Math.round(envMin) : 10000,
    min_order_day_override: null,
    launch_iso: DEFAULT_LAUNCH_ISO,
    slot_open_hour: DEFAULT_SLOT_OPEN_HOUR,
    slot_close_hour: DEFAULT_SLOT_CLOSE_HOUR,
    slot_capacity: DEFAULT_SLOT_CAPACITY,
    slot_lead_minutes: DEFAULT_SLOT_LEAD_MINUTES,
    lunch_cutoff_hour: DEFAULT_SLOT_OPEN_HOUR,
    dinner_cutoff_hour: DEFAULT_SLOT_CLOSE_HOUR,
    lunch_cutoff_minute: DEFAULT_CUTOFF_MINUTE,
    dinner_cutoff_minute: DEFAULT_CUTOFF_MINUTE,
    saturday_dinner_open: DEFAULT_SATURDAY_DINNER_OPEN,
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

  const slot_open_hour = clampHour(
    raw.slot_open_hour != null ? raw.slot_open_hour : raw.lunch_cutoff_hour ?? base.slot_open_hour,
    DEFAULT_SLOT_OPEN_HOUR,
  );
  const slot_close_hour = Math.max(
    slot_open_hour + 1,
    clampHour(
      raw.slot_close_hour != null ? raw.slot_close_hour : raw.dinner_cutoff_hour ?? base.slot_close_hour,
      DEFAULT_SLOT_CLOSE_HOUR,
    ),
  );
  const slot_capacity = clampSlotCapacity(
    raw.slot_capacity != null ? raw.slot_capacity : base.slot_capacity,
    DEFAULT_SLOT_CAPACITY,
  );
  const slot_lead_minutes = clampPositiveInt(
    raw.slot_lead_minutes != null ? raw.slot_lead_minutes : base.slot_lead_minutes,
    DEFAULT_SLOT_LEAD_MINUTES,
    240,
  );

  const lunch_cutoff_hour = slot_open_hour;
  const dinner_cutoff_hour = slot_close_hour;
  const lunch_cutoff_minute = clampMinute(
    raw.lunch_cutoff_minute != null ? raw.lunch_cutoff_minute : base.lunch_cutoff_minute,
  );
  const dinner_cutoff_minute = clampMinute(
    raw.dinner_cutoff_minute != null ? raw.dinner_cutoff_minute : base.dinner_cutoff_minute,
  );

  const saturday_dinner_open = parseBoolFlag(raw.saturday_dinner_open, true);
  const sunday_dinner_party_open = parseBoolFlag(raw.sunday_dinner_party_open, true);

  const next = {
    min_order_paise,
    min_order_day_override,
    launch_iso,
    slot_open_hour,
    slot_close_hour,
    slot_capacity,
    slot_lead_minutes,
    lunch_cutoff_hour,
    dinner_cutoff_hour,
    lunch_cutoff_minute,
    dinner_cutoff_minute,
    saturday_dinner_open,
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
