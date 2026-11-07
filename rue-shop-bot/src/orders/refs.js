/** Order refs: RUE + YYMMDD + seq. Example: RUE261021-001 */

const REF_RE = /^RUE(\d{6})-(\d+)$/i;

export function serviceStampToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value || '';
  const m = parts.find((p) => p.type === 'month')?.value || '';
  const d = parts.find((p) => p.type === 'day')?.value || '';
  return `${y.slice(2)}${m}${d}`;
}

export function formatOrderRef(stamp, seq) {
  const n = Math.max(1, Math.floor(Number(seq) || 1));
  return `RUE${stamp}-${String(n).padStart(3, '0')}`;
}

export function maxSeqFromRefs(refs, stamp) {
  let max = 0;
  for (const raw of refs || []) {
    const m = String(raw || '').toUpperCase().match(REF_RE);
    if (!m) continue;
    if (m[1] !== stamp) continue;
    const n = Number(m[2]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}
