// No live API or production DB: install the fetch mock before importing application modules.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'acr-template-test-'));
Object.assign(process.env,{NODE_ENV:'test',DATABASE_URL:'',REFERRAL_DATABASE_URL:'',FOOD_DATABASE_URL:'',DATABASE_PATH:path.join(temp,'orders.json'),WHATSAPP_ACCESS_TOKEN:'UNIT_TEST_NOT_A_TOKEN',WHATSAPP_PHONE_NUMBER_ID:'UNIT_TEST',WHATSAPP_WABA_ID:'UNIT_TEST_WABA'});
let handler;
globalThis.fetch=async(...args)=>{assert.ok(handler,'Network is mocked for every request');return handler(...args);};
const {sendTemplate,extractInboundMessages}=await import('../src/whatsapp.js');
const {initDb}=await import('../src/db.js');await initDb();
const {approvedTemplates}=await import('../src/marketing/service.js');
test('template payload has body, language, and correct opt-out button index',async()=>{
  handler=async(url,opts)=>{
    assert.ok(url.endsWith('/UNIT_TEST/messages'));const b=JSON.parse(opts.body);
    assert.equal(b.type,'template');assert.equal(b.template.name,'acr_fresh_offer');assert.equal(b.template.language.code,'te');assert.equal(b.messaging_product,'whatsapp');
    assert.deepEqual(b.template.components[0].parameters.map(p=>p.text),['Name','Offer','Today']);
    assert.equal(b.template.components[1].index,'1');assert.equal(b.template.components[1].parameters[0].payload,'marketing_opt_out');
    return {ok:true,json:async()=>({messages:[{id:'MOCK_ONLY'}]})};
  };
  const result=await sendTemplate('919999999999','acr_fresh_offer','te',['Name','Offer','Today'],{optOutIndexes:[1]});assert.equal(result.messages[0].id,'MOCK_ONLY');
});
test('Graph errors retain code/status for retry policy',async()=>{
  handler=async()=>({ok:false,status:429,json:async()=>({error:{message:'rate limited',code:130429}})});
  await assert.rejects(()=>sendTemplate('919999999999','x','en',[]),err=>err.code===130429&&err.httpStatus===429);
});
test('template quick replies type=button retain payload and title',()=>{
  const messages=extractInboundMessages({entry:[{changes:[{value:{messages:[{type:'button',from:'919999999999',id:'mock',button:{text:'Offers వద్దు',payload:'marketing_opt_out'}}]}}]}]});
  assert.equal(messages[0].kind,'button');assert.equal(messages[0].text,'marketing_opt_out');assert.equal(messages[0].title,'Offers వద్దు');
});
test('live template lookup paginates, filters pending/category and never follows arbitrary next URLs',async()=>{
  let calls=0;
  handler=async(url)=>{calls++;assert.ok(url.startsWith('https://graph.facebook.com/'));return {ok:true,json:async()=> calls===1 ? {data:[{name:'pending',status:'PENDING',category:'MARKETING'}],paging:{next:'https://malicious.invalid',cursors:{after:'cursor'}}} : {data:[{name:'restock',status:'APPROVED',category:'MARKETING',language:'en',components:[{type:'BODY',text:'Hi {{1}}'},{type:'BUTTONS',buttons:[{type:'QUICK_REPLY',text:'Stop offers'}]}]},{name:'auth',status:'APPROVED',category:'AUTHENTICATION'}]}};};
  const result=await approvedTemplates();assert.equal(calls,2);assert.equal(result.length,1);assert.equal(result[0].name,'restock');
});
test.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
