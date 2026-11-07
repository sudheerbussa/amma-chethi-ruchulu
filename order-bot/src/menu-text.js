/**
 * Shared WhatsApp / admin menu text builders (price list + hours blurb).
 */
import { CATEGORIES, sortDishesBySeed } from './menu.js';
import { formatPaise, formatPriceWithMrp } from './orders/cart.js';
import { mealStatusText } from './cutoffs.js';

/** @param {Array} dishes */
export function formatMenuPriceChunks(dishes, { businessName = 'Amma Chethi Ruchulu' } = {}) {
  const active = sortDishesBySeed((dishes || []).filter((d) => d && d.active));
  if (!active.length) {
    return ['Menu prices are being updated. Tap Order to browse items.'];
  }

  const lines = [`📋 *Price list* — ${businessName}`, ''];
  for (const cat of CATEGORIES) {
    const rows = active.filter((d) => d.category === cat.id);
    if (!rows.length) continue;
    lines.push(`*${cat.emoji || ''} ${cat.title}*`.trim());
    for (const d of rows) {
      const note = d.note ? ` (${String(d.note).slice(0, 40)})` : '';
      lines.push(`• ${d.name} — ${formatPriceWithMrp(d)}${note}`);
    }
    lines.push('');
  }
  lines.push('WhatsApp: send *Hi* → *Order* to pick a delivery time.');

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
  return chunks.length ? chunks : ['Tap Order to start.'];
}

/** Full markdown doc body (active dishes). */
export function formatMenuMarkdown(dishes, { businessName = 'Amma Chethi Ruchulu' } = {}) {
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
      const mrpTag = (d.mrp_paise && d.mrp_paise > d.price_paise)
        ? ` ~~${formatPaise(d.mrp_paise)}~~`
        : '';
      lines.push(`- **${d.name}** (${d.code}) — ${formatPaise(d.price_paise)}${mrpTag}${note}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function hoursAndRangeBlurb() {
  return (
    `⏰ *Hours / order windows*\n` +
    `${mealStatusText()}\n\n` +
    `💰 *Price range*\n` +
    `Egg ₹40+ · Curries ₹80+ · Biryanis ₹120+ · Meals ₹100–₹190 · Chapathi meals (dinner) · Party packs ₹3699+.\n` +
    `Send *Hi* → *Order* (Veg / Non-veg form) or *View menu* for the full list.`
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
