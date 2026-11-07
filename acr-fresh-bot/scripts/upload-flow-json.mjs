#!/usr/bin/env node
/**
 * Upload docs/flow-order-fresh-v1.json to Meta and publish.
 * Usage: node scripts/upload-flow-json.mjs
 * Env: WHATSAPP_ACCESS_TOKEN, WHATSAPP_FLOW_ID, WHATSAPP_API_VERSION (optional)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
dotenv.config({ path: path.join(root, '.env') });

const token = process.env.WHATSAPP_ACCESS_TOKEN || '';
const flowId = process.env.WHATSAPP_FLOW_ID || '';
const ver = process.env.WHATSAPP_API_VERSION || 'v21.0';
const jsonPath =
  process.env.WHATSAPP_FLOW_JSON_PATH ||
  path.join(root, 'docs', 'flow-order-fresh-v1.json');

if (!token || !flowId) {
  console.error('Need WHATSAPP_ACCESS_TOKEN and WHATSAPP_FLOW_ID');
  process.exit(1);
}
if (!fs.existsSync(jsonPath)) {
  console.error('Missing', jsonPath);
  process.exit(1);
}

const form = new FormData();
form.append('name', 'flow.json');
form.append('asset_type', 'FLOW_JSON');
form.append(
  'file',
  new Blob([fs.readFileSync(jsonPath)], { type: 'application/json' }),
  'flow.json',
);

const up = await fetch(`https://graph.facebook.com/${ver}/${flowId}/assets`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});
const upJson = await up.json();
console.log('upload', up.status, JSON.stringify(upJson).slice(0, 800));
if (!up.ok) process.exit(1);

const pub = await fetch(`https://graph.facebook.com/${ver}/${flowId}/publish`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
});
const pubJson = await pub.json().catch(() => ({}));
console.log('publish', pub.status, JSON.stringify(pubJson).slice(0, 800));
if (!pub.ok) process.exit(1);
console.log('Flow published OK', flowId);
