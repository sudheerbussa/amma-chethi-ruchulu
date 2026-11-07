import { getDb } from '../db.js';
import { executeCampaign } from './worker.js';
import { createHash } from 'node:crypto';
import { config } from '../config.js';
import { sendTemplate, sendText } from '../whatsapp.js';
import { normalizePhone, marketingCommand, selectAudience, inspectTemplate, templateParams, errorPolicy } from './core.js';
import * as db from './store.js';
const sleep = ms => new Promise(resolve=>setTimeout(resolve, ms));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function campaignId(id) { if (!UUID.test(String(id || ''))) throw new Error('Valid UUID campaign id required'); return id; }
export async function approvedTemplates() {
  if (!config.whatsappWabaId || !config.accessToken) throw new Error('Set WHATSAPP_WABA_ID and WhatsApp token');
  const templates = [];
  let after = '';
  for (let page=0; page<30; page++) {
    const query = new URLSearchParams({ fields:'id,name,language,status,category,components', limit:'100', ...(after ? {after} : {}) });
    const res = await fetch(`https://graph.facebook.com/${config.apiVersion}/${encodeURIComponent(config.whatsappWabaId)}/message_templates?${query}`, {
      headers: { Authorization: `Bearer ${config.accessToken}` }, signal: AbortSignal.timeout(15000) });
    const data = await res.json();
    if (!res.ok) throw new Error('Meta template lookup failed (check token permissions/WABA)');
    templates.push(...(data.data || []).filter(t=>t.status === 'APPROVED' && ['MARKETING','UTILITY'].includes(t.category)).map(inspectTemplate));
    after = data.paging?.next ? data.paging?.cursors?.after : '';
    if (!after) return templates;
  }
  throw new Error('Too many template pages; narrow WABA configuration');
}
export async function audience(options = {}) {
  const sources = await db.readSources();
  const recipients = selectAudience(sources.fresh, sources.food, options, sources.excluded, await db.suppressedPhones());
  return { recipients, count: recipients.length, foodConfigured: sources.foodConfigured };
}
export async function handleMarketingPreference(msg, session) {
  const command = marketingCommand(msg, session);
  if (!command || !normalizePhone(msg.from)) return false;
  if (msg.kind !== 'button') {
    // Legacy checkout resets the session to idle while payment is pending. Do not hijack STOP there.
    const store = getDb();
    if (await store.findLatestPendingOrder(msg.from)) return false;
    const latest = await store.findLatestOrder(msg.from);
    if (latest && ['paid', 'preparing', 'out_for_delivery'].includes(latest.status)) return false;
  }
  await db.setSuppression(msg.from, command === 'stop');
  await sendText(msg.from, command === 'stop'
    ? 'ACR Fresh offers నిలిపివేశాం. Offers stopped. మళ్లీ కావాలంటే idle chat లో START అని reply చేయండి. Orders can still be placed.'
    : 'ACR Fresh offers మళ్లీ ప్రారంభించాం. Offers enabled. ఆపడానికి STOP అని reply చేయండి.');
  return true;
}
export async function prepareCampaign(body) {
  const id = campaignId(body.id);
  if (body.confirmed !== true) throw new Error('Explicit confirmation is required');
  const t = (await approvedTemplates()).find(t=>t.name === body.name && t.language === body.language);
  if (!t?.supported) throw new Error(t?.reason || 'Template is not currently approved');
  const params = {};
  for (let i=2; i<=t.paramCount; i++) params[i] = String(body.params?.[i] || '').trim();
  templateParams(t, {name:''}, params);
  const spec = { name: t.name, language: t.language, params, mode: body.mode === 'test' ? 'test' : 'audience' };
  let recipients;
  if (spec.mode === 'test') {
    const phone = normalizePhone(body.phone);
    if (!phone) throw new Error('Enter an Indian mobile number with 91 country code');
    // A test may include an admin/rider, but never silently override suppression.
    if (await db.isSuppressed(phone)) throw new Error('Test phone opted out; reply START in idle chat to opt back in');
    spec.phone = phone;
    recipients = [{ phone, name:'Test Customer' }];
  } else {
    const opts = body.audience || {};
    spec.audience = { filter: opts.filter || 'all', days: Number(opts.days || 7), excludeNeverOrdered: opts.excludeNeverOrdered !== false };
    recipients = (await audience(spec.audience)).recipients;
  }
  const hash = createHash('sha256').update(JSON.stringify(spec)).digest('hex');
  const existing = await db.getCampaign(id);
  if (existing && existing.request_hash !== hash) throw new Error('Campaign ID already belongs to a different request');
  if (!existing && spec.mode === 'audience' && (!Number.isInteger(body.expectedCount) || body.expectedCount !== recipients.length)) throw new Error('Audience count changed; preview and confirm again');
  if (!existing && !recipients.length) throw new Error('No eligible recipients');
  await db.createCampaign(id, hash, spec, recipients);
  // Background execution only starts from an explicit admin action, never from startup/GET.
  startCampaign(id);
  return db.getCampaign(id);
}
const running = new Set();
export function startCampaign(id) {
  if (running.has(id)) return;
  running.add(id);
  runCampaign(id).catch(async ()=>{ await db.campaignState(id,'halted','Campaign worker failed; review results before resume').catch(()=>{}); })
    .finally(()=>running.delete(id));
}
export async function runCampaign(id) {
  return executeCampaign(id, { db, approvedTemplates, sendTemplate, sleep });
}
export async function handleMarketingStatuses(payload) {
  for (const entry of payload?.entry || []) for (const change of entry.changes || []) {
    for (const s of change.value?.statuses || []) {
      const rows = await db.updateWebhookStatus(s);
      const code = Number(s.errors?.[0]?.code);
      if (s.status === 'failed' && errorPolicy({code,httpStatus:400}) === 'halt') for (const r of rows || []) {
        await db.campaignState(r.campaign_id,'halted',`Delivery webhook Meta ${code}; review template/account quality before resuming`);
      }
    }
  }
}
