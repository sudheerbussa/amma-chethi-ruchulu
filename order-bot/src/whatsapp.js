import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';

const GRAPH = `https://graph.facebook.com/${config.apiVersion}`;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

/** Cache uploaded QR media id for this process */
let cachedUpiQrMediaId = null;

function resolvePath(p) {
  return path.isAbsolute(p) ? p : path.join(root, p);
}

async function sendPayload(to, payload) {
  if (!config.accessToken || !config.phoneNumberId) {
    console.log(`[dry-run WhatsApp → ${to}]`, JSON.stringify(payload, null, 2));
    return { dryRun: true };
  }

  const res = await fetch(`${GRAPH}/${config.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      ...payload,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('WhatsApp send failed', res.status, data);
    throw new Error(data?.error?.message || 'WhatsApp send failed');
  }
  return data;
}

export async function sendText(to, body) {
  return sendPayload(to, {
    type: 'text',
    text: { preview_url: false, body },
  });
}

/**
 * Up to 3 reply buttons. Each: { id, title } (title max 20 chars).
 */
export async function sendButtons(to, bodyText, buttons, opts = {}) {
  const interactive = {
    type: 'button',
    body: { text: bodyText.slice(0, 1024) },
    action: {
      buttons: buttons.slice(0, 3).map((b) => ({
        type: 'reply',
        reply: {
          id: String(b.id).slice(0, 256),
          title: String(b.title).slice(0, 20),
        },
      })),
    },
  };
  if (opts.footer) interactive.footer = { text: String(opts.footer).slice(0, 60) };
  return sendPayload(to, { type: 'interactive', interactive });
}

/**
 * List message. rows: { id, title, description? }
 * List open button label max 20 chars; row title max 24; description max 72.
 */
export async function sendList(to, { body, button, sections, header, footer }) {
  const interactive = {
    type: 'list',
    body: { text: String(body).slice(0, 1024) },
    action: {
      button: String(button || 'Choose').slice(0, 20),
      sections: sections.map((sec) => ({
        title: String(sec.title || 'Options').slice(0, 24),
        rows: (sec.rows || []).slice(0, 10).map((row) => {
          const out = {
            id: String(row.id).slice(0, 200),
            title: String(row.title).slice(0, 24),
          };
          if (row.description) out.description = String(row.description).slice(0, 72);
          return out;
        }),
      })),
    },
  };
  if (header) interactive.header = { type: 'text', text: String(header).slice(0, 60) };
  if (footer) interactive.footer = { text: String(footer).slice(0, 60) };
  return sendPayload(to, { type: 'interactive', interactive });
}

export async function uploadLocalImage(filePath) {
  if (!config.accessToken || !config.phoneNumberId) {
    console.log(`[dry-run] upload image ${filePath}`);
    return null;
  }

  const abs = resolvePath(filePath);
  if (!fs.existsSync(abs)) throw new Error(`Image not found: ${abs}`);

  const bytes = fs.readFileSync(abs);
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', 'image/jpeg');
  form.append('file', new Blob([bytes], { type: 'image/jpeg' }), path.basename(abs));

  const res = await fetch(`${GRAPH}/${config.phoneNumberId}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.accessToken}` },
    body: form,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) {
    console.error('Media upload failed', res.status, data);
    throw new Error(data?.error?.message || 'Media upload failed');
  }
  return data.id;
}

export async function sendImage(to, { mediaId, link, caption }) {
  const image = {};
  if (mediaId) image.id = mediaId;
  else if (link) image.link = link;
  else throw new Error('sendImage requires mediaId or link');
  if (caption) image.caption = String(caption).slice(0, 1024);

  return sendPayload(to, { type: 'image', image });
}

/** Upload once per process, then reuse media id for UPI QR */
export async function sendUpiQr(to, caption) {
  if (!cachedUpiQrMediaId) {
    cachedUpiQrMediaId = await uploadLocalImage(config.upiQrPath);
  }
  if (!cachedUpiQrMediaId) {
    console.log(`[dry-run] UPI QR caption: ${caption}`);
    return { dryRun: true };
  }
  return sendImage(to, { mediaId: cachedUpiQrMediaId, caption });
}

export function buildUpiPayUri({ amountRupees, orderRef }) {
  const params = new URLSearchParams({
    pa: config.upiId,
    pn: config.upiPayeeName,
    cu: 'INR',
    am: Number(amountRupees).toFixed(2),
    tn: `Order ${orderRef}`.slice(0, 50),
  });
  return `upi://pay?${params.toString()}`;
}

/** Normalize inbound text + interactive button/list taps into { from, text, id, kind } */
export function extractInboundMessages(payload) {
  const out = [];
  const entries = payload?.entry || [];
  for (const entry of entries) {
    for (const change of entry.changes || []) {
      const value = change.value;
      if (!value?.messages) continue;
      for (const msg of value.messages) {
        if (msg.type === 'text') {
          out.push({
            from: msg.from,
            text: (msg.text?.body || '').trim(),
            id: msg.id,
            kind: 'text',
          });
          continue;
        }
        if (msg.type === 'interactive') {
          const btn = msg.interactive?.button_reply;
          const list = msg.interactive?.list_reply;
          if (btn) {
            out.push({
              from: msg.from,
              text: (btn.id || btn.title || '').trim(),
              id: msg.id,
              kind: 'button',
              title: btn.title || '',
            });
          } else if (list) {
            out.push({
              from: msg.from,
              text: (list.id || list.title || '').trim(),
              id: msg.id,
              kind: 'list',
              title: list.title || '',
            });
          }
        }
      }
    }
  }
  return out;
}
