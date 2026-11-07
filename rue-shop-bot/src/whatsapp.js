import { config, isWhatsappReady } from './config.js';
import { getDb } from './db.js';

const GRAPH = () => `https://graph.facebook.com/${config.apiVersion}`;

export { isWhatsappReady };

export function extractInboundMessages(body) {
  const out = [];
  const entries = body?.entry || [];
  for (const entry of entries) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      for (const msg of value.messages || []) {
        out.push({
          from: msg.from,
          id: msg.id,
          type: msg.type,
          text: msg.text?.body || msg.button?.text || msg.interactive?.button_reply?.title || '',
          timestamp: msg.timestamp,
        });
      }
    }
  }
  return out;
}

export function logInbound(messages) {
  for (const m of messages) {
    console.log('WA inbound', m.from, m.type, (m.text || '').slice(0, 80));
  }
}

export async function sendText(to, body) {
  if (!isWhatsappReady()) {
    console.warn('WhatsApp not configured — skip send to', to);
    return { skipped: true };
  }
  const phone = String(to || '').replace(/\D/g, '');
  const res = await fetch(`${GRAPH()}/${config.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { preview_url: true, body: String(body || '').slice(0, 4096) },
    }),
  });
  const data = await res.json().catch(() => ({}));
  try {
    await getDb().logMessage({ phone, direction: 'out', body });
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const err = new Error(data?.error?.message || `WhatsApp send failed (${res.status})`);
    err.raw = data;
    throw err;
  }
  return data;
}
