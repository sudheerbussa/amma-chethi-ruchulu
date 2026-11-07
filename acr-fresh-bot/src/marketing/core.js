/** Pure helpers: deliberately no config, database, or network side effects. */
export function normalizePhone(raw) {
  let p = String(raw || '').replace(/\D/g, '');
  if (p.startsWith('00')) p = p.slice(2);
  if (p.length === 11 && p.startsWith('0')) p = p.slice(1);
  if (/^[6-9]\d{9}$/.test(p)) p = '91' + p;
  return /^91[6-9]\d{9}$/.test(p) ? p : null;
}
export function marketingCommand(msg, session = {}) {
  const text = String(msg.text || '').trim().toLowerCase();
  const title = String(msg.title || '').trim().toLowerCase();
  if (msg.kind === 'button' && [text, title].some(x => ['stop offers', 'offers వద్దు', 'marketing_opt_out'].includes(x))) return 'stop';
  // Preserve every non-idle state, cart and pending payment: STOP still cancels orders there.
  const active = !['', 'idle', 'await_help_topic', 'await_help_detail'].includes(String(session.state || '')) || (session.cart || []).length > 0 || Boolean(session.pending_order_ref);
  if ((msg.kind === 'text' || !msg.kind) && !active && ['stop', 'start'].includes(text)) return text;
  return null;
}
export function selectAudience(fresh, food, { filter = 'all', days = 7, excludeNeverOrdered = true } = {}, excluded = [], suppressed = [], now = Date.now()) {
  if (!['all', 'ordered-ever', 'not-recent', 'fresh-only', 'food-only'].includes(filter)) throw new Error('Invalid audience filter');
  days = Number(days);
  if (!Number.isInteger(days) || days < 1 || days > 3650) throw new Error('Days must be 1–3650');
  const skip = new Set([...excluded, ...suppressed].map(normalizePhone).filter(Boolean));
  const merged = new Map();
  for (const [source, rows] of [['fresh', fresh], ['food', food]]) for (const c of rows) {
    const phone = normalizePhone(c.phone);
    // Source is customers, restricted to actual inbound interaction or an order.
    if (!phone || skip.has(phone) || !(c.interacted || Number(c.order_count) > 0)) continue;
    const prev = merged.get(phone) || { phone, name: '', sources: [], order_count: 0, last_order_at: null };
    if (!prev.name && String(c.name || '').trim()) prev.name = String(c.name).trim().slice(0, 80);
    if (!prev.sources.includes(source)) prev.sources.push(source);
    prev.order_count += Number(c.order_count) || 0;
    const time = Date.parse(c.last_order_at);
    if (Number.isFinite(time) && (!prev.last_order_at || time > Date.parse(prev.last_order_at))) prev.last_order_at = new Date(time).toISOString();
    merged.set(phone, prev);
  }
  return [...merged.values()].filter(c => {
    if ((excludeNeverOrdered !== false || filter === 'ordered-ever') && !c.order_count) return false;
    if (filter === 'fresh-only' && !c.sources.includes('fresh')) return false;
    if (filter === 'food-only' && !c.sources.includes('food')) return false;
    if (filter === 'not-recent' && c.last_order_at && Date.parse(c.last_order_at) >= now - days * 86400000) return false;
    return true;
  }).sort((a, b) => a.phone.localeCompare(b.phone));
}
export function inspectTemplate(t) {
  let reason = '';
  const body = (t.components || []).find(c => c.type === 'BODY')?.text || '';
  const vars = [...body.matchAll(/{{([^}]+)}}/g)].map(m => m[1]);
  const nums = [...new Set(vars)].map(Number).sort((a,b) => a-b);
  if (vars.some(v => !/^\d+$/.test(v)) || nums.some((n,i) => n !== i+1)) reason = 'Only consecutive numeric body parameters are supported';
  const optOutIndexes = [];
  for (const c of t.components || []) {
    if (c.type === 'HEADER' && (c.format !== 'TEXT' || /{{/.test(c.text || ''))) reason = 'Media/dynamic headers are not supported';
    if (!['HEADER','BODY','FOOTER','BUTTONS'].includes(c.type)) reason = 'Unsupported template component';
    if (c.type === 'BUTTONS') for (const [i,b] of (c.buttons || []).entries()) {
      if (b.type === 'QUICK_REPLY' && ['stop offers','offers వద్దు'].includes(String(b.text).toLowerCase())) optOutIndexes.push(i);
      else if (b.type !== 'URL' || /{{/.test(b.url || '')) reason = 'Only static URL and Stop offers buttons are supported';
    }
  }
  // Only offer templates that can honor the promised opt-out.
  if (!optOutIndexes.length) reason = reason || 'A Stop offers quick-reply button is required';
  return { ...t, body, paramCount: nums.length, optOutIndexes, supported: !reason, reason };
}
export function templateParams(t, recipient, params = {}) {
  const out = [];
  for (let i = 1; i <= t.paramCount; i++) {
    const value = i === 1 ? (recipient.name || (t.language.startsWith('te') ? 'కస్టమర్ గారూ' : 'Customer')) : String(params[i] || '').trim();
    if (!value || value.length > 1024 || /[\r\n\t]/.test(value)) throw new Error(`Parameter ${i} must be nonempty, single-line, at most 1024 characters`);
    out.push(value);
  }
  return out;
}
export function errorPolicy(err) {
  if (err.httpStatus === 429 || [4, 17, 130429, 131056].includes(err.code)) return 'retry';
  if ([131049,131026,130472,131047,131050].includes(err.code)) return 'fail';
  if ([190, 10, 200, 131005, 131031, 131042, 131048, 132000, 132001, 132005, 132007, 132012, 132015, 132016].includes(err.code) || [400,401,403,404].includes(err.httpStatus) && ![131026,131030].includes(err.code)) return 'halt';
  // A transport failure or server error could have accepted the send: never retry blindly.
  if (!err.httpStatus || err.httpStatus >= 500) return 'unknown';
  return 'fail';
}
export async function sendWithBackoff(send, sleep, attempts = 4) {
  for (let i = 0; ; i++) {
    try { return await send(); } catch (e) {
      if (errorPolicy(e) !== 'retry' || i >= attempts - 1) throw e;
      await sleep(Math.min(60000, 2000 * 2 ** i));
    }
  }
}
export function nextDeliveryStatus(current, incoming) {
  const rank = { sending: 0, unknown: 0, accepted: 1, sent: 2, delivered: 3, read: 4 };
  if (!['sent','delivered','read','failed'].includes(incoming)) return current;
  if (current === 'failed' && !['delivered','read'].includes(incoming)) return current;
  if (incoming === 'failed') return ['delivered','read'].includes(current) ? current : 'failed';
  return (rank[incoming] || 0) > (rank[current] ?? -1) ? incoming : current;
}

/** Normalize delivery webhooks only; never infer delivery from API acceptance. */
export function parseStatus(s) {
  if (!s || typeof s.id !== 'string' || !s.id || !['sent','delivered','read','failed'].includes(s.status)) return null;
  const errors = Array.isArray(s.errors) ? s.errors : [];
  const e = errors[0] || {};
  const seconds = Number(s.timestamp);
  const validTime = s.timestamp != null && Number.isFinite(seconds) && seconds > 0 && seconds < 8640000000000;
  const text = value => value == null ? null : String(value).slice(0, 4000);
  return { wamid:s.id, recipient:text(s.recipient_id), status:s.status,
    ts:validTime ? new Date(seconds * 1000).toISOString() : new Date().toISOString(),
    error_code:e.code != null && Number.isInteger(Number(e.code)) ? String(e.code) : null,
    error_title:text(e.title), error_detail:text(e.error_data?.details || e.message || e.title), raw:s };
}
export function extractStatuses(payload) {
  const out=[];
  for (const entry of Array.isArray(payload?.entry) ? payload.entry : [])
    for (const change of Array.isArray(entry?.changes) ? entry.changes : [])
      for (const status of Array.isArray(change?.value?.statuses) ? change.value.statuses : []) {
        const parsed=parseStatus(status); if(parsed) out.push(parsed);
      }
  return out;
}
export function deliveryReason(code, fallback = '') {
  return ({
    '131049':'Meta per-user marketing limit: Meta restricted marketing delivery to this recipient. Do not retry immediately.',
    '131026':'Undeliverable: the number may not be on WhatsApp, or another recipient/device restriction prevented delivery.',
    '130472':'Meta experiment: marketing delivery to this recipient is currently restricted.',
    '131047':'Re-engagement required: use an approved template outside the 24-hour service window.',
    '131050':'The user stopped marketing messages. Do not send more marketing unless they opt back in.',
    '131042':'Payment issue: check the WhatsApp Business billing/payment method.'
  })[String(code)] || fallback || 'Delivery failed; Meta provided no further detail.';
}
export function testRecipients(raw, admins) {
  const inputs = Array.isArray(raw) ? raw : String(raw || '').split(/[\s,;]+/).filter(Boolean);
  if (!inputs.length || inputs.length > 10) throw new Error('Enter 1–10 configured admin numbers');
  const phones=inputs.map(normalizePhone), allowed=new Set(admins.map(normalizePhone).filter(Boolean));
  if(phones.some(p=>!p || !allowed.has(p))) throw new Error('Test sends are restricted to configured admin numbers');
  return [...new Set(phones)].sort();
}
