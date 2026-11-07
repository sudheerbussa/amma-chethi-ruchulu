import { config } from './config.js';
import { isWhatsappReady, sendText } from './whatsapp.js';

/** Fire-and-forget ops alert: console + optional webhook + admin WhatsApp. */
export async function notifyOps({ title, text }) {
  const msg = `[RUE Shop] ${title}\n${text || ''}`.trim();
  console.log(msg);
  if (config.opsWebhookUrl) {
    try {
      await fetch(config.opsWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msg, content: msg }),
      });
    } catch (err) {
      console.error('ops webhook failed', err.message || err);
    }
  }
  if (isWhatsappReady() && config.adminPhones?.length) {
    for (const phone of config.adminPhones) {
      try {
        await sendText(phone, msg);
      } catch (err) {
        console.error('ops WA failed', phone, err.message || err);
      }
    }
  }
}
