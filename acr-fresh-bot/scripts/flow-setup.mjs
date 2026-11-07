#!/usr/bin/env node
/**
 * One-shot ACR-Fresh WhatsApp Flow setup:
 * 1) RSA key pair in .flow-keys/ (gitignored)
 * 2) Upload public key to fresh phone number ID
 * 3) Create Flow (or reuse WHATSAPP_FLOW_ID)
 * 4) Upload + publish flow-order-fresh-v1.json
 *
 * Usage: node scripts/flow-setup.mjs
 * Optional: WHATSAPP_FLOW_ID=existing node scripts/flow-setup.mjs  (re-upload JSON only)
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
dotenv.config({ path: path.join(root, '.env') });

const token = process.env.WHATSAPP_ACCESS_TOKEN || '';
const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1346730061850877';
const ver = process.env.WHATSAPP_API_VERSION || 'v21.0';
const endpoint =
  process.env.WHATSAPP_FLOW_ENDPOINT_URI ||
  `${String(process.env.PUBLIC_BASE_URL || 'https://fresh.ammachethiruchulu.co.in').replace(/\/$/, '')}/flows`;
const jsonPath = path.join(root, 'docs', 'flow-order-fresh-v1.json');
const keysDir = path.join(root, '.flow-keys');
const privPath = path.join(keysDir, 'flow_private.pem');
const pubPath = path.join(keysDir, 'flow_public.pem');

if (!token) {
  console.error('Set WHATSAPP_ACCESS_TOKEN in .env');
  process.exit(1);
}
if (!fs.existsSync(jsonPath)) {
  console.error('Missing', jsonPath);
  process.exit(1);
}

async function graph(pathname, { method = 'GET', body } = {}) {
  const res = await fetch(`https://graph.facebook.com/${ver}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `${method} ${pathname} → ${res.status}`);
  }
  return data;
}

function ensureKeys() {
  fs.mkdirSync(keysDir, { recursive: true });
  if (!fs.existsSync(privPath) || !fs.existsSync(pubPath)) {
    console.log('Generating RSA key pair in .flow-keys/ …');
    execSync(`openssl genrsa -out "${privPath}" 2048`, { stdio: 'inherit' });
    execSync(`openssl rsa -in "${privPath}" -pubout -out "${pubPath}"`, { stdio: 'inherit' });
  }
  return {
    privatePem: fs.readFileSync(privPath, 'utf8'),
    publicPem: fs.readFileSync(pubPath, 'utf8'),
  };
}

function pemOneLine(pem) {
  return pem.trim().replace(/\r/g, '').replace(/\n/g, '\\n');
}

async function uploadPublicKey(publicPem) {
  console.log('Uploading business public key to phone', phoneId, '…');
  const data = await graph(`/${phoneId}/whatsapp_business_encryption`, {
    method: 'POST',
    body: { business_public_key: publicPem },
  });
  console.log('Public key:', data.success === false ? data : 'OK');
}

async function resolveWabaId() {
  const fromEnv = String(process.env.WHATSAPP_WABA_ID || '2336111803586962').trim();
  if (fromEnv) return fromEnv;
  const data = await graph(`/${phoneId}?fields=id`);
  if (!data?.id) throw new Error('Could not resolve phone number — set WHATSAPP_WABA_ID');
  throw new Error('Set WHATSAPP_WABA_ID (Amma Chethi Ruchulu WABA)');
}

async function createFlow(wabaId) {
  console.log('Creating Flow on WABA', wabaId, 'endpoint', endpoint);
  const data = await graph(`/${wabaId}/flows`, {
    method: 'POST',
    body: {
      name: 'ACR Fresh Order v1',
      categories: ['OTHER'],
      endpoint_uri: endpoint,
    },
  });
  const id = data.id;
  if (!id) throw new Error('Flow create returned no id');
  console.log('Created flow id:', id);
  return id;
}

async function uploadAndPublish(flowId) {
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
  if (!up.ok) throw new Error(upJson?.error?.message || 'Flow JSON upload failed');
  console.log('Flow JSON uploaded, validation:', upJson.validation_errors || 'none');

  const pub = await fetch(`https://graph.facebook.com/${ver}/${flowId}/publish`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const pubJson = await pub.json().catch(() => ({}));
  if (!pub.ok) {
    throw new Error(pubJson?.error?.message || JSON.stringify(pubJson) || 'Flow publish failed');
  }
  console.log('Flow published');
}

async function main() {
  const { privatePem, publicPem } = ensureKeys();
  await uploadPublicKey(publicPem);

  let flowId = String(process.env.WHATSAPP_FLOW_ID || '').trim();
  if (!flowId) {
    const wabaId = await resolveWabaId();
    flowId = await createFlow(wabaId);
  } else {
    console.log('Reusing WHATSAPP_FLOW_ID', flowId);
  }

  await uploadAndPublish(flowId);

  console.log('\n--- VPS env (private key not printed) ---\n');
  console.log(`WHATSAPP_FLOW_ID=${flowId}`);
  console.log('WHATSAPP_FLOW_PASSPHRASE=');
  console.log('WHATSAPP_FLOW_MODE=published');
  console.log('WHATSAPP_FLOW_ALLOWLIST=918055292935,918886128995');
  console.log('\nRun: node scripts/deploy-flow-env.mjs', flowId);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
