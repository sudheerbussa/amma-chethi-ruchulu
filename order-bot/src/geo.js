/** Kitchen distance → delivery zone (straight-line km). */

import { OpenLocationCode } from 'open-location-code';
import { config } from './config.js';

const PLUS_CODE_RE = /[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{2,3}/i;

const EARTH_RADIUS_KM = 6371;

export function haversineKm(lat1, lon1, lat2, lon2) {
  const a1 = (Number(lat1) * Math.PI) / 180;
  const a2 = (Number(lat2) * Math.PI) / 180;
  const dLat = a2 - a1;
  const dLon = ((Number(lon2) - Number(lon1)) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a1) * Math.cos(a2) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** Map straight-line km to z1/z2/z3 bands. */
export function zoneFromDistanceKm(km) {
  const d = Number(km);
  if (!Number.isFinite(d) || d < 0) return 'z2';
  if (d <= 3) return 'z1';
  if (d <= 6) return 'z2';
  return 'z3';
}

export function kitchenCoords() {
  return { lat: config.kitchenLat, lng: config.kitchenLng };
}

/** Distance from customer pin to kitchen + zone id. */
export function deliveryZoneFromPin(lat, lng) {
  const kitchen = kitchenCoords();
  const km = haversineKm(lat, lng, kitchen.lat, kitchen.lng);
  return {
    km,
    zone: zoneFromDistanceKm(km),
    withinService: km <= config.maxDeliveryKm,
  };
}

/** ~80 m — treat as same saved pin. */
export function locationsNear(lat1, lng1, lat2, lng2, thresholdM = 80) {
  if (![lat1, lng1, lat2, lng2].every((n) => Number.isFinite(Number(n)))) return false;
  const km = haversineKm(lat1, lng1, lat2, lng2);
  return km * 1000 <= thresholdM;
}

export function mapsUrlFromLatLng(lat, lng) {
  return `https://maps.google.com/?q=${Number(lat)},${Number(lng)}`;
}

function parseLatLngPair(lat, lng) {
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  if (la < -90 || la > 90 || lo < -180 || lo > 180) return null;
  return { latitude: la, longitude: lo };
}

/**
 * Extract lat/lng from Google Maps URLs or plain "lat, lng" text (no network).
 */
export function parseGoogleMapsLocation(text) {
  const s = String(text || '').trim();
  if (!s) return null;

  let m = s.match(/^\s*(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})\s*$/);
  if (m) return parseLatLngPair(m[1], m[2]);

  m = s.match(/geo:(-?\d+\.?\d*),(-?\d+\.?\d*)/i);
  if (m) return parseLatLngPair(m[1], m[2]);

  // Prefer !3d…!4d… (place pin) over @… (map centre) in long share URLs
  m = s.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (m) return parseLatLngPair(m[1], m[2]);

  m = s.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)(?:,\d+(?:\.\d+)?z)?/);
  if (m) return parseLatLngPair(m[1], m[2]);

  m = s.match(/[?&]q=(-?\d+\.?\d*)[,%2C+\s]+(-?\d+\.?\d*)/i);
  if (m) return parseLatLngPair(m[1], m[2]);

  m = s.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/i);
  if (m) return parseLatLngPair(m[1], m[2]);

  m = s.match(/[?&]center=(-?\d+\.?\d*),(-?\d+\.?\d*)/i);
  if (m) return parseLatLngPair(m[1], m[2]);

  return null;
}

/** Pull first Google Maps URL from message text (incl. maps.app.goo.gl?query). */
export function extractGoogleMapsUrl(text) {
  const s = String(text || '').trim();
  const m = s.match(
    /https?:\/\/(?:maps\.app\.goo\.gl\/[^\s]+|goo\.gl\/maps\/[^\s]+|(?:www\.)?google\.[^\s/]+\/maps[^\s]*|maps\.google\.[^\s]+)/i,
  );
  if (!m) return null;
  return m[0].replace(/[.,;!?]+$/, '');
}

/** Decode Google Plus Code (full or short — short uses kitchen as reference). */
export function coordsFromPlusCode(text) {
  const m = String(text || '').match(PLUS_CODE_RE);
  if (!m) return null;
  const code = m[0].toUpperCase();
  const olc = new OpenLocationCode();
  try {
    let area;
    if (olc.isFull(code)) {
      area = olc.decode(code);
    } else {
      const kitchen = kitchenCoords();
      const full = olc.recoverNearest(code, kitchen.lat, kitchen.lng);
      area = olc.decode(full);
    }
    if (!area || area.latitudeCenter == null || area.longitudeCenter == null) return null;
    return { latitude: area.latitudeCenter, longitude: area.longitudeCenter };
  } catch {
    return null;
  }
}

/** Resolve short Maps links (maps.app.goo.gl) via redirect + plus-code / URL parse. */
export async function resolveGoogleMapsLocation(text) {
  const direct = parseGoogleMapsLocation(text);
  if (direct) return direct;

  const plusDirect = coordsFromPlusCode(text);
  if (plusDirect) return plusDirect;

  const url = extractGoogleMapsUrl(text);
  if (!url) return null;

  const plusFromUrl = coordsFromPlusCode(decodeURIComponent(url));
  if (plusFromUrl) return plusFromUrl;

  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    const finalUrl = decodeURIComponent(res.url || url);

    const fromFinal = parseGoogleMapsLocation(finalUrl);
    if (fromFinal) return fromFinal;

    const fromFinalPlus = coordsFromPlusCode(finalUrl);
    if (fromFinalPlus) return fromFinalPlus;

    const body = await res.text();
    const fromBody = parseGoogleMapsLocation(body);
    if (fromBody) return fromBody;

    return coordsFromPlusCode(body);
  } catch {
    return coordsFromPlusCode(url);
  }
}

/** Human-readable address line from WhatsApp location payload. */
export function formatLocationAddress(location) {
  const name = String(location?.name || '').trim();
  const addr = String(location?.address || '').trim();
  if (name && addr) return `${name}, ${addr}`.slice(0, 200);
  if (addr) return addr.slice(0, 200);
  if (name) return name.slice(0, 200);
  const lat = Number(location?.latitude);
  const lng = Number(location?.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `📍 Location pin (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
  }
  return '📍 Location pin';
}

export function formatDistanceKm(km) {
  const d = Number(km);
  if (!Number.isFinite(d)) return '';
  if (d < 1) return `${Math.round(d * 1000)} m`;
  return `${d.toFixed(1)} km`;
}
