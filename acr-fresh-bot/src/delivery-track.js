/**
 * Delivery tracking helpers (map link + ETA + contact) for "out for delivery".
 */

import { config } from './config.js';

const DEFAULT_ETA = {
  z1: 25,
  z2: 40,
  z3: 55,
  flat: 35,
};

export function formatTrackPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `+91 ${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
  return `+${digits}`;
}

export function etaMinutesForZone(zoneId, settings = {}) {
  const z = String(zoneId || '');
  if (z === 'z1') return Math.max(5, Math.round(Number(settings.eta_minutes_z1) || DEFAULT_ETA.z1));
  if (z === 'z2') return Math.max(5, Math.round(Number(settings.eta_minutes_z2) || DEFAULT_ETA.z2));
  if (z === 'z3') return Math.max(5, Math.round(Number(settings.eta_minutes_z3) || DEFAULT_ETA.z3));
  return Math.max(5, Math.round(Number(settings.eta_minutes_flat) || DEFAULT_ETA.flat));
}

export function resolveDeliveryTrack({ order, settings, overrides = {} } = {}) {
  const s = settings && typeof settings === 'object' ? settings : {};
  const meta = order?.meta && typeof order.meta === 'object' ? order.meta : {};

  const mapUrl = String(
    overrides.track_map_url != null
      ? overrides.track_map_url
      : meta.track_map_url || s.track_map_url || config.deliveryTrackMapUrl || '',
  ).trim();

  const contactRaw =
    overrides.delivery_contact != null
      ? overrides.delivery_contact
      : meta.delivery_contact || s.delivery_contact || config.supportPhone || '';
  const contact = String(contactRaw).replace(/\D/g, '');

  const eta =
    overrides.eta_minutes != null
      ? Math.max(5, Math.round(Number(overrides.eta_minutes) || 0))
      : meta.eta_minutes != null
        ? Math.max(5, Math.round(Number(meta.eta_minutes) || 0))
        : etaMinutesForZone(order?.delivery_zone, s);

  return {
    track_map_url: mapUrl,
    delivery_contact: contact,
    delivery_contact_label: formatTrackPhone(contact),
    eta_minutes: eta,
  };
}

export function deliveryTrackLines(track) {
  const lines = [];
  if (track?.eta_minutes) lines.push(`⏱ ETA ~${track.eta_minutes} minutes`);
  if (track?.delivery_contact_label) {
    lines.push(`📞 Delivery contact: ${track.delivery_contact_label}`);
  }
  if (track?.track_map_url) lines.push(`📍 Tap “Track on map” below for location`);
  else lines.push(`📍 Rider / kitchen will call if needed`);
  return lines;
}

export { DEFAULT_ETA };
