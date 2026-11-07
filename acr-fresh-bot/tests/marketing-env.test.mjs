import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';
test('deployment env helper is idempotent, preserves credentials, and configures exclusions without disclosure',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'acr-env-test-'));
  try {
    const url='postgres://unit:fake$&value@localhost/food';
    fs.writeFileSync(path.join(tmp,'.env'),'DATABASE_URL=postgres://unit:fake@localhost/fresh\nWHATSAPP_WABA_ID=old\nFOOD_DATABASE_URL=\n');
    fs.writeFileSync(path.join(tmp,'food.env'),'DATABASE_URL='+url+'\nADMIN_PHONES=919876543210\nRIDER_PHONES=919876543211\n');
    let script=fs.readFileSync(new URL('../scripts/configure-marketing-env.mjs',import.meta.url),'utf8');
    script=script.replace("const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');",'const root='+JSON.stringify(tmp)+';').replace("'/opt/order-bot/.env'",JSON.stringify(path.join(tmp,'food.env')));
    for(let i=0;i<2;i++) {const r=spawnSync(process.execPath,['--input-type=module'],{input:script,encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.ok(!r.stdout.includes(url));}
    const env=dotenv.parse(fs.readFileSync(path.join(tmp,'.env')));assert.equal(env.FOOD_DATABASE_URL,url);assert.equal(env.WHATSAPP_WABA_ID,'2336111803586962');assert.equal(env.MARKETING_EXCLUDED_PHONES,'919876543210,919876543211');assert.equal(fs.statSync(path.join(tmp,'.env')).mode&0o777,0o600);
  } finally {fs.rmSync(tmp,{recursive:true,force:true});}
});
