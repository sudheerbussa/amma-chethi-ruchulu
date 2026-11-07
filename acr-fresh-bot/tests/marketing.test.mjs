import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, marketingCommand, selectAudience, inspectTemplate, templateParams, errorPolicy, sendWithBackoff, nextDeliveryStatus } from '../src/marketing/core.js';
import { executeCampaign } from '../src/marketing/worker.js';
const phone='919876543210', other='919876543211';
const template=inspectTemplate({id:'t',name:'acr_fresh_offer',language:'en',category:'MARKETING',status:'APPROVED',components:[{type:'BODY',text:'Hi {{1}} — {{2}}, until {{3}}'},{type:'BUTTONS',buttons:[{type:'URL',text:'Order now',url:'https://example.com/fresh'},{type:'QUICK_REPLY',text:'Stop offers'}]}]});
test('Indian phone normalization, duplicates and invalid numbers',()=>{
  for(const x of ['+91 98765 43210','9876543210','09876543210','00919876543210',phone])assert.equal(normalizePhone(x),phone);
  for(const x of ['123','+1 212 555 1212','910000000000',''])assert.equal(normalizePhone(x),null);
});
test('idle STOP/START; active order cancellation is untouched; buttons always suppress',()=>{
  assert.equal(marketingCommand({kind:'text',text:' StOp '},{state:'idle'}),'stop');
  assert.equal(marketingCommand({kind:'text',text:'START'},{}),'start');
  assert.equal(marketingCommand({kind:'text',text:'STOP'},{state:'await_help_topic'}),'stop');
  for(const state of ['await_address','await_delivery_slot','await_payment','await_name','await_qty'])assert.equal(marketingCommand({kind:'text',text:'STOP'},{state}),null);
  assert.equal(marketingCommand({kind:'text',text:'STOP'},{state:'idle',cart:[{}]}),null);
  assert.equal(marketingCommand({kind:'text',text:'STOP'},{state:'idle',pending_order_ref:'x'}),null);
  for(const text of ['Stop offers','Offers వద్దు','marketing_opt_out'])assert.equal(marketingCommand({kind:'button',text},{state:'await_qty'}),'stop');
  assert.equal(marketingCommand({kind:'text',text:'stop offers'},{}),null);
  assert.equal(marketingCommand({kind:'text',text:'STOP please'},{}),null);
});
const fresh=[{phone,name:'Fresh name',order_count:1,last_order_at:'2026-11-06T00:00:00Z'},{phone:other,interacted:true},{phone:'919876543212'}];
const food=[{phone:'9876543210',name:'Food name',order_count:2,last_order_at:'2026-01-01T00:00:00Z'},{phone:'919876543213',order_count:1,last_order_at:'2026-01-01T00:00:00Z'}];
const now=Date.parse('2026-11-07T00:00:00Z');
test('audiences union, source membership, default ordered, recency across BOTH brands',()=>{
  let result=selectAudience(fresh,food,{},[],[],now);assert.equal(result.length,2);assert.equal(result[0].order_count,3);assert.deepEqual(result[0].sources,['fresh','food']);assert.equal(result[0].name,'Fresh name');
  assert.equal(selectAudience(fresh,food,{filter:'all',excludeNeverOrdered:false},[],[],now).length,3);
  assert.equal(selectAudience(fresh,food,{filter:'fresh-only',excludeNeverOrdered:false},[],[],now).length,2);
  assert.equal(selectAudience(fresh,food,{filter:'food-only'},[],[],now).length,2);
  assert.deepEqual(selectAudience(fresh,food,{filter:'not-recent'},[],[],now).map(r=>r.phone),['919876543213']);
  assert.equal(selectAudience(fresh,food,{filter:'ordered-ever',excludeNeverOrdered:false},[],[],now).length,2);
  assert.equal(selectAudience(fresh,food,{},[phone],['9876543213'],now).length,0);
  assert.throws(()=>selectAudience([],[],{filter:'bad'}));assert.throws(()=>selectAudience([],[],{days:0}));
});
test('numeric template validation and name fallbacks',()=>{
  assert.equal(template.supported,true);assert.equal(template.paramCount,3);assert.deepEqual(template.optOutIndexes,[1]);
  assert.deepEqual(templateParams(template,{name:''},{2:'20% off',3:'8 Nov IST'}),['Customer','20% off','8 Nov IST']);
  assert.equal(templateParams({...template,language:'te'},{name:''},{2:'offer',3:'today'})[0],'కస్టమర్ గారూ');
  assert.throws(()=>templateParams(template,{name:''},{2:'offer'}));
  assert.throws(()=>templateParams(template,{name:''},{2:'a\nb',3:'today'}));
  assert.equal(inspectTemplate({...template,components:[{type:'BODY',text:'{{name}}'}]}).supported,false);
  assert.equal(inspectTemplate({...template,components:[{type:'HEADER',format:'IMAGE'}]}).supported,false);
  assert.equal(inspectTemplate({...template,components:[{type:'BODY',text:'{{2}}'}]}).supported,false);
});
test('only explicit rate limits retry with backoff; auth/template/quality halt; network ambiguous',async()=>{
  for(const code of [190,132001,132015,131048])assert.equal(errorPolicy({code,httpStatus:400}),'halt');
  for(const code of [131049,131026,130472,131047,131050])assert.equal(errorPolicy({code,httpStatus:400}),'fail');assert.equal(errorPolicy(new Error('timeout')),'unknown');assert.equal(errorPolicy({httpStatus:500}),'unknown');
  let tries=0;const delays=[];
  const r=await sendWithBackoff(async()=>{if(++tries<4)throw Object.assign(new Error('limited'),{httpStatus:429});return 'ok';},async ms=>delays.push(ms));
  assert.equal(r,'ok');assert.equal(tries,4);assert.deepEqual(delays,[2000,4000,8000]);
  tries=0;await assert.rejects(()=>sendWithBackoff(async()=>{tries++;throw new Error('timeout');},async()=>{}));assert.equal(tries,1);
});
test('delivery webhook statuses cannot regress read/delivered',()=>{
  assert.equal(nextDeliveryStatus('accepted','delivered'),'delivered');assert.equal(nextDeliveryStatus('read','sent'),'read');assert.equal(nextDeliveryStatus('delivered','failed'),'delivered');assert.equal(nextDeliveryStatus('accepted','failed'),'failed');assert.equal(nextDeliveryStatus('unknown','read'),'read');
});
function harness(status='queued') {
  const state={status,spec:{name:template.name,language:'en',params:{2:'offer',3:'today'},mode:'audience'},recipients:[{phone,name:'Test',status:'queued'},{phone:other,name:'',status:'queued'}]};
  const sent=[],delays=[],suppressed=new Set();let lock=false;
  const db={
    async withCampaignLock(id,fn){if(lock)return false;lock=true;try{await fn();}finally{lock=false;}},
    async getCampaign(){return structuredClone(state);},
    async readSources(){return {excluded:[]};},async isSuppressed(p){return suppressed.has(p);},
    async claimRecipient(id,p){const r=state.recipients.find(r=>r.phone===p);if(r.status!=='queued')return false;r.status='sending';return true;},
    async campaignState(id,status,error){state.status=status;state.last_error=error;},
    async recipientState(id,p,status,details={}){Object.assign(state.recipients.find(r=>r.phone===p),{status,...details});}
  };
  return {state,db,sent,delays,suppressed, deps:{db,approvedTemplates:async()=>[template],sendTemplate:async(p)=>{sent.push(p);return {messages:[{id:'wamid.'+p}]};},sleep:async(ms)=>delays.push(ms)}};
}
test('worker persists accepted IDs, paces sends, same campaign cannot resend',async()=>{
  const h=harness();await executeCampaign('id',h.deps);assert.equal(h.state.status,'completed');assert.equal(h.sent.length,2);assert.deepEqual(h.delays,[1100,1100]);assert.ok(h.state.recipients.every(r=>r.status==='accepted'&&r.wamid));
  await executeCampaign('id',h.deps);assert.equal(h.sent.length,2);
});
test('opt-outs are rechecked at send time; staff excluded except test',async()=>{
  const h=harness();h.suppressed.add(phone);h.deps.db.readSources=async()=>({excluded:[other]});await executeCampaign('id',h.deps);assert.equal(h.sent.length,0);assert.ok(h.state.recipients.every(r=>r.status==='skipped'));
  const t=harness();t.state.spec.mode='test';t.deps.db.readSources=async()=>({excluded:[phone,other]});await executeCampaign('id',t.deps);assert.equal(t.sent.length,2);
});
test('interrupted in-flight row becomes unknown, queued only resumes',async()=>{
  const h=harness('running');h.state.recipients[0].status='sending';await executeCampaign('id',h.deps);assert.equal(h.state.recipients[0].status,'unknown');assert.deepEqual(h.sent,[other]);
});
test('network ambiguity and hard errors halt campaign before next recipient',async()=>{
  for(const error of [new Error('timeout'),Object.assign(new Error('auth'),{code:190,httpStatus:401}),Object.assign(new Error('quality'),{code:131048,httpStatus:400})]){
    const h=harness();h.deps.sendTemplate=async p=>{h.sent.push(p);throw error;};await executeCampaign('id',h.deps);assert.equal(h.state.status,'halted');assert.equal(h.sent.length,1);assert.equal(h.state.recipients[1].status,'queued');assert.equal(h.state.recipients[0].status,error.httpStatus?'failed':'unknown');
  }
});
test('recipient failure does not stop remaining eligible recipients',async()=>{
  const h=harness();h.deps.sendTemplate=async p=>{h.sent.push(p);if(p===phone)throw Object.assign(new Error('undeliverable'),{code:131026,httpStatus:400});return {messages:[{id:'ok'}]};};await executeCampaign('id',h.deps);assert.equal(h.sent.length,2);assert.equal(h.state.status,'completed');assert.equal(h.state.recipients[0].status,'failed');
});
test('pause takes effect between sends; no approved template means no send',async()=>{
  const h=harness();h.deps.sleep=async()=>{h.state.status='paused';};await executeCampaign('id',h.deps);assert.equal(h.sent.length,1);assert.equal(h.state.status,'paused');
  const no=harness();no.deps.approvedTemplates=async()=>[];await executeCampaign('id',no.deps);assert.equal(no.sent.length,0);assert.equal(no.state.status,'halted');
});
test('concurrent workers share a lock, no duplicate sends',async()=>{
  const h=harness();await Promise.all([executeCampaign('id',h.deps),executeCampaign('id',h.deps)]);assert.equal(h.sent.length,2);
});
