#!/usr/bin/env node
/**
 * Clear Meta WhatsApp Ice Breakers (e.g. "What are the hours?", price-range prompts).
 * Uses WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID from .env / environment.
 *
 *   node scripts/clear-ice-breakers.mjs
 *   node scripts/clear-ice-breakers.mjs --show
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env') });

const token = process.env.WHATSAPP_ACCESS_TOKEN || '';
const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const version = process.env.WHATSAPP_API_VERSION || 'v21.0';
const showOnly = process.argv.includes('--show');

if (!token || !phoneId) {
  console.error('Need WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID');
  process.exit(1);
}

const base = `https://graph.facebook.com/${version}/${phoneId}`;
const edge = `${base}/conversational_automation`;

async function getConfig() {
  // Prefer edge with no fields= (fields= triggers "nonexisting field" on some API versions)
  let res = await fetch(edge, {
    headers: { Authorization: `Bearer ${token}` },
  });
  let data = await res.json().catch(() => ({}));
  if (res.ok) return { via: 'edge', data };

  res = await fetch(`${base}?fields=conversational_automation`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  data = await res.json().catch(() => ({}));
  if (res.ok) return { via: 'phone_fields', data };

  throw new Error(
    data.error?.message ||
      JSON.stringify(data) ||
      'Could not read conversational_automation — clear via Meta WhatsApp Manager → Automations → Ice breakers',
  );
}

async function clearPrompts() {
  const res = await fetch(edge, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompts: [],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data.error?.message ||
        JSON.stringify(data) ||
        'POST failed — clear ice breakers manually in WhatsApp Manager → Automations',
    );
  }
  return data;
}

try {
  const before = await getConfig();
  console.log('Current:', JSON.stringify(before, null, 2));
  if (showOnly) process.exit(0);

  const result = await clearPrompts();
  console.log('Clear result:', JSON.stringify(result, null, 2));
  try {
    const after = await getConfig();
    console.log('After:', JSON.stringify(after, null, 2));
  } catch (e) {
    console.log('Cleared (re-read skipped):', e.message);
  }
  console.log('Done. Delete old WhatsApp chat with the business number to refresh the chips UI.');
} catch (err) {
  console.error(err.message || err);
  console.error(
    '\nManual fix: Meta Business Suite → WhatsApp Manager → phone settings → Automations → Ice breakers → remove all → Save',
  );
  process.exit(1);
}
