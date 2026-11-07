/**
 * Shared WhatsApp / admin menu text builders (price list + hours blurb).
 */
import { CATEGORIES, sortDishesBySeed, dishCustomerName } from './menu.js';
import { formatPaise } from './orders/cart.js';
import { slotStatusText } from './cutoffs.js';
import { config } from './config.js';

/** @param {Array} dishes */
export function formatMenuPriceChunks(dishes, { businessName = config.businessName } = {}) {
  const active = sortDishesBySeed((dishes || []).filter((d) => d && d.active));
  if (!active.length) {
    return ['మెనూ అప్‌డేట్ అవుతోంది. *Order* నొక్కి చూడండి.'];
  }

  const lines = [`📋 *దరలు* — ${businessName}`, ''];
  for (const cat of CATEGORIES) {
    const rows = active.filter((d) => d.category === cat.id);
    if (!rows.length) continue;
    lines.push(`*${cat.emoji || ''} ${cat.title_te || cat.title}*`.trim());
    for (const d of rows) {
      const note = d.note ? ` (${String(d.note).slice(0, 40)})` : '';
      lines.push(`• ${dishCustomerName(d)} — ${formatPaise(d.price_paise)}${note}`);
    }
    lines.push('');
  }
  lines.push('*Hi* పంపి *Order* నొక్కండి.');

  const chunks = [];
  let buf = '';
  for (const line of lines) {
    const next = buf ? `${buf}\n${line}` : line;
    if (next.length > 3500 && buf) {
      chunks.push(buf);
      buf = line;
    } else {
      buf = next;
    }
  }
  if (buf.trim()) chunks.push(buf);
  return chunks.length ? chunks : ['*Hi* పంపి *Order* నొక్కండి.'];
}

/** Full markdown doc body (active dishes). */
export function formatMenuMarkdown(dishes, { businessName = config.businessName } = {}) {
  const active = sortDishesBySeed((dishes || []).filter((d) => d && d.active));
  const lines = [
    `# ${businessName} — Menu & prices`,
    '',
    `_Active dishes only. Order on WhatsApp: send **Hi** to the business number._`,
    '',
  ];
  for (const cat of CATEGORIES) {
    const rows = active.filter((d) => d.category === cat.id);
    if (!rows.length) continue;
    lines.push(`## ${cat.emoji || ''} ${cat.title}`);
    lines.push('');
    for (const d of rows) {
      const note = d.note ? ` — ${d.note}` : '';
      lines.push(`- **${d.name}** (${d.code}) — ${formatPaise(d.price_paise)}${note}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function hoursAndRangeBlurb() {
  return (
    `⏰ *డెలివరీ స్లాట్లు*\n` +
    `${slotStatusText()}\n\n` +
    `💰 *దరాలు*\n` +
    `కూరగాయలు & పండ్లు ₹25/kg నుంచి · కనీసం ఆర్డర్ ₹100.\n` +
    `పాలు, పళ్ళెటవు లేదా లిస్ట్ లో లేని వస్తువులు — మా నంబర్‌కు కాల్ చేయండి (COD).\n` +
    `*Hi* పంపి *Order* లేదా *View menu* నొక్కండి.`
  );
}

/** Detect Meta Ice Breaker taps (default restaurant prompts). */
export function isIceBreakerHours(text) {
  const t = String(text || '').trim().toLowerCase();
  return (
    t === 'what are the hours?' ||
    t === 'what are the hours' ||
    t.includes('what are the hours') ||
    t === 'hours' ||
    t === 'timings' ||
    t === 'timing'
  );
}

export function isIceBreakerPrices(text) {
  const t = String(text || '').trim().toLowerCase();
  return (
    t.includes('price range') ||
    t.includes('prices range') ||
    t === 'whats the prices range of your menu?' ||
    t === "what's the price range of your menu?" ||
    t === 'price range' ||
    t === 'prices'
  );
}
