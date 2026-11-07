import { getDb } from '../db.js';
import { config } from '../config.js';
import { downloadWhatsAppMedia, sendText } from '../whatsapp.js';
import { applyOrderStatus, formatOrdersList, formatFeedbackList } from '../orders/status.js';
import { formatOrderKitchenPackLine } from '../ops-notify.js';
import { categoryLabel } from '../menu.js';
import { nowIst } from '../cutoffs.js';
import { formatLinesText, getOrderLines } from '../orders/cart.js';
import {
  isWeekdaySlot,
  listPosters,
  savePoster,
  sendImageBuffer,
  todayWeekdayIst,
} from '../posters.js';

function digits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function formatPaise(paise) {
  return `₹${(paise / 100).toFixed(0)}`;
}

export function isAdminPhone(phone) {
  const p = digits(phone);
  return config.adminPhones.includes(p);
}

const WEEKDAY_ALIASES = {
  mon: 'monday',
  tue: 'tuesday',
  tues: 'tuesday',
  wed: 'wednesday',
  thu: 'thursday',
  thur: 'thursday',
  thurs: 'thursday',
  fri: 'friday',
  sat: 'saturday',
  sun: 'sunday',
};

/** Parse POSTER / POSTER TODAY / POSTER monday from caption or command. */
function parsePosterSlotCommand(text) {
  const t = String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!t) return null;
  if (
    t === 'poster' ||
    t === 'poster today' ||
    t === 'daily poster' ||
    t === 'upload poster'
  ) {
    return todayWeekdayIst();
  }
  const m = t.match(/^poster\s+([a-z]+)$/);
  if (!m) return null;
  const raw = m[1];
  const slot = WEEKDAY_ALIASES[raw] || raw;
  if (!isWeekdaySlot(slot)) return null;
  return slot;
}

function adminHelp() {
  return (
    `Admin — ${config.businessName}\n\n` +
    `ORDERS / PENDING\n` +
    `PAID|OUT|DONE|CANCELORD <ref>\n` +
    `COOK [lunch|dinner] — kitchen summary\n` +
    `MENU — list dishes\n` +
    `OFF <code> / ON <code> — hide/show dish\n` +
    `POSTER — then send today’s daily image\n` +
    `POSTER monday — arm that weekday\n` +
    `POSTERS — which days have images\n` +
    `CATALOG STATUS / SET / SYNC\n` +
    `FEEDBACKS — recent customer ratings\n` +
    `HELPS — customer help tickets\n` +
    `ADMIN — this help\n\n` +
    `Tip: send image with caption POSTER to save today’s poster in one step.`
  );
}

async function cookSummary(meal) {
  const db = getDb();
  const orders = await db.listOrdersForMeal(meal, ['paid', 'preparing', 'out_for_delivery']);
  if (!orders.length) return `${meal.toUpperCase()} — no confirmed kitchen orders yet.`;

  const byDish = new Map();
  for (const o of orders) {
    for (const line of getOrderLines(o)) {
      const key = line.code || line.name;
      const cur = byDish.get(key) || {
        code: line.code,
        name: line.name,
        qty: 0,
        refs: [],
      };
      cur.qty += line.qty || 0;
      cur.refs.push(`${o.order_ref}(${o.status})`);
      byDish.set(key, cur);
    }
  }

  const lines = [...byDish.values()]
    .map((d) => `${d.code || ''} ${d.name} × ${d.qty}\n  ${[...new Set(d.refs)].join(', ')}`)
    .join('\n\n');

  const packs = orders
    .map((o) => formatOrderKitchenPackLine(o))
    .join('\n\n---\n\n');

  const t = nowIst();
  return (
    `COOK SUMMARY — ${meal.toUpperCase()}\n` +
    `${t.dateLabel} ${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')} IST\n\n` +
    `By dish:\n${lines}\n\n` +
    `Packing list:\n${packs}`
  );
}

async function menuSummary() {
  const dishes = await getDb().listAllDishes();
  const lines = dishes.map((d) => {
    const flag = d.active ? '' : ' [OFF]';
    return `${d.code} ${d.name}${flag}\n  ${categoryLabel(d.category)} · ${formatPaise(d.price_paise)}`;
  });
  // WhatsApp text limit ~4096 — truncate if needed
  let text = `MENU (${dishes.length})\n\n${lines.join('\n\n')}`;
  if (text.length > 3500) text = `${text.slice(0, 3500)}\n\n…truncated. Use OFF/ON by code.`;
  return text;
}

/**
 * @param {{ from: string, text: string, kind?: string, image?: { id: string, mime?: string, caption?: string } }} args
 * @returns {Promise<boolean>} true if handled as admin command
 */
export async function tryHandleAdmin({ from, text, kind, image }) {
  const phone = digits(from);
  if (!isAdminPhone(phone)) return false;

  const raw = String(text || '').trim();
  const lower = raw.toLowerCase();
  const db = getDb();
  const isButtonOrList = kind === 'button' || kind === 'list';

  // Inbound image → daily poster (caption POSTER… or after POSTER command)
  if (kind === 'image' && image?.id) {
    const session = await db.getSession(phone);
    const captionSlot = parsePosterSlotCommand(image.caption || raw);
    const armedSlot =
      session.state === 'await_admin_poster' && session.poster_slot
        ? String(session.poster_slot).toLowerCase()
        : null;
    const slot = captionSlot || armedSlot;
    if (!slot || !isWeekdaySlot(slot)) {
      await sendText(
        phone,
        'To save a daily poster:\n' +
          '1) Send POSTER (or POSTER monday)\n' +
          '2) Send the image\n' +
          'Or send the image with caption POSTER.',
      );
      return true;
    }
    try {
      const { buffer, mime } = await downloadWhatsAppMedia(image.id);
      if (!buffer?.length) throw new Error('Empty image download');
      const useMime = mime || image.mime || 'image/jpeg';
      const saved = savePoster(slot, {
        buffer,
        mime: useMime,
        caption: String(image.caption || '').replace(/^poster\b.*/i, '').trim(),
      });
      await db.setSession(phone, {
        state: 'idle',
        poster_slot: null,
      });
      const kb = Math.round((saved.bytes || buffer.length) / 1024);
      const dayLabel = slot.charAt(0).toUpperCase() + slot.slice(1);
      const confirm =
        `✅ Daily poster saved\n` +
        `Day: ${dayLabel}\n` +
        `Size: ${kb} KB\n\n` +
        `Customers will see this when they say Hi on ${dayLabel}.\n` +
        `Send POSTERS to check all days.`;
      console.log('Admin poster saved', { phone, slot, bytes: saved.bytes || buffer.length });
      await sendText(phone, confirm);
      try {
        await sendImageBuffer(phone, {
          buffer,
          mime: useMime,
          caption: `Saved · ${dayLabel} menu poster`,
        });
      } catch (echoErr) {
        console.error('Poster confirm image failed', echoErr.message || echoErr);
      }
    } catch (err) {
      console.error('Admin poster save failed', err.message || err);
      await sendText(phone, `❌ Poster save failed: ${err.message || err}`);
    }
    return true;
  }

  if (['admin', 'admin help', 'ops'].includes(lower)) {
    await sendText(phone, adminHelp());
    return true;
  }

  if (lower === 'posters') {
    const today = todayWeekdayIst();
    const lines = listPosters()
      .filter((p) => p.kind === 'daily')
      .map((p) => {
        const mark = p.id === today ? ' ← today' : '';
        return p.has_file
          ? `✅ ${p.title}${mark}`
          : `⬜ ${p.title}${mark}`;
      });
    await sendText(
      phone,
      `Daily posters\n${lines.join('\n')}\n\n` +
        `Send POSTER then the image, or image caption POSTER.`,
    );
    return true;
  }

  const posterSlot = parsePosterSlotCommand(lower);
  if (posterSlot) {
    if (isButtonOrList) return false;
    await db.setSession(phone, {
      state: 'await_admin_poster',
      poster_slot: posterSlot,
    });
    await sendText(
      phone,
      `Send the *${posterSlot}* menu poster image now (JPEG/PNG/WebP, max 5 MB).\n` +
        `Or cancel with Start over / Hi.`,
    );
    return true;
  }

  if (lower === 'orders') {
    await sendText(phone, `Recent orders\n\n${formatOrdersList(await db.listOrders(15))}`);
    return true;
  }

  if (lower === 'pending') {
    const pending = await db.listOrders(50).filter((o) => o.status === 'pending_payment');
    await sendText(phone, `Pending payment\n\n${formatOrdersList(pending)}`);
    return true;
  }

  // Typed MENU only — do not steal customer "Start over" button (id menu / start_over)
  if (lower === 'menu') {
    if (isButtonOrList) return false;
    await sendText(phone, await menuSummary());
    return true;
  }

  if (lower === 'feedbacks' || lower === 'feedback') {
    await sendText(phone, `Customer feedback\n\n${formatFeedbackList(await db.listFeedbacks(15))}`);
    return true;
  }

  if (lower === 'helps' || lower === 'help tickets' || lower === 'tickets') {
    const tickets = await db.listHelpTickets(15);
    if (!tickets.length) {
      await sendText(phone, 'No help tickets yet.');
      return true;
    }
    const body = tickets
      .map(
        (t) =>
          `#${t.id} · ${t.topic} · ${t.phone}\n` +
          `${t.order_ref || '—'} (${t.order_status || '—'})\n` +
          `${t.message}\n` +
          `${t.created_at}`,
      )
      .join('\n\n---\n\n');
    await sendText(phone, `Help tickets\n\n${body}`);
    return true;
  }

  if (lower === 'cook' || lower === 'cook lunch') {
    await sendText(phone, await cookSummary('lunch'));
    return true;
  }
  if (lower === 'cook dinner') {
    await sendText(phone, await cookSummary('dinner'));
    return true;
  }

  if (lower === 'catalog sync' || lower === 'catalogsync' || lower === 'sync catalog') {
    try {
      const { syncMenuToCatalog } = await import('../catalog/sync.js');
      const result = await syncMenuToCatalog();
      await sendText(
        phone,
        result.ok
          ? `✅ Catalog sync: ${result.synced} active` +
            (result.deleted ? `, ${result.deleted} removed` : '') +
            (result.skipped ? `, ${result.skipped} skipped` : '')
          : `Catalog sync issues (${result.synced} ok` +
            (result.deleted ? `, ${result.deleted} removed` : '') +
            `):\n${(result.errors || []).slice(0, 5).join('\n') || 'check WHATSAPP_CATALOG_ID / IMAGE_URL'}`,
      );
    } catch (err) {
      await sendText(phone, `Catalog sync failed: ${err.message || err}`);
    }
    return true;
  }

  if (lower === 'catalog status' || lower === 'catalog') {
    const { resolveCatalogId, resolveCatalogImageUrl } = await import('../catalog/sync.js');
    const id = await resolveCatalogId();
    const imageUrl = resolveCatalogImageUrl();
    await sendText(
      phone,
      `Catalog (dormant — not used in chat)\n` +
        `ID: ${id || '(not set)'}\n` +
        `Image: ${imageUrl}\n` +
        `Leave ID empty for Flow-only ordering.\n\n` +
        `Set ID: CATALOG SET <numeric_id>\n` +
        `Then: CATALOG SYNC`,
    );
    return true;
  }

  const catalogSet = raw.match(/^catalog\s+set\s+(\d{5,})$/i);
  if (catalogSet) {
    try {
      const { setCatalogIdOverride } = await import('../catalog/sync.js');
      const id = await setCatalogIdOverride(catalogSet[1]);
      await sendText(
        phone,
        `✅ Catalog ID saved: ${id}\n` +
          `Also add WHATSAPP_CATALOG_ID=${id} to .env for health checks.\n` +
          `Next: CATALOG SYNC`,
      );
    } catch (err) {
      await sendText(phone, `Catalog set failed: ${err.message || err}`);
    }
    return true;
  }

  const onOff = raw.match(/^(on|off)\s+([A-Za-z0-9_-]+)$/i);
  if (onOff) {
    const active = onOff[1].toLowerCase() === 'on';
    const dish = await db.setDishActive(onOff[2], active);
    if (!dish) {
      await sendText(phone, `Unknown code ${onOff[2].toUpperCase()}`);
      return true;
    }
    await sendText(phone, `✅ ${dish.code} ${dish.name} is now ${active ? 'ON' : 'OFF'}`);
    return true;
  }

  const cmd = raw.match(/^(paid|ready|out|done|cancelord)\s+([A-Za-z0-9_-]+)$/i);
  if (!cmd) return false;

  const action = cmd[1].toLowerCase();
  const ref = cmd[2].toUpperCase();
  const statusMap = {
    paid: 'paid',
    ready: 'out_for_delivery',
    out: 'out_for_delivery',
    done: 'delivered',
    cancelord: 'cancelled',
  };
  const status = statusMap[action];
  const result = await applyOrderStatus(ref, status, {
    notifyCustomer: true,
    extra: status === 'paid' ? { paid_via: 'admin' } : {},
  });

  if (!result.ok) {
    await sendText(phone, `❌ ${result.error}`);
    return true;
  }
  if (result.skipped) {
    await sendText(phone, `Order ${ref} already ${status}.`);
    return true;
  }
  await sendText(
    phone,
    `✅ ${ref} → ${status}\nCustomer notified.\n\n${formatOrdersList([result.order])}`,
  );
  return true;
}
