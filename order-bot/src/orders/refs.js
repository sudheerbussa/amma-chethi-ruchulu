/**
 * Order refs: L|D + YYMMDD (service day IST) + seq for that meal that day.
 * Example: L260810-001, D260810-012
 */

const REF_RE = /^([LD])(\d{6})-(\d+)$/i;

export function mealPrefix(meal) {
  return meal === 'dinner' ? 'D' : 'L';
}

/** YYYY-MM-DD → YYMMDD */
export function serviceStamp(isoDate) {
  return String(isoDate || '').replace(/-/g, '').slice(2, 8);
}

export function formatOrderRef(meal, serviceIso, seq) {
  const n = Math.max(1, Math.floor(Number(seq) || 1));
  return `${mealPrefix(meal)}${serviceStamp(serviceIso)}-${String(n).padStart(3, '0')}`;
}

/** Highest trailing sequence for meal+service day among order_ref strings (handles legacy non-matching as 0). */
export function maxSeqFromRefs(refs, meal, serviceIso) {
  const stamp = serviceStamp(serviceIso);
  const want = mealPrefix(meal);
  let max = 0;
  for (const raw of refs || []) {
    const m = String(raw || '').toUpperCase().match(REF_RE);
    if (!m) continue;
    if (m[1] !== want) continue;
    if (m[2] !== stamp) continue;
    const n = Number(m[3]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}
