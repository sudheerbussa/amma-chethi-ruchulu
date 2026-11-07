import test from 'node:test';
import assert from 'node:assert/strict';
import {parseStatus,extractStatuses,nextDeliveryStatus,deliveryReason,testRecipients} from '../src/marketing/core.js';
test('parses all entries/changes, timestamp, recipient and error detail; retains pricing/conversation/raw errors',()=>{
  const raw={id:'wamid.test',recipient_id:'919999999999',status:'failed',timestamp:'1794030000',errors:[{code:131049,title:'Limited',message:'Fallback',error_data:{details:'Full detail'}},{code:1}],pricing:{billable:false},conversation:{id:'conversation'}};
  const event=parseStatus(raw);
  assert.equal(event.ts,new Date(1794030000000).toISOString());assert.equal(event.error_code,'131049');assert.equal(event.error_title,'Limited');assert.equal(event.error_detail,'Full detail');assert.equal(event.raw,raw);assert.equal(event.raw.errors.length,2);
  assert.equal(extractStatuses({entry:[{changes:[{value:{statuses:[raw]}},{value:{statuses:[{...raw,status:'read'}]}}]},{changes:[{value:{statuses:[{...raw,status:'delivered'}]}}]}]}).length,3);
  assert.equal(parseStatus({id:'a',status:'sent',errors:null,timestamp:'invalid'}).error_code,null);
  for(const bad of [null,{}, {id:'x',status:'queued'}, {id:2,status:'read'}])assert.equal(parseStatus(bad),null);
  for(const bad of [null,{}, {entry:{}},{entry:[{changes:{}},{changes:[{value:{statuses:{}}}]}]}])assert.deepEqual(extractStatuses(bad),[]);
});
test('ordering matrix: read > delivered > sent; failed rejects sent but accepts delivery/read',()=>{
  const states=['accepted','sent','delivered','read','failed'];
  const expected={accepted:['sent','delivered','read','failed'],sent:['sent','delivered','read','failed'],delivered:['delivered','delivered','read','delivered'],read:['read','read','read','read'],failed:['failed','delivered','read','failed']};
  for(const current of states) ['sent','delivered','read','failed'].forEach((incoming,i)=>assert.equal(nextDeliveryStatus(current,incoming),expected[current][i],current+' -> '+incoming));
  assert.equal(nextDeliveryStatus('sent','unsupported'),'sent');
});
test('failure explanations cover known Meta codes and preserve unknown detail',()=>{
  for(const code of [131049,131026,130472,131047,131050,131042])assert.notEqual(deliveryReason(code,'raw'),'raw');
  assert.equal(deliveryReason(999,'raw'),'raw');assert.match(deliveryReason(131026),/may not/);
});
test('test recipient validation only permits configured admins and deduplicates',()=>{
  const admins=['919876543210','919876543211'];
  assert.deepEqual(testRecipients('9876543210, +919876543210;9876543211',admins),admins);
  assert.throws(()=>testRecipients('9876543212',admins),/restricted/);
  assert.throws(()=>testRecipients('',admins),/1–10/);
});
