/** Localhost-only deployment smoke. Creates/removes only its own synthetic audit rows. Never sends WhatsApp. */
import dotenv from 'dotenv';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
dotenv.config();
assert.ok(process.env.ADMIN_TOKEN?.trim(),'ADMIN_TOKEN must be set');
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
const id=randomUUID(),prefix='wamid.STATUS_SMOKE_'+id;
const base='http://127.0.0.1:'+Number(process.env.PORT || 3001);
const headers={Authorization:'Bearer '+process.env.ADMIN_TOKEN};
const ts=String(Math.floor(Date.now()/1000));
try {
  await db.query("INSERT INTO marketing_campaigns(id,request_hash,spec,status) VALUES($1,'synthetic-status-smoke',$2::jsonb,'completed')",[id,JSON.stringify({mode:'test',name:'synthetic-no-send',language:'en'})]);
  for(const [suffix,phone] of [['read','910000000000'],['failed','910000000001']])await db.query("INSERT INTO marketing_recipients(campaign_id,phone,status,wamid) VALUES($1,$2,'accepted',$3)",[id,phone,prefix+'_'+suffix]);
  const event=(suffix,status)=>({id:prefix+'_'+suffix,recipient_id:suffix==='read'?'910000000000':'910000000001',timestamp:ts,status,...(status==='failed'?{errors:[{code:131049,title:'Synthetic failure',message:'Smoke only',error_data:{details:'Synthetic delivery tracking check; no WhatsApp send'}}]}:{}),pricing:{billable:false},conversation:{id:'synthetic-only'}});
  const payload={object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{statuses:['sent','delivered','read','sent','failed'].map(s=>event('read',s))}}]},{changes:[{field:'messages',value:{statuses:[event('failed','failed'),event('failed','sent')]}}]}]};
  const response=await fetch(base+'/webhook',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});assert.equal(response.status,200);
  let rows=[];
  for(let i=0;i<50;i++){
    rows=(await db.query('SELECT phone,status,error_code,read_at,failed_at FROM marketing_recipients WHERE campaign_id=$1 ORDER BY phone',[id])).rows;
    const count=(await db.query('SELECT count(*)::int n FROM whatsapp_message_statuses WHERE wamid IN ($1,$2)',[prefix+'_read',prefix+'_failed'])).rows[0].n;
    if(count===6&&rows[0]?.status==='read'&&rows[1]?.status==='failed')break;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.equal(rows[0].status,'read');assert.ok(rows[0].read_at);assert.equal(rows[1].status,'failed');assert.equal(rows[1].error_code,'131049');assert.ok(rows[1].failed_at);
  const c=await fetch(base+'/admin/api/marketing/campaigns/'+id,{headers});assert.equal(c.status,200);const campaign=await c.json();assert.equal(campaign.counts.read,1);assert.equal(campaign.counts.failed,1);assert.match(campaign.recipients[1].failure_reason,/per-user marketing limit/);
  const audit=(await db.query('SELECT raw FROM whatsapp_message_statuses WHERE wamid=$1 LIMIT 1',[prefix+'_failed'])).rows[0].raw;assert.equal(audit.pricing.billable,false);assert.equal(audit.conversation.id,'synthetic-only');
  assert.equal((await fetch(base+'/admin/api/marketing/campaigns')).status,401);
  assert.equal((await fetch(base+'/admin/api/marketing/test-send',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({id:randomUUID(),confirmed:false})})).status,400);
  const health=await (await fetch(base+'/health')).json();assert.equal(health.ok,true);assert.equal(health.driver,'pg');
  console.log('PASS: health, authenticated admin API, test-send guard, 200 status-only webhook, persistent audit, read/failed ordering, error mapping. No WhatsApp sent.');
} finally {
  await db.query('DELETE FROM whatsapp_message_statuses WHERE wamid IN ($1,$2)',[prefix+'_read',prefix+'_failed']);
  await db.query('DELETE FROM marketing_recipients WHERE campaign_id=$1',[id]);
  await db.query('DELETE FROM marketing_campaigns WHERE id=$1',[id]);
  await db.end();console.log('Synthetic campaign, recipients and status events removed.');
}
