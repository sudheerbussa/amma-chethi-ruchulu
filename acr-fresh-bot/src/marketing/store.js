import pg from 'pg';
import { config } from '../config.js';
import { getDb } from '../db.js';
import { normalizePhone, nextDeliveryStatus } from './core.js';

export const CUSTOMER_QUERY = `SELECT c.phone, c.name,
  GREATEST(c.order_count, COALESCE(o.n, 0))::int AS order_count,
  GREATEST(c.last_order_at, o.last_at) AS last_order_at,
  EXISTS(SELECT 1 FROM wa_messages w WHERE w.phone = c.phone AND w.direction = 'in') AS interacted
 FROM customers c LEFT JOIN
 (SELECT phone, COUNT(*)::int n, MAX(created_at) last_at FROM orders GROUP BY phone) o ON o.phone = c.phone`;
let foodPool;
function pool() {
  const db = getDb();
  if (db.driver !== 'pg') throw new Error('Template campaigns require Postgres');
  return db.pool;
}
export async function readSources() {
  const freshPool = pool();
  const fresh = (await freshPool.query(CUSTOMER_QUERY)).rows;
  const freshRiders = (await freshPool.query('SELECT phone FROM riders')).rows;
  let food = [], foodRiders = [];
  if (config.foodDatabaseUrl) {
    foodPool ||= new pg.Pool({ connectionString: config.foodDatabaseUrl, max: 2,
      connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000,
      options: '-c default_transaction_read_only=on -c statement_timeout=15000' });
    food = (await foodPool.query(CUSTOMER_QUERY)).rows;
    foodRiders = (await foodPool.query('SELECT phone FROM riders')).rows;
  }
  return { fresh, food, foodConfigured: Boolean(config.foodDatabaseUrl),
    excluded: [...config.adminPhones, ...config.riderPhones, ...config.marketingExcludedPhones,
      config.foodWhatsappNumber, config.freshWhatsappNumber, ...freshRiders.map(r=>r.phone), ...foodRiders.map(r=>r.phone)] };
}
export async function setSuppression(phone, suppressed, source = 'whatsapp') {
  phone = normalizePhone(phone);
  if (!phone) throw new Error('Invalid Indian mobile phone');
  const db = getDb();
  if (db.driver !== 'pg') return db.setMeta('marketing:suppressed:' + phone, suppressed ? '1' : '0');
  await pool().query(`INSERT INTO marketing_suppressions(phone,suppressed,source) VALUES($1,$2,$3)
    ON CONFLICT(phone) DO UPDATE SET suppressed=EXCLUDED.suppressed, source=EXCLUDED.source, updated_at=NOW()`, [phone,suppressed,source]);
}
export async function isSuppressed(phone) {
  phone = normalizePhone(phone) || String(phone || '');
  const db = getDb();
  if (db.driver !== 'pg') return (await db.getMeta('marketing:suppressed:' + phone)) === '1';
  return Boolean((await pool().query('SELECT suppressed FROM marketing_suppressions WHERE phone=$1', [phone])).rows[0]?.suppressed);
}
export async function suppressedPhones() {
  return (await pool().query('SELECT phone FROM marketing_suppressions WHERE suppressed=TRUE')).rows.map(r=>r.phone);
}
export async function createCampaign(id, hash, spec, recipients) {
  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    const added = await client.query(`INSERT INTO marketing_campaigns(id,request_hash,spec) VALUES($1,$2,$3::jsonb)
      ON CONFLICT(id) DO NOTHING RETURNING id`, [id,hash,JSON.stringify(spec)]);
    const existing = (await client.query('SELECT request_hash FROM marketing_campaigns WHERE id=$1', [id])).rows[0];
    if (existing.request_hash !== hash) throw new Error('Campaign ID already belongs to a different request');
    if (added.rowCount) for (const r of recipients) await client.query(
      'INSERT INTO marketing_recipients(campaign_id,phone,name) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [id,r.phone,r.name]);
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}
export async function getCampaign(id) {
  const c = (await pool().query('SELECT * FROM marketing_campaigns WHERE id=$1', [id])).rows[0];
  if (!c) return null;
  const recipients = (await pool().query('SELECT phone,name,status,wamid,error,updated_at FROM marketing_recipients WHERE campaign_id=$1 ORDER BY phone', [id])).rows;
  const counts = {};
  for (const r of recipients) counts[r.status] = (counts[r.status] || 0) + 1;
  return { ...c, recipients, counts, total: recipients.length };
}
export async function listCampaigns() {
  return (await pool().query(`SELECT c.id,c.status,c.created_at,c.last_error,c.spec->>'name' AS template,
    c.spec->>'language' AS language, COUNT(r.phone)::int AS total FROM marketing_campaigns c
    LEFT JOIN marketing_recipients r ON r.campaign_id=c.id GROUP BY c.id ORDER BY c.created_at DESC LIMIT 30`)).rows;
}
export async function campaignState(id, status, error = null) {
  await pool().query('UPDATE marketing_campaigns SET status=$2,last_error=$3,updated_at=NOW() WHERE id=$1', [id,status,error]);
}
export async function claimRecipient(id, phone) {
  const result = await pool().query("UPDATE marketing_recipients SET status='sending',updated_at=NOW() WHERE campaign_id=$1 AND phone=$2 AND status='queued' RETURNING phone", [id,phone]);
  return result.rowCount === 1;
}
export async function recipientState(id, phone, status, { wamid = null, error = null } = {}) {
  await pool().query(`UPDATE marketing_recipients SET status=$3,wamid=COALESCE($4,wamid),error=$5,updated_at=NOW()
    WHERE campaign_id=$1 AND phone=$2`, [id,phone,status,wamid,error]);
}
// One worker globally keeps all campaigns under the same send rate and avoids pool exhaustion.
export async function withCampaignLock(id, fn) {
  const client = await pool().connect();
  let locked = false;
  try {
    locked = (await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', ['acr-marketing-worker'])).rows[0].locked;
    if (locked) await fn();
    return locked;
  } finally {
    if (locked) await client.query('SELECT pg_advisory_unlock(hashtext($1))', ['acr-marketing-worker']).catch(()=>{});
    client.release();
  }
}
export async function updateWebhookStatus(status) {
  if (!status.id || getDb().driver !== 'pg') return null;
  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    const rows = (await client.query('SELECT campaign_id,phone,status FROM marketing_recipients WHERE wamid=$1 FOR UPDATE', [status.id])).rows;
    for (const row of rows) {
      const next = nextDeliveryStatus(row.status, status.status);
      const error = next === 'failed' ? String(status.errors?.[0]?.title || 'Delivery failed').slice(0,300) : null;
      await client.query('UPDATE marketing_recipients SET status=$3,error=$4,updated_at=NOW() WHERE campaign_id=$1 AND phone=$2', [row.campaign_id,row.phone,next,error]);
    }
    await client.query('COMMIT');
    return rows;
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}
