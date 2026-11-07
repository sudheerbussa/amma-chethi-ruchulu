/**
 * WhatsApp menu posters.
 * - Daily: one file per weekday (monday.jpg … sunday.jpg)
 * - Specials: party packs / specials
 * - Full menu: up to 3 catalog posters with all items (full_menu, full_menu_2, full_menu_3)
 */
import fs from 'node:fs';
import path from 'node:path';
import { resolveFromRoot } from './paths.js';
import { sendImage, sendText, uploadLocalImage } from './whatsapp.js';

export const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const WEEKDAY_TITLES = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export const SPECIALS_SLOT = 'specials';
export const FULL_MENU_SLOTS = ['full_menu', 'full_menu_2', 'full_menu_3'];

/** All uploadable slots (weekdays + specials + full menu). Legacy `daily` still readable. */
export const POSTER_SLOTS = [
  ...WEEKDAYS.map((id) => ({
    id,
    kind: 'daily',
    title: `${WEEKDAY_TITLES[id]} menu`,
    hint: `Daily meals poster for ${WEEKDAY_TITLES[id]}. Overwrite only this day.`,
  })),
  {
    id: SPECIALS_SLOT,
    kind: 'specials',
    title: 'Special dishes',
    hint: 'Party packs and specials. Change only when the poster changes. Overwrites.',
  },
  ...FULL_MENU_SLOTS.map((id, i) => ({
    id,
    kind: 'full_menu',
    title: i === 0 ? 'Full menu (all items) #1' : `Full menu #${i + 1}`,
    hint: 'Complete catalog poster (all items & prices). Shown on Hi / View menu. Up to 3 pages.',
  })),
];

const SLOT_IDS = new Set([...WEEKDAYS, SPECIALS_SLOT, ...FULL_MENU_SLOTS, 'daily']);
const ALLOWED_EXT = new Map([
  ['image/jpeg', '.jpg'],
  ['image/jpg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);
const MAX_BYTES = 5 * 1024 * 1024;

const postersDir = () => resolveFromRoot('data', 'posters');
const metaPath = () => path.join(postersDir(), 'meta.json');

/** slot → { mediaId, mtimeMs, file } */
const mediaCache = new Map();

export function isPosterSlot(id) {
  return SLOT_IDS.has(String(id || '').toLowerCase());
}

export function isWeekdaySlot(id) {
  return WEEKDAYS.includes(String(id || '').toLowerCase());
}

export function isFullMenuSlot(id) {
  return FULL_MENU_SLOTS.includes(String(id || '').toLowerCase());
}

/** Current weekday key in Asia/Kolkata (e.g. "monday"). */
export function todayWeekdayIst(date = new Date()) {
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
  }).format(date);
  return String(name || '').toLowerCase();
}

function ensureDir() {
  fs.mkdirSync(postersDir(), { recursive: true });
}

function readMeta() {
  try {
    const raw = fs.readFileSync(metaPath(), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeMeta(meta) {
  ensureDir();
  fs.writeFileSync(metaPath(), JSON.stringify(meta, null, 2));
}

function extFromMime(mime) {
  return ALLOWED_EXT.get(String(mime || '').toLowerCase()) || null;
}

function findSlotFile(slot) {
  const dir = postersDir();
  if (!fs.existsSync(dir)) return null;
  const key = String(slot || '').toLowerCase();
  const names = fs.readdirSync(dir);
  const hit = names.find(
    (n) => n === `${key}.jpg` || n === `${key}.png` || n === `${key}.webp`,
  );
  if (!hit) return null;
  const full = path.join(dir, hit);
  const st = fs.statSync(full);
  return { file: full, filename: hit, bytes: st.size, mtimeMs: st.mtimeMs };
}

export function getPoster(slot) {
  const key = String(slot || '').toLowerCase();
  if (!isPosterSlot(key)) return null;
  const file = findSlotFile(key);
  const meta = readMeta()[key] || {};
  if (!file) {
    return {
      id: key,
      has_file: false,
      caption: meta.caption || '',
      mime: null,
      updated_at: meta.updated_at || null,
      bytes: 0,
    };
  }
  const ext = path.extname(file.filename).toLowerCase();
  const mime =
    ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return {
    id: key,
    has_file: true,
    caption: meta.caption || '',
    mime,
    updated_at: meta.updated_at || new Date(file.mtimeMs).toISOString(),
    bytes: file.bytes,
    file: file.file,
    mtimeMs: file.mtimeMs,
  };
}

/** Poster for a specific IST calendar day (weekday slot). */
export function getDailyPosterForDay(dayLike) {
  const weekday = String(dayLike?.weekday || todayWeekdayIst()).toLowerCase();
  const byDay = getPoster(weekday);
  if (byDay?.has_file) return byDay;
  const legacy = getPoster('daily');
  if (legacy?.has_file) return { ...legacy, id: weekday, legacy: true };
  return byDay;
}

/** Poster customers get for “daily menu” today (weekday file, else legacy daily). */
export function getTodaysDailyPoster() {
  return getDailyPosterForDay({ weekday: todayWeekdayIst() });
}

/** Uploaded full-catalog posters (all items), in order. */
export function getFullMenuPosters() {
  return FULL_MENU_SLOTS.map((id) => getPoster(id)).filter((p) => p?.has_file);
}

/**
 * Best available poster file for Catalog product image_url (public HTTPS).
 * Prefers full_menu, then specials, then today's daily.
 */
export function getCatalogDefaultPoster() {
  for (const id of FULL_MENU_SLOTS) {
    const p = getPoster(id);
    if (p?.has_file && p.file) return p;
  }
  const specials = getPoster(SPECIALS_SLOT);
  if (specials?.has_file && specials.file) return specials;
  const daily = getTodaysDailyPoster();
  if (daily?.has_file && daily.file) return daily;
  return null;
}

export function listPosters() {
  const today = todayWeekdayIst();
  return POSTER_SLOTS.map((s) => {
    const p = getPoster(s.id);
    return {
      ...s,
      has_file: p.has_file,
      caption: p.caption,
      mime: p.mime,
      updated_at: p.updated_at,
      bytes: p.bytes,
      is_today: s.id === today,
    };
  });
}

export function savePoster(slot, { buffer, mime, caption }) {
  const key = String(slot || '').toLowerCase();
  if (!isPosterSlot(key) || key === 'daily') {
    if (key === 'daily') throw new Error('Pick a weekday (Monday–Sunday) for daily menus');
    throw new Error('Unknown poster slot');
  }
  const ext = extFromMime(mime);
  if (!ext) throw new Error('Use a JPEG, PNG, or WebP image');
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (!buf.length) throw new Error('Empty file');
  if (buf.length > MAX_BYTES) throw new Error('Image must be 5 MB or smaller');

  ensureDir();
  for (const oldExt of ['.jpg', '.png', '.webp']) {
    const old = path.join(postersDir(), `${key}${oldExt}`);
    if (fs.existsSync(old)) fs.unlinkSync(old);
  }
  const dest = path.join(postersDir(), `${key}${ext}`);
  fs.writeFileSync(dest, buf);

  const meta = readMeta();
  meta[key] = {
    caption: String(caption || '').slice(0, 1024),
    mime: mime.toLowerCase() === 'image/jpg' ? 'image/jpeg' : String(mime).toLowerCase(),
    updated_at: new Date().toISOString(),
    bytes: buf.length,
  };
  writeMeta(meta);
  mediaCache.delete(key);
  return getPoster(key);
}

export function deletePoster(slot) {
  const key = String(slot || '').toLowerCase();
  if (!isPosterSlot(key)) throw new Error('Unknown poster slot');
  const file = findSlotFile(key);
  if (file) fs.unlinkSync(file.file);
  const meta = readMeta();
  delete meta[key];
  writeMeta(meta);
  mediaCache.delete(key);
  return getPoster(key);
}

async function mediaIdForPoster(poster) {
  if (!poster?.has_file || !poster.file) return null;
  const cacheKey = poster.id;
  const cached = mediaCache.get(cacheKey);
  if (cached && cached.mtimeMs === poster.mtimeMs && cached.mediaId) {
    return { mediaId: cached.mediaId, caption: poster.caption };
  }
  const mediaId = await uploadLocalImage(poster.file);
  if (mediaId) {
    mediaCache.set(cacheKey, {
      mediaId,
      mtimeMs: poster.mtimeMs,
      file: poster.file,
    });
  }
  return { mediaId, caption: poster.caption };
}

/** Upload a one-off image buffer and send it (admin attach). */
export async function sendImageBuffer(phone, { buffer, mime, caption }) {
  const normalized = String(phone || '').replace(/\D/g, '');
  if (normalized.length < 10) throw new Error('Invalid phone');
  const ext = extFromMime(mime);
  if (!ext) throw new Error('Use a JPEG, PNG, or WebP image');
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (!buf.length) throw new Error('Empty file');
  if (buf.length > MAX_BYTES) throw new Error('Image must be 5 MB or smaller');

  ensureDir();
  const tmp = path.join(postersDir(), `_tmp_admin_${Date.now()}${ext}`);
  fs.writeFileSync(tmp, buf);
  try {
    const mediaId = await uploadLocalImage(tmp);
    if (!mediaId) {
      console.log(`[dry-run] admin image to ${normalized}`);
      return { ok: true, dryRun: true };
    }
    await sendImage(normalized, {
      mediaId,
      caption: caption ? String(caption).slice(0, 1024) : undefined,
    });
    return { ok: true };
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

async function sendOnePoster(phone, poster, result) {
  if (!poster?.has_file) {
    result.skipped.push(poster?.id || 'missing');
    return;
  }
  const label = poster.id;
  try {
    const ready = await mediaIdForPoster(poster);
    if (!ready?.mediaId) {
      result.skipped.push(label);
      console.log(`[dry-run] poster ${label}${ready?.caption ? ` · ${ready.caption}` : ''}`);
      return;
    }
    await sendImage(phone, {
      mediaId: ready.mediaId,
      caption: ready.caption || undefined,
    });
    result.sent += 1;
  } catch (err) {
    result.errors.push(`${label}: ${err.message || err}`);
    console.error('Poster send failed', label, err.message || err);
  }
}

/**
 * Hi / welcome posters — kinds controlled by Admin → Posters auto settings.
 * @param {{ serviceDay?: object, auto?: object }} opts
 */
export async function sendWelcomePosters(phone, { serviceDay, auto } = {}) {
  const a = auto && typeof auto === 'object' ? auto : null;
  if (a && a.hi_enabled === false) {
    return { sent: 0, skipped: ['hi_disabled'], errors: [] };
  }
  const includeDaily = a ? a.hi_daily !== false : true;
  const includeSpecials = a ? a.hi_specials === true : false;
  if (!includeDaily && !includeSpecials) {
    return { sent: 0, skipped: ['hi_kinds_off'], errors: [] };
  }
  return sendMenuPosters(phone, {
    intro: false,
    includeFullMenu: false,
    includeDaily,
    includeSpecials,
    dailyDay: serviceDay || null,
  });
}

/**
 * View menu / Menu posters — kinds from Admin auto settings.
 * @param {{ auto?: object }} opts
 */
export async function sendViewMenuPosters(phone, { auto } = {}) {
  const a = auto && typeof auto === 'object' ? auto : null;
  if (a && a.view_menu_enabled === false) {
    return { sent: 0, skipped: ['view_menu_disabled'], errors: [] };
  }
  const includeFullMenu = a ? a.view_menu_full !== false : true;
  const includeDaily = a ? a.view_menu_daily === true : false;
  const includeSpecials = a ? a.view_menu_specials === true : false;
  if (!includeFullMenu && !includeDaily && !includeSpecials) {
    return { sent: 0, skipped: ['view_menu_kinds_off'], errors: [] };
  }
  return sendMenuPosters(phone, {
    intro: false,
    includeFullMenu,
    includeDaily,
    includeSpecials,
  });
}

/**
 * Send menu poster images to one WhatsApp number (admin or welcome).
 * opts.dailyDay — optional day object with .weekday (for next-slot Hi poster).
 */
export async function sendMenuPosters(phone, opts = {}) {
  const includeFullMenu = opts.includeFullMenu !== false;
  const includeDaily = opts.includeDaily !== false;
  const includeSpecials = opts.includeSpecials !== false;

  const toSend = [];
  if (includeFullMenu) toSend.push(...getFullMenuPosters());
  if (includeDaily) {
    const daily = opts.dailyDay
      ? getDailyPosterForDay(opts.dailyDay)
      : getTodaysDailyPoster();
    if (daily?.has_file) toSend.push(daily);
  }
  if (includeSpecials) {
    const specials = getPoster(SPECIALS_SLOT);
    if (specials?.has_file) toSend.push(specials);
  }

  const result = { sent: 0, skipped: [], errors: [] };
  const normalized = String(phone || '').replace(/\D/g, '');
  if (normalized.length < 10) {
    result.errors.push('invalid phone');
    return result;
  }

  if (opts.intro !== false) {
    const intro =
      typeof opts.intro === 'string' && opts.intro.trim()
        ? opts.intro.trim().slice(0, 1024)
        : `📋 Menu — Amma Chethi Ruchulu\n` +
          `To order: tap *Order* (or send Hi).`;
    try {
      await sendText(normalized, intro);
    } catch (err) {
      result.errors.push(`intro: ${err.message || err}`);
    }
  }

  if (!toSend.length) {
    result.skipped.push('no_posters');
    return result;
  }

  for (const poster of toSend) {
    await sendOnePoster(normalized, poster, result);
  }
  return result;
}
