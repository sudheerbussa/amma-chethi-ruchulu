import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { projectRoot } from './paths.js';
import { getDb } from './db.js';

const GRAPH = `https://graph.facebook.com/${config.apiVersion}`;

/** Cache uploaded QR media id for this process */
let cachedUpiQrMediaId = null;

function resolvePath(p) {
  return path.isAbsolute(p) ? p : path.join(projectRoot, p);
}

function summarizeOutbound(payload) {
  const type = payload?.type || 'other';
  if (type === 'text') {
    return { kind: 'text', body: payload.text?.body || '', meta: {} };
  }
  if (type === 'image') {
    return {
      kind: 'image',
      body: payload.image?.caption || '[image]',
      meta: {},
    };
  }
  if (type === 'interactive') {
    const i = payload.interactive || {};
    if (i.type === 'button') {
      return {
        kind: 'buttons',
        body: i.body?.text || '',
        meta: {
          buttons: (i.action?.buttons || []).map((b) => b.reply?.title || b.reply?.id).filter(Boolean),
          footer: i.footer?.text || null,
        },
      };
    }
    if (i.type === 'list') {
      return {
        kind: 'list',
        body: i.body?.text || '',
        meta: { button: i.action?.button || null, footer: i.footer?.text || null },
      };
    }
    if (i.type === 'cta_url') {
      return {
        kind: 'cta_url',
        body: i.body?.text || '',
        meta: {
          display_text: i.action?.parameters?.display_text || null,
          url: i.action?.parameters?.url || null,
        },
      };
    }
    return { kind: 'interactive', body: i.body?.text || type, meta: {} };
  }
  return { kind: type, body: `[${type}]`, meta: {} };
}

async function logOutbound(to, payload, sendResult) {
  try {
    const sum = summarizeOutbound(payload);
    const waId =
      sendResult?.messages?.[0]?.id ||
      sendResult?.messages?.[0]?.message_id ||
      null;
    await getDb().logWaMessage({
      phone: String(to || '').replace(/\D/g, ''),
      direction: 'out',
      kind: sum.kind,
      body: sum.body,
      wa_message_id: waId,
      meta: sum.meta,
    });
  } catch (err) {
    console.error('Outbound message log failed', err.message || err);
  }
}

export async function logInbound(msg) {
  try {
    const body =
      msg.kind === 'button' || msg.kind === 'list'
        ? msg.title
          ? `${msg.title} (${msg.text})`
          : msg.text
        : msg.text;
    await getDb().logWaMessage({
      phone: msg.from,
      direction: 'in',
      kind: msg.kind || 'text',
      body: body || '',
      title: msg.title || null,
      wa_message_id: msg.id || null,
      profile_name: msg.profileName || null,
    });
  } catch (err) {
    console.error('Inbound message log failed', err.message || err);
  }
}

async function sendPayload(to, payload) {
  if (!config.accessToken || !config.phoneNumberId) {
    console.log(`[dry-run WhatsApp → ${to}]`, JSON.stringify(payload, null, 2));
    const dry = { dryRun: true };
    await logOutbound(to, payload, dry);
    return dry;
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
  await logOutbound(to, payload, data);
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
 * Note: reply buttons only send a callback to the bot — they cannot open a URL.
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
 * Single URL call-to-action button (opens browser / in-app browser).
 * Use for Pay links — regular reply buttons cannot open URLs.
 *
 * @param {string} to
 * @param {string} bodyText
 * @param {{ displayText: string, url: string }} cta  displayText max 20 chars
 * @param {{ header?: string, footer?: string }} [opts]
 */
export async function sendCtaUrl(to, bodyText, cta, opts = {}) {
  const url = String(cta?.url || '').trim();
  if (!url) throw new Error('sendCtaUrl requires cta.url');
  const interactive = {
    type: 'cta_url',
    body: { text: String(bodyText).slice(0, 1024) },
    action: {
      name: 'cta_url',
      parameters: {
        display_text: String(cta.displayText || 'Open').slice(0, 20),
        url,
      },
    },
  };
  if (opts.header) {
    interactive.header = { type: 'text', text: String(opts.header).slice(0, 60) };
  }
  if (opts.footer) {
    interactive.footer = { text: String(opts.footer).slice(0, 60) };
  }
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

/** Normalize inbound text + interactive button/list taps into { from, text, id, kind, profileName } */
export function extractInboundMessages(payload) {
  const out = [];
  const entries = payload?.entry || [];
  for (const entry of entries) {
    for (const change of entry.changes || []) {
      const value = change.value;
      if (!value?.messages) continue;

      /** Meta often includes WhatsApp display name here (not a verified legal name). */
      const profileByWaId = new Map();
      for (const c of value.contacts || []) {
        const waId = String(c.wa_id || '').replace(/\D/g, '');
        const pname = (c.profile?.name || '').trim();
        if (waId && pname) profileByWaId.set(waId, pname.slice(0, 40));
      }

      for (const msg of value.messages) {
        const from = String(msg.from || '').replace(/\D/g, '');
        const profileName = profileByWaId.get(from) || null;

        if (msg.type === 'text') {
          out.push({
            from,
            text: (msg.text?.body || '').trim(),
            id: msg.id,
            kind: 'text',
            profileName,
          });
          continue;
        }
        if (msg.type === 'interactive') {
          const btn = msg.interactive?.button_reply;
          const list = msg.interactive?.list_reply;
          if (btn) {
            out.push({
              from,
              text: (btn.id || btn.title || '').trim(),
              id: msg.id,
              kind: 'button',
              title: btn.title || '',
              profileName,
            });
          } else if (list) {
            out.push({
              from,
              text: (list.id || list.title || '').trim(),
              id: msg.id,
              kind: 'list',
              title: list.title || '',
              profileName,
            });
          }
        }
      }
    }
  }
  return out;
}

