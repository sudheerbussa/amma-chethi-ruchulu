import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
// Embedded in-memory PostgreSQL. No production URL, external socket, or real network.
Object.assign(process.env,{NODE_ENV:'test',DATABASE_URL:'postgres://unit-test-only/fresh',FOOD_DATABASE_URL:'postgres://unit-test-only/food',REFERRAL_DATABASE_URL:'',WHATSAPP_ACCESS_TOKEN:'MOCK_ONLY',WHATSAPP_PHONE_NUMBER_ID:'MOCK_ONLY'});
globalThis.fetch=async()=>{throw new Error('Network forbidden in SQL tests');};
const fresh=new PGlite(),food=new PGlite();
const schema=fs.readFileSync(new URL('../sql/schema.pg.sql',import.meta.url),'utf8');
await fresh.exec(schema);await fresh.exec(schema);await food.exec(schema);
let foodReadOnly=false;
pg.Pool=class {
  constructor(opts){this.db=opts.connectionString.endsWith('/food')?food:fresh;if(this.db===food)foodReadOnly=opts.options.includes('default_transaction_read_only=on');}
  async query(sql,params=[]){if(/pg_try_advisory_lock/.test(sql))return {rows:[{locked:true}],rowCount:1};if(/pg_advisory_unlock/.test(sql))return {rows:[{}],rowCount:1};const r=await this.db.query(sql,params);return {...r,rowCount:r.affectedRows??r.rows.length};}
  async connect(){return {query:this.query.bind(this),release(){}};} async end(){}
};
const {initDb}=await import('../src/db.js');await initDb();
const store=await import('../src/marketing/store.js');
const {handleMarketingPreference}=await import('../src/marketing/service.js');
const {config}=await import('../src/config.js');
const phone='919876543210',id='11111111-1111-4111-8111-111111111111';
test('idempotent migrations and campaign creation use real PostgreSQL constraints/transactions',async()=>{
  const spec={name:'template',language:'en'};
  await store.createCampaign(id,'hash',spec,[{phone,name:'One'}]);
  await store.createCampaign(id,'hash',spec,[{phone,name:'One'},{phone:'919876543211',name:'Two'}]);
  let c=await store.getCampaign(id);assert.equal(c.total,1);assert.equal(c.counts.queued,1);
  await assert.rejects(()=>store.createCampaign(id,'changed',spec,[]),/different request/);
  c=await store.getCampaign(id);assert.equal(c.total,1);assert.equal(c.request_hash,'hash');
  assert.equal(await store.claimRecipient(id,phone),true);assert.equal(await store.claimRecipient(id,phone),false);
});
test('persistent suppressions and START reversal',async()=>{
  await store.setSuppression(phone,true);assert.equal(await store.isSuppressed(phone),true);assert.deepEqual(await store.suppressedPhones(),[phone]);
  await store.setSuppression(phone,false);assert.equal(await store.isSuppressed(phone),false);assert.deepEqual(await store.suppressedPhones(),[]);
});
test('webhook updates accepted to delivered/read without regression',async()=>{
  await store.recipientState(id,phone,'accepted',{wamid:'wamid.MOCK'});
  await store.updateWebhookStatus({id:'wamid.MOCK',status:'delivered'});assert.equal((await store.getCampaign(id)).recipients[0].status,'delivered');
  await store.updateWebhookStatus({id:'wamid.MOCK',status:'read'});
  await store.updateWebhookStatus({id:'wamid.MOCK',status:'sent'});assert.equal((await store.getCampaign(id)).recipients[0].status,'read');
  await store.updateWebhookStatus({id:'unrelated',status:'failed'});assert.equal((await store.getCampaign(id)).recipients[0].status,'read');
});
test('Food customer queries are SQL-validated and use read-only pool options',async()=>{
  await fresh.query("INSERT INTO customers(phone,name,order_count,last_order_at) VALUES($1,'Fresh',1,NOW())",[phone]);
  await food.query("INSERT INTO customers(phone,name,order_count) VALUES($1,'Food',2)",[phone]);
  await food.query("INSERT INTO riders(id,name,phone) VALUES('test-rider','Rider','919876543212')");
  const sources=await store.readSources();assert.equal(sources.fresh.length,1);assert.equal(sources.food.length,1);assert.equal(sources.food[0].order_count,2);assert.ok(sources.excluded.includes('919876543212'));assert.equal(foodReadOnly,true);
});
test('idle session with an actual pending order preserves existing STOP cancellation',async()=>{
  await fresh.query("INSERT INTO orders(order_ref,phone,meal,total_paise,address,status) VALUES('TEST-PENDING',$1,'fresh',10000,'test','pending_payment')",[phone]);
  // If preference code tried to send a confirmation, the forbidden network stub would fail this test.
  assert.equal(await handleMarketingPreference({from:phone,kind:'text',text:'STOP'},{state:'idle'}),false);
  assert.equal(await store.isSuppressed(phone),false);
});
test.after(async()=>{await fresh.close();await food.close();});

test('marketing API is authenticated and legacy broadcasts honor suppression without sending',async()=>{
  const { default: express }=await import('express');
  const { mountAdmin }=await import('../src/admin/routes.js');
  const http=await import('node:http');
  const app=express();app.use(express.json());mountAdmin(app);
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const request=(route,body,authorized=true)=>new Promise((resolve,reject)=>{
    const req=http.request({hostname:'127.0.0.1',port:server.address().port,path:route,method:'POST',headers:{'Content-Type':'application/json',...(authorized?{Authorization:'Bearer '+config.adminToken}:{})}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(text)}));});req.on('error',reject);req.end(JSON.stringify(body));
  });
  try {
    const unauthorized=await request('/admin/api/marketing/audience',{},false);assert.equal(unauthorized.status,401);
    const count=await request('/admin/api/marketing/audience',{});assert.equal(count.status,200);assert.equal(count.data.count,1);
    await store.setSuppression(phone,true);
    const result=await request('/admin/api/broadcast',{phones:[phone],message:'Mock promotion'});assert.equal(result.status,200);assert.equal(result.data.ok,0);assert.equal(result.data.skipped,1);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
