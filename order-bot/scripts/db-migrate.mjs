/**
 * Apply sql/schema.pg.sql
 * Usage: DATABASE_URL=postgres://... node scripts/db-migrate.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env') });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL (e.g. postgres://user:pass@127.0.0.1:5432/acr_orders)');
  process.exit(1);
}

const schemaPath = path.join(root, 'sql', 'schema.pg.sql');
const sql = fs.readFileSync(schemaPath, 'utf8');

const { default: pg } = await import('pg');
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(sql);
  console.log('Migrated schema from', schemaPath);
} finally {
  await client.end();
}
