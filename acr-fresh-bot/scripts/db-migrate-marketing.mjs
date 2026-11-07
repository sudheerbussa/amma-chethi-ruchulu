/** Additive marketing migration only. Run on VPS only AFTER deployment approval. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
dotenv.config({path:path.join(root,'.env')});
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const client=new pg.Client({connectionString:process.env.DATABASE_URL});
await client.connect();
try {
  await client.query('BEGIN');
  await client.query(fs.readFileSync(path.join(root,'sql/marketing.pg.sql'),'utf8'));
  await client.query(fs.readFileSync(path.join(root,'sql/whatsapp-status.pg.sql'),'utf8'));
  await client.query('COMMIT');
  console.log('Marketing migration applied (Fresh DB only)');
} catch(e) {await client.query('ROLLBACK');throw e;} finally {await client.end();}
