/**
 * Meta allows one webhook URL per app. Route fresh-line events to acr-fresh-bot by phone_number_id.
 */

export function webhookPhoneNumberId(body) {
  const entries = body?.entry;
  if (!Array.isArray(entries)) return null;
  for (const entry of entries) {
    for (const change of entry?.changes || []) {
      const id = change?.value?.metadata?.phone_number_id;
      if (id) return String(id);
    }
  }
  return null;
}

export async function forwardWebhook(body, targetUrl) {
  const url = String(targetUrl || '').trim();
  if (!url) return false;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('Webhook forward failed', url, res.status, text.slice(0, 200));
    return false;
  }
  return true;
}
