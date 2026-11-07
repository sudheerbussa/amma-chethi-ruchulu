import { config } from './config.js';
import { LOCAL_DELIVERY_TOWNS } from './menu.js';

export const FULFILLMENT = {
  pickup: 'pickup',
  local: 'local',
  courier: 'courier',
};

export function normalizeTown(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ');
}

export function isLocalTown(town) {
  const t = normalizeTown(town);
  if (!t) return false;
  return LOCAL_DELIVERY_TOWNS.some((x) => t === x || t.includes(x) || x.includes(t));
}

/**
 * @param {{ mode: string, town?: string, subtotalPaise: number }} opts
 */
export function computeShipping({ mode, town, subtotalPaise }) {
  const m = String(mode || '').toLowerCase();
  const sub = Math.max(0, Math.round(Number(subtotalPaise) || 0));
  let fee = 0;
  let label = 'Shipping';
  let zone = m;

  if (m === FULFILLMENT.pickup) {
    fee = config.shippingPickupPaise;
    label = 'Pickup at Bhor shop';
    zone = 'pickup';
  } else if (m === FULFILLMENT.local) {
    fee = config.shippingLocalPaise;
    label = 'Local delivery';
    zone = 'local';
    if (town && !isLocalTown(town)) {
      return {
        ok: false,
        error: `Local delivery is only available for: Bhor, Nasrapur, Kapurhol, Khed Shivapur, Shirwal, Velhe, Wai. Choose courier for other towns.`,
      };
    }
  } else if (m === FULFILLMENT.courier) {
    fee = config.shippingCourierPaise;
    label = 'Courier (rest of India)';
    zone = 'courier';
  } else {
    return { ok: false, error: 'Choose pickup, local delivery, or courier.' };
  }

  let free_delivery = false;
  if (m !== FULFILLMENT.pickup && sub >= config.freeDeliveryAbovePaise && fee > 0) {
    fee = 0;
    free_delivery = true;
    label = `${label} — free (order ₹${Math.round(config.freeDeliveryAbovePaise / 100).toLocaleString('en-IN')}+)`;
  }

  return {
    ok: true,
    mode: m,
    zone,
    delivery_fee_paise: fee,
    free_delivery,
    label,
    shop_address: config.shopAddress,
  };
}

export function shippingOptionsPublic() {
  return {
    pickup_paise: config.shippingPickupPaise,
    local_paise: config.shippingLocalPaise,
    courier_paise: config.shippingCourierPaise,
    free_above_paise: config.freeDeliveryAbovePaise,
    local_towns: ['Bhor', 'Nasrapur', 'Kapurhol', 'Khed Shivapur', 'Shirwal', 'Velhe', 'Wai'],
    shop_address: config.shopAddress,
  };
}
