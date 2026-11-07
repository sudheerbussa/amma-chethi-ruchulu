import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const html=fs.readFileSync(new URL('../public/admin.html',import.meta.url),'utf8');
const code=html.slice(html.indexOf('      // Template broadcasts: explicit confirmation'),html.indexOf('      function buyListTomorrow()'));
const dom=new JSDOM(html,{url:'https://test.invalid/admin/app',runScripts:'outside-only'});
const w=dom.window;const calls=[];
const template={id:'t1',name:'acr_fresh_offer',language:'en',supported:true,paramCount:3,body:'Hello {{1}}. {{2}} until {{3}}',components:[]};
w.confirm=()=>true;w.fetch=async()=>{throw new Error('No live network');};w.setTimeout=()=>0;w.clearTimeout=()=>{};
w.lsGet=k=>w.localStorage.getItem(k)||'';w.lsSet=(k,v)=>{if(v)w.localStorage.setItem(k,v);else w.localStorage.removeItem(k);return true;};
w.api=async(path,opts={})=>{
  const body=opts.body?JSON.parse(opts.body):null;calls.push({path,body});
  if(path.endsWith('/templates'))return {templates:[template]};
  if(path.endsWith('/audience'))return {count:32,foodConfigured:true};
  if(path.endsWith('/campaigns')&&!body)return {campaigns:[]};
  if((path.endsWith('/test-send')||path.endsWith('/campaigns'))&&body)return {id:body.id};
  if(path.includes('/campaigns/'))return {id:'test',status:'completed',total:1,counts:{failed:1},recipients:[{phone:'919999999999',status:'failed',wamid:'mock',error_code:'131049',failure_reason:'Meta per-user marketing limit',failed_at:'2026-11-07T10:00:00Z'}]};
  throw new Error('Unexpected API path');
};
w.eval(code);
const el=id=>w.document.getElementById('mt'+id);
test('admin card loads live templates and default audience, validates fields and previews safe text',async()=>{
  await el('Refresh').onclick();assert.equal(el('Ordered').checked,true);assert.match(el('Count').textContent,/32 eligible/);
  el('Template').value='t1|en';el('Template').onchange();
  w.document.getElementById('mtParam2').value='<b>Offer</b>';w.document.getElementById('mtParam3').value='8 Nov IST';w.document.getElementById('mtParam2').oninput();
  assert.match(el('Preview').textContent,/<b>Offer<\/b>/);assert.equal(el('Preview').querySelector('b'),null);
  await el('Test').onclick();assert.match(el('Msg').textContent,/Confirm marketing permission/);
});
test('test/audience sends retain durable UUIDs and distinguish campaign modes',async()=>{
  el('Consent').checked=true;el('Phone').value='919999999999';
  await el('Test').onclick();await el('Test').onclick();
  const tests=calls.filter(c=>c.path.endsWith('/test-send')&&c.body?.mode==='test');assert.equal(tests.length,2);assert.equal(tests[0].body.id,tests[1].body.id);assert.equal(tests[0].body.confirmed,true);
  await el('Send').onclick();const audience=calls.find(c=>c.path.endsWith('/campaigns')&&c.body?.mode==='audience');assert.equal(audience.body.expectedCount,32);assert.equal(audience.body.audience.excludeNeverOrdered,true);assert.notEqual(audience.body.id,tests[0].body.id);
  assert.match(el('Progress').textContent,/Accepted = Meta accepted/);assert.match(el('Progress').textContent,/Meta 131049/);assert.match(el('Progress').textContent,/per-user marketing limit/);assert.match(el('Progress').textContent,/sent: 0.*delivered: 0.*read: 0.*failed: 1/);
});
test('explicit New campaign is required to resend identical content under a new ID',async()=>{
  const before=JSON.parse(w.localStorage.getItem('acr_marketing_test')).id;el('New').onclick();await el('Test').onclick();const after=JSON.parse(w.localStorage.getItem('acr_marketing_test')).id;assert.notEqual(after,before);
});
test.after(()=>dom.window.close());
