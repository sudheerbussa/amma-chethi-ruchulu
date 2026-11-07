/** Run only after deployment approval. Never logs credentials or customer phones. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const file=path.join(root,'.env');
let text=fs.readFileSync(file,'utf8');
const fresh=dotenv.parse(text), food=dotenv.parse(fs.readFileSync('/opt/order-bot/.env','utf8'));
function set(key,value){const line=key+'='+JSON.stringify(String(value));const re=new RegExp('^'+key+'=.*$','m');text=re.test(text)?text.replace(re,()=>line):text.replace(/\s*$/,'\n')+line+'\n';}
if(!food.DATABASE_URL)throw new Error('Food DATABASE_URL is absent; no changes made');
set('WHATSAPP_WABA_ID','2336111803586962');
// Existing referral connection is already verified to match Food. Copy only if not usable.
if(fresh.FOOD_DATABASE_URL) {
  if(fresh.FOOD_DATABASE_URL!==food.DATABASE_URL)throw new Error('FOOD_DATABASE_URL differs from Food; review manually');
} else if(fresh.REFERRAL_DATABASE_URL!==food.DATABASE_URL) set('FOOD_DATABASE_URL',food.DATABASE_URL);
const staff=[fresh.MARKETING_EXCLUDED_PHONES,food.ADMIN_PHONES||'918055292935,918886128995',food.RIDER_PHONES||'918886128995'].flatMap(s=>String(s||'').split(/[,\s]+/)).map(s=>s.replace(/\D/g,'')).filter(Boolean);
set('MARKETING_EXCLUDED_PHONES',[...new Set(staff)].join(','));
fs.writeFileSync(file,text,{mode:0o600});
fs.chmodSync(file,0o600);
console.log('Marketing env configured: WABA, Food connection and staff exclusions (values not logged)');
