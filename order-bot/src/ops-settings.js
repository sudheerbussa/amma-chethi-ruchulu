/**
 * Ops flags admin can change: min order, launch date.
 * Weekend kitchen closed days are fixed in cutoffs.js.
 */

import { config } from './config.js';

export const META_KEY_OPS = 'ops_settings_v1';

/** First full service day (IST). Before this, only pre-book this date. */
export const DEFAULT_LAUNCH_ISO = '2026-08-10';

/** Hot-cache so sync schedule helpers see admin-updated launch date. */
let launchIsoCache = DEFAULT_LAUNCH_ISO;

export function getLaunchIso() {
  return launchIsoCache || DEFAULT_LAUNCH_ISO;
}

export function setLaunchIsoCache(iso) {
  const s = String(iso || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) launchIsoCache = s;
}

export function defaultOpsSettings() {
  const envMin = Number(config.minOrderPaise);
  return {
    min_order_paise: Number.isFinite(envMin) && envMin >= 0 ? Math.round(envMin) : 0,
    min_order_day_override: null,
    launch_iso: DEFAULT_LAUNCH_ISO,
  };
}

export function normalizeOpsSettings(raw) {
  const base = defaultOpsSettings();
  if (!raw || typeof raw !== 'object') {
    setLaunchIsoCache(base.launch_iso);
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
  setLaunchIsoCache(launch_iso);
  return { min_order_paise, min_order_day_override, launch_iso };
}

export function effectiveMinOrderPaise(settings, dayIso) {
  const s = normalizeOpsSettings(settings);
  const day = String(dayIso || '').slice(0, 10);
  if (s.min_order_day_override && s.min_order_day_override.date === day) {
    return s.min_order_day_override.min_order_paise;
  }
  return s.min_order_paise;
}

export function isBeforeLaunch(isoDate) {
  const d = String(isoDate || '').slice(0, 10);
  return d < getLaunchIso();
}

export function isOnOrAfterLaunch(isoDate) {
  return !isBeforeLaunch(isoDate);
}
