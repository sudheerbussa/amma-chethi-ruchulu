import { getDb } from '../db.js';
import { config } from '../config.js';
import { sendText } from '../whatsapp.js';
import { applyOrderStatus, formatOrdersList, formatFeedbackList } from '../orders/status.js';
import { categoryLabel } from '../menu.js';
import { nowIst } from '../cutoffs.js';
import { formatLinesText, getOrderLines } from '../orders/cart.js';

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

function adminHelp() {
  return (
    `Admin — ${config.businessName}\n\n` +
    `ORDERS / PENDING\n` +
    `PAID|READY|OUT|DONE|CANCELORD <ref>\n` +
    `COOK [lunch|dinner] — kitchen summary\n` +
    `MENU — list dishes + stock\n` +
    `STOCK <code> <max> — set max portions\n` +
    `OFF <code> / ON <code> — hide/show dish\n` +
    `FEEDBACKS — recent customer ratings\n` +
    `HELPS — customer help tickets\n` +
    `ADMIN — this help\n\n` +
    `Dashboard: http://127.0.0.1:${config.port}/admin`
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
    .map(
      (o) =>
        `${o.order_ref} · ${formatLinesText(getOrderLines(o))}\n` +
        `${o.phone}\n${o.address}\n` +
        (o.service_label || o.service_date ? `Service: ${o.service_label || o.service_date}\n` : '') +
        `Pay ${formatPaise(o.total_paise)} · ${o.status}`,
    )
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
    const left = Math.max(0, d.max_portions - d.portions_sold);
    const flag = d.active ? '' : ' [OFF]';
    return `${d.code} ${d.name}${flag}\n  ${categoryLabel(d.category)} · ${formatPaise(d.price_paise)} · left ${left}/${d.max_portions}`;
  });
  // WhatsApp text limit ~4096 — truncate if needed
  let text = `MENU STOCK (${dishes.length})\n\n${lines.join('\n\n')}`;
  if (text.length > 3500) text = `${text.slice(0, 3500)}\n\n…truncated. Use STOCK/OFF/ON by code.`;
  return text;
}

/**
 * @returns {Promise<boolean>} true if handled as admin command
 */
export async function tryHandleAdmin({ from, text }) {
  const phone = digits(from);
  if (!isAdminPhone(phone)) return false;

  const raw = String(text || '').trim();
  const lower = raw.toLowerCase();
  const db = getDb();

  if (['admin', 'admin help', 'ops'].includes(lower)) {
    await sendText(phone, adminHelp());
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

  if (lower === 'menu') {
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

  const stock = raw.match(/^stock\s+([A-Za-z0-9_-]+)\s+(\d+)$/i);
  if (stock) {
    const dish = await db.setDishStock(stock[1], Number(stock[2]));
    if (!dish) {
      await sendText(phone, `Unknown code ${stock[1].toUpperCase()}`);
      return true;
    }
    const left = dish.max_portions - dish.portions_sold;
    await sendText(
      phone,
      `✅ ${dish.code} max=${dish.max_portions} (sold ${dish.portions_sold}, left ${left})`,
    );
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
    ready: 'preparing',
    out: 'out_for_delivery',
    done: 'delivered',
    cancelord: 'cancelled',
  };
  const status = statusMap[action];
  const result = await applyOrderStatus(ref, status, { notifyCustomer: true });

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
