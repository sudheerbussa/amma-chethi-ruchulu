/**
 * Per-dish storefront images — files under data/dish-images/{CODE}.{jpg|png|webp}.
 * No DB column required; survives menu reseed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { resolveFromRoot } from './paths.js';
import { config } from './config.js';

const ALLOWED_EXT = new Map([
  ['image/jpeg', '.jpg'],
  ['image/jpg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);
const MAX_BYTES = 5 * 1024 * 1024;

function imagesDir() {
  return resolveFromRoot('data', 'dish-images');
}

function ensureDir() {
  fs.mkdirSync(imagesDir(), { recursive: true });
}

function normalizeCode(code) {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 24);
}

function extFromMime(mime) {
  return ALLOWED_EXT.get(String(mime || '').toLowerCase().split(';')[0].trim()) || null;
}

/** Absolute path if a dish image exists, else null. */
export function findDishImageFile(code) {
  const key = normalizeCode(code);
  if (!key) return null;
  ensureDir();
  for (const ext of ['.jpg', '.jpeg', '.png', '.webp']) {
    const file = path.join(imagesDir(), `${key}${ext}`);
    if (fs.existsSync(file)) return { file, ext, code: key };
  }
  // Case-insensitive scan for odd uploads
  try {
    const hit = fs.readdirSync(imagesDir()).find((n) => {
      const base = path.parse(n).name.toUpperCase();
      return base === key;
    });
    if (hit) {
      return { file: path.join(imagesDir(), hit), ext: path.extname(hit), code: key };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function dishHasImage(code) {
  return Boolean(findDishImageFile(code));
}

export function dishImagePublicUrl(code, baseUrl = config.publicBaseUrl) {
  const key = normalizeCode(code);
  if (!key || !dishHasImage(key)) return null;
  const base = String(baseUrl || '').replace(/\/$/, '');
  // cache-buster from mtime so browser picks up replacements
  let v = '';
  try {
    const found = findDishImageFile(key);
    if (found) v = `?v=${Math.floor(fs.statSync(found.file).mtimeMs)}`;
  } catch {
    /* ignore */
  }
  return `${base}/media/dish/${encodeURIComponent(key)}${v}`;
}

export function saveDishImage(code, { buffer, mime }) {
  const key = normalizeCode(code);
  if (!key) throw new Error('Dish code required');
  const ext = extFromMime(mime);
  if (!ext) throw new Error('Use a JPEG, PNG, or WebP image');
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  if (!buf.length) throw new Error('Empty file');
  if (buf.length > MAX_BYTES) throw new Error('Image must be 5 MB or smaller');

  ensureDir();
  // Remove previous extensions for this code
  for (const e of ['.jpg', '.jpeg', '.png', '.webp']) {
    const prev = path.join(imagesDir(), `${key}${e}`);
    if (fs.existsSync(prev)) {
      try {
        fs.unlinkSync(prev);
      } catch {
        /* ignore */
      }
    }
  }
  const dest = path.join(imagesDir(), `${key}${ext}`);
  fs.writeFileSync(dest, buf);
  return {
    code: key,
    file: dest,
    mime: [...ALLOWED_EXT.entries()].find(([, x]) => x === ext)?.[0] || mime,
    bytes: buf.length,
    has_image: true,
  };
}

export function deleteDishImage(code) {
  const found = findDishImageFile(code);
  if (!found) return { code: normalizeCode(code), has_image: false };
  try {
    fs.unlinkSync(found.file);
  } catch {
    /* ignore */
  }
  return { code: found.code, has_image: false };
}

export function mimeForDishFile(filePath) {
  const ext = path.extname(filePath || '').toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}
