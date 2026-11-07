import { normalizePhone, templateParams, errorPolicy, sendWithBackoff } from './core.js';
export async function executeCampaign(id, { db, approvedTemplates, sendTemplate, sleep }) {
  await db.withCampaignLock(id, async ()=>{
    let campaign = await db.getCampaign(id);
    if (!campaign || campaign.status === 'completed') return;
    // Persist-before-send + never resend an ambiguous/in-flight row protects restart idempotency.
    for (const r of campaign.recipients.filter(r=>r.status === 'sending')) await db.recipientState(id,r.phone,'unknown',{error:'Interrupted send; inspect WhatsApp delivery log. Never retried automatically.'});
    const t = (await approvedTemplates()).find(t=>t.name === campaign.spec.name && t.language === campaign.spec.language);
    if (!t?.supported) { await db.campaignState(id,'halted','Template is no longer approved/supported'); return; }
    const sources = await db.readSources();
    const excluded = new Set(sources.excluded.map(normalizePhone).filter(Boolean));
    await db.campaignState(id,'running');
    for (const r of campaign.recipients.filter(r=>r.status === 'queued')) {
      const current = await db.getCampaign(id);
      if (current.status !== 'running') return;
      if (await db.isSuppressed(r.phone) || campaign.spec.mode !== 'test' && excluded.has(r.phone)) {
        await db.recipientState(id,r.phone,'skipped',{error:'Opted out or staff number'}); continue;
      }
      if (!await db.claimRecipient(id,r.phone)) continue;
      try {
        const result = await sendWithBackoff(()=>sendTemplate(r.phone,t.name,t.language,templateParams(t,r,campaign.spec.params),{optOutIndexes:t.optOutIndexes}),sleep);
        const wamid = result.messages?.[0]?.id;
        if (!wamid) throw new Error('No WhatsApp message id returned');
        await db.recipientState(id,r.phone,'accepted',{wamid});
      } catch (e) {
        const policy = errorPolicy(e);
        const error = `Meta ${e.code || e.httpStatus || 'transport'}: ${String(e.message || 'Send failed').replace(/Bearer\s+\S+/g,'[redacted]').slice(0,240)}`;
        await db.recipientState(id,r.phone,policy === 'unknown' ? 'unknown' : 'failed',{error,errorCode:e.code});
        if (policy !== 'fail') { await db.campaignState(id,'halted',error); return; }
      }
      await sleep(1100);
    }
    campaign = await db.getCampaign(id);
    if (campaign.status === 'running') await db.campaignState(id,'completed');
  });
}
