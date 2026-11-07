/**
 * Sync dishes → Meta Commerce Catalog (retailer_id = dish code).
 * Active → upsert (in stock); inactive → delete from catalog.
 */

import { config } from '../config.js';
import { getDb } from '../db.js';
import { categoryCustomerTitle, dishCustomerName } from '../menu.js';
import { formatPaise } from '../orders/cart.js';
import { getCatalogDefaultPoster } from '../posters.js';

const GRAPH = () => `https://graph.facebook.com/${config.apiVersion}`;
const META_KEY_CATALOG_ID = 'whatsapp_catalog_id';

/** Env first, then DB meta override (from admin CATALOG SET). */
export async function resolveCatalogId() {
  const fromEnv = String(config.whatsappCatalogId || '').trim();
  if (fromEnv) return fromEnv;
  try {
    const fromDb = String((await getDb().getMeta(META_KEY_CATALOG_ID)) || '').trim();
    return fromDb;
  } catch {
    return '';
  }
}

export async function setCatalogIdOverride(catalogId) {
  const id = String(catalogId || '').replace(/\D/g, '');
  if (!id) throw new Error('Catalog ID must be numeric');
  await getDb().setMeta(META_KEY_CATALOG_ID, id);
  return id;
}

function catalogImageBaseUrl() {
  const explicit = String(config.catalogDefaultImageUrl || '').trim();
  if (explicit && /^https:\/\//i.test(explicit)) {
    try {
      const u = new URL(explicit);
      u.searchParams.delete('v');
      return u.toString();
    } catch {
      return explicit;
    }
  }
  return `${String(config.publicBaseUrl || '').replace(/\/$/, '')}/media/catalog-default`;
}

export function resolveCatalogImageUrl() {
  const base = catalogImageBaseUrl();

  // Meta caches product images by URL — bump v when poster file changes.
  const poster = getCatalogDefaultPoster();
  const version =
    poster?.mtimeMs ||
    (poster?.updated_at ? Date.parse(poster.updated_at) : NaN) ||
    Date.now();
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}v=${Math.round(Number(version) || Date.now())}`;
}

function productPayload(dish, imageUrl) {
  const descParts = [
    categoryCustomerTitle(dish.category),
    dish.note || null,
    formatPaise(dish.price_paise),
  ].filter(Boolean);

  const body = {
    retailer_id: String(dish.code).toUpperCase(),
    name: dishCustomerName(dish).slice(0, 100),
    description: descParts.join(' · ').slice(0, 5000),
    // Commerce Catalog expects price in minor units as a string (paise for INR)
    price: String(Math.max(0, Math.round(Number(dish.price_paise) || 0))),
    currency: 'INR',
    availability: 'in stock',
    condition: 'new',
    brand: config.businessName.slice(0, 100),
  };
  if (imageUrl) body.image_url = imageUrl;
  return body;
}

async function graphFetch(path, { method = 'GET', body } = {}) {
  if (!config.accessToken) throw new Error('WHATSAPP_ACCESS_TOKEN required for Catalog sync');
  const res = await fetch(`${GRAPH()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `Catalog API ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/** Find catalog row by SKU (retailer_id). */
async function findProductByRetailerId(catalogId, retailerId) {
  const sku = String(retailerId).toUpperCase();
  const filter = encodeURIComponent(JSON.stringify({ retailer_id: { eq: sku } }));
  const listed = await graphFetch(
    `/${catalogId}/products?filter=${filter}&fields=id,retailer_id,image_url&limit=5`,
  );
  return listed?.data?.[0] || null;
}

/** Create or update — POST by product id so image_url refreshes on Meta. */
async function upsertCatalogProduct(catalogId, dish, imageUrl) {
  const payload = productPayload(dish, imageUrl);
  const existing = await findProductByRetailerId(catalogId, dish.code);
  if (existing?.id) {
    await graphFetch(`/${existing.id}`, { method: 'POST', body: payload });
    return 'updated';
  }
  await graphFetch(`/${catalogId}/products`, {
    method: 'POST',
    body: { ...payload, allow_upsert: true },
  });
  return 'created';
}

/** Remove a product by retailer_id; no-op if already absent. */
async function deleteProductByRetailerId(catalogId, retailerId) {
  const sku = String(retailerId).toUpperCase();
  const existing = await findProductByRetailerId(catalogId, sku);
  if (!existing?.id) return 'missing';
  await graphFetch(`/${existing.id}`, { method: 'DELETE' });
  return 'deleted';
}

/**
 * Upsert active dishes; delete inactive from the linked catalog.
 * @returns {Promise<{ ok: boolean, synced: number, deleted: number, skipped: number, errors: string[], catalog_id?: string, active?: number, inactive?: number }>}
 */
export async function syncMenuToCatalog() {
  const catalogId = await resolveCatalogId();
  if (!catalogId) {
    return {
      ok: false,
      synced: 0,
      deleted: 0,
      skipped: 0,
      errors: [
        'WHATSAPP_CATALOG_ID is empty — create Catalog in Meta Commerce Manager, link to WhatsApp, then send: CATALOG SET <id>',
      ],
    };
  }
  const imageUrl = resolveCatalogImageUrl();
  if (!imageUrl || !/^https:\/\//i.test(imageUrl)) {
    return {
      ok: false,
      synced: 0,
      deleted: 0,
      skipped: 0,
      errors: ['WHATSAPP_CATALOG_IMAGE_URL required (public HTTPS image for products)'],
    };
  }

  const dishes = await getDb().listAllDishes();
  let synced = 0;
  let deleted = 0;
  let skipped = 0;
  let active = 0;
  let inactive = 0;
  const errors = [];

  for (const dish of dishes) {
    if (!dish?.code) {
      skipped += 1;
      continue;
    }
    const code = String(dish.code).toUpperCase();
    try {
      if (dish.active) {
        await upsertCatalogProduct(catalogId, dish, imageUrl);
        synced += 1;
        active += 1;
      } else {
        const outcome = await deleteProductByRetailerId(catalogId, code);
        inactive += 1;
        if (outcome === 'deleted') deleted += 1;
        else skipped += 1;
      }
    } catch (err) {
      errors.push(`${code}: ${err.message || err}`);
    }
  }

  return {
    ok: errors.length === 0,
    synced,
    deleted,
    skipped,
    active,
    inactive,
    errors: errors.slice(0, 20),
    catalog_id: catalogId,
    image_url: imageUrl,
  };
}

export function isCatalogConfigured() {
  return Boolean(config.whatsappCatalogId && config.accessToken);
}

export async function isCatalogReady() {
  const id = await resolveCatalogId();
  return Boolean(id && config.accessToken);
}

export { META_KEY_CATALOG_ID };
