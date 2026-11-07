/**
 * Admin toggles: which poster kinds auto-send on customer Hi / View menu.
 * Fresh has two kinds: daily offers + complete price list.
 */

export const META_KEY_POSTER_AUTO = 'poster_auto_v1';

/** Defaults for ACR-Fresh posters. */
export function defaultPosterAutoSettings() {
  return {
    hi_enabled: true,
    /** Daily offers image on Hi */
    hi_daily: true,
    /** If Hi sent 0 images, fall back to full price-list pages */
    hi_full_menu_fallback: true,
    /** Unused on Fresh (kept for schema compat — always false) */
    hi_specials: false,
    view_menu_enabled: true,
    view_menu_full: true,
    view_menu_daily: false,
    view_menu_specials: false,
  };
}

function parseBool(raw, defaultVal) {
  if (raw === false || raw === 0 || raw === '0' || raw === 'false') return false;
  if (raw === true || raw === 1 || raw === '1' || raw === 'true') return true;
  return defaultVal;
}

export function normalizePosterAutoSettings(raw) {
  const base = defaultPosterAutoSettings();
  if (!raw || typeof raw !== 'object') return { ...base };
  return {
    hi_enabled: parseBool(raw.hi_enabled, base.hi_enabled),
    hi_daily: parseBool(raw.hi_daily, base.hi_daily),
    hi_full_menu_fallback: parseBool(raw.hi_full_menu_fallback, base.hi_full_menu_fallback),
    hi_specials: false,
    view_menu_enabled: parseBool(raw.view_menu_enabled, base.view_menu_enabled),
    view_menu_full: parseBool(raw.view_menu_full, base.view_menu_full),
    view_menu_daily: parseBool(raw.view_menu_daily, base.view_menu_daily),
    view_menu_specials: false,
  };
}

/**
 * @param {{ getMeta: (k: string) => Promise<string|null> }} db
 */
export async function loadPosterAutoSettings(db) {
  const raw = await db.getMeta(META_KEY_POSTER_AUTO);
  if (!raw) return defaultPosterAutoSettings();
  try {
    return normalizePosterAutoSettings(JSON.parse(raw));
  } catch {
    return defaultPosterAutoSettings();
  }
}

/**
 * @param {{ setMeta: (k: string, v: string) => Promise<void> }} db
 */
export async function savePosterAutoSettings(db, raw) {
  const next = normalizePosterAutoSettings(raw);
  await db.setMeta(META_KEY_POSTER_AUTO, JSON.stringify(next));
  return next;
}
