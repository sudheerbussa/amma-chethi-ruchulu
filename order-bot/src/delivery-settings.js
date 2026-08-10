/**
 * Admin delivery pricing mode.
 * - distance: classic z1/z2/z3 zone fees
 * - flat: single fee for all Tenali deliveries that day (skip km picker)
 * Optional day_override: force different mode for one IST calendar day.
 */

import { DELIVERY_ZONES } from './menu.js';
import { formatPaise } from './orders/cart.js';

export const META_KEY_DELIVERY = 'delivery_settings_v1';

export const DELIVERY_MODES = {
  distance: 'distance',
  flat: 'flat',
};

export function defaultDeliverySettings() {
  return {
    mode: DELIVERY_MODES.distance,
    flat_paise: 4000, // ₹40 default if admin switches to flat
    /** @type {{ date: string, mode: string, flat_paise: number } | null} */
    day_override: null,
  };
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
  return { mode, flat_paise, day_override };
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
