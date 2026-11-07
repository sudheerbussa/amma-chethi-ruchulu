/**
 * Admin delivery pricing mode.
 * - distance: classic z1/z2/z3 zone fees
 * - flat: single fee for all Tenali deliveries that day (skip km picker)
 * Optional day_override: force different mode for one IST calendar day.
 */

import { DELIVERY_ZONES } from './menu.js';
import { formatPaise } from './orders/cart.js';
import { config } from './config.js';
import { DEFAULT_ETA } from './delivery-track.js';

export const META_KEY_DELIVERY = 'delivery_settings_v1';

export const DELIVERY_MODES = {
  distance: 'distance',
  flat: 'flat',
};

export function defaultDeliverySettings() {
  return {
    mode: DELIVERY_MODES.distance,
    flat_paise: 2900, // ₹29 default if admin switches to flat
    /** @type {{ date: string, mode: string, flat_paise: number } | null} */
    day_override: null,
    /** Google Maps / live share URL sent when order goes out for delivery */
    track_map_url: config.deliveryTrackMapUrl || '',
    /** Phone customers can call while food is on the way */
    delivery_contact: String(config.supportPhone || '').replace(/\D/g, ''),
    eta_minutes_z1: DEFAULT_ETA.z1,
    eta_minutes_z2: DEFAULT_ETA.z2,
    eta_minutes_z3: DEFAULT_ETA.z3,
    eta_minutes_flat: DEFAULT_ETA.flat,
  };
}

function clampEta(n, fallback) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return fallback;
  return Math.min(180, Math.max(5, v));
}

export function normalizeDeliverySettings(raw) {
  const base = defaultDeliverySettings();
  if (!raw || typeof raw !== 'object') return base;
  const mode =
    String(raw.mode || '').toLowerCase() === DELIVERY_MODES.flat
      ? DELIVERY_MODES.flat
      : DELIVERY_MODES.distance;
  const flat_paise = Math.max(0, Math.round(Number(raw.flat_paise) || base.flat_paise));
  let day_override = null;
  const d = raw.day_override;
  if (d && typeof d === 'object' && d.date) {
    const date = String(d.date).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const ovMode =
        String(d.mode || '').toLowerCase() === DELIVERY_MODES.flat
          ? DELIVERY_MODES.flat
          : DELIVERY_MODES.distance;
      day_override = {
        date,
        mode: ovMode,
        flat_paise: Math.max(0, Math.round(Number(d.flat_paise) || flat_paise)),
      };
    }
  }
  const track_map_url = String(
    raw.track_map_url != null ? raw.track_map_url : base.track_map_url || '',
  ).trim();
  const delivery_contact = String(
    raw.delivery_contact != null ? raw.delivery_contact : base.delivery_contact || '',
  ).replace(/\D/g, '');

  return {
    mode,
    flat_paise,
    day_override,
    track_map_url,
    delivery_contact,
    eta_minutes_z1: clampEta(raw.eta_minutes_z1 ?? base.eta_minutes_z1, DEFAULT_ETA.z1),
    eta_minutes_z2: clampEta(raw.eta_minutes_z2 ?? base.eta_minutes_z2, DEFAULT_ETA.z2),
    eta_minutes_z3: clampEta(raw.eta_minutes_z3 ?? base.eta_minutes_z3, DEFAULT_ETA.z3),
    eta_minutes_flat: clampEta(raw.eta_minutes_flat ?? base.eta_minutes_flat, DEFAULT_ETA.flat),
  };
}

/** Effective mode for a given IST YYYY-MM-DD (service day or today). */
export function effectiveDeliverySettings(settings, dayIso) {
  const s = normalizeDeliverySettings(settings);
  const day = String(dayIso || '').slice(0, 10);
  if (s.day_override && s.day_override.date === day) {
    return {
      mode: s.day_override.mode,
      flat_paise: s.day_override.flat_paise,
      source: 'day_override',
      date: day,
      default_mode: s.mode,
      default_flat_paise: s.flat_paise,
    };
  }
  return {
    mode: s.mode,
    flat_paise: s.flat_paise,
    source: 'default',
    date: day || null,
    default_mode: s.mode,
    default_flat_paise: s.flat_paise,
  };
}

export function zoneBaseFeePaise(zoneId) {
  if (zoneId === 'flat' || zoneId === 'flat_rate') return 0;
  const zone = DELIVERY_ZONES.find((z) => z.id === zoneId);
  return zone ? zone.fee_paise : 4500;
}

/**
 * Base delivery fee before free-delivery offer (offers still zero it out).
 * @param {string|null} zoneId
 * @param {{ mode?: string, flat_paise?: number }} effective
 */
export function baseDeliveryFeePaise(zoneId, effective) {
  if (effective?.mode === DELIVERY_MODES.flat) {
    return Math.max(0, Math.round(Number(effective.flat_paise) || 0));
  }
  return zoneBaseFeePaise(zoneId);
}

export function deliveryModeLabel(effective) {
  if (effective?.mode === DELIVERY_MODES.flat) {
    return `Flat delivery ${formatPaise(effective.flat_paise)}`;
  }
  return 'Delivery by distance (0–3 / 3–6 / 6+ km)';
}
