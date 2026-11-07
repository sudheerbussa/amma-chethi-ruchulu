import { config } from '../config.js';
import { getDb } from '../db.js';
import { nowIst } from '../cutoffs.js';
import { sendText } from '../whatsapp.js';

const MS_24H = 24 * 3600 * 1000;
const MS_4H = 4 * 3600 * 1000;
const MS_8H = 8 * 3600 * 1000;

/** IST slots — auto-remind before the 24h admin care window closes. */
export const ADMIN_PING_SLOTS = [
  { id: 'morning', hour: 8, minute: 30 },
  { id: 'evening', hour: 19, minute: 30 },
];

function reminderText(slotId) {
  const name = config.businessName;
  if (slotId === 'evening') {
    return (
      `⏰ ${name} — admin reminder\n\n` +
      `If you have not messaged *this* WhatsApp number today, send *Hi* or *ADMIN* now.\n\n` +
      `This keeps *free* WhatsApp alerts for new orders (24-hour window).\n\n` +
      `— Kitchen bot`
    );
  }
  return (
    `☀️ ${name} — admin reminder\n\n` +
    `Send *Hi* or *ADMIN* to *this* WhatsApp number once today.\n\n` +
    `Keeps *free* order alerts on WhatsApp (24h window).\n\n` +
    `— Kitchen bot`
  );
}

function ageMs(lastAt) {
  if (!lastAt) return Infinity;
  const t = new Date(lastAt).getTime();
  return Number.isFinite(t) ? Date.now() - t : Infinity;
}

export async function getAdminPingStatus() {
  const db = getDb();
  const admins = config.adminPhones || [];
  const rows = [];
  for (const phone of admins) {
    const lastAt = (await db.getLastInboundAt?.(phone)) || null;
    const age = ageMs(lastAt);
    const within24h = age < MS_24H;
    const hoursLeft = within24h ? Math.max(0, (MS_24H - age) / 3600000) : 0;
    rows.push({
      phone,
      last_inbound_at: lastAt,
      within_24h: within24h,
      hours_left: Math.round(hoursLeft * 10) / 10,
      needs_ping: !within24h || age >= MS_8H,
    });
  }
  return {
    admins: rows,
    enabled: config.adminPingRemindersEnabled !== false,
    schedule: ADMIN_PING_SLOTS.map((s) => ({ ...s, label: `${s.hour}:${String(s.minute).padStart(2, '0')} IST` })),
    note:
      'Order alerts to admin phones are free only inside Meta’s 24h window after each admin messages the bot. Food and Fresh are separate WhatsApp numbers — each needs its own Hi if both send alerts.',
  };
}

function shouldRemindAdmin(lastAt, slotId, force) {
  if (force) return true;
  const age = ageMs(lastAt);
  if (age < MS_4H) return false;
  if (slotId === 'evening' && age < MS_8H) return false;
  return true;
}

/**
 * @param {{ force?: boolean, slot?: string }} opts
 * force=true → both admins now (manual from dashboard)
 */
export async function sendAdminPingReminders({ force = false, slot = 'manual' } = {}) {
  const db = getDb();
  const today = nowIst().isoDate;
  const slotId = String(slot || 'manual');
  const body = reminderText(slotId);
  const results = [];

  for (const phone of config.adminPhones || []) {
    const dedupeKey = `admin_ping_${phone}_${today}_${slotId}`;
    if (!force) {
      const already = String((await db.getMeta(dedupeKey)) || '').trim();
      // Empty = cleared after failed send; non-empty claim/ISO = skip.
      if (already) {
        results.push({ phone, ok: true, skipped: true, reason: 'already_sent_today' });
        continue;
      }
      // Claim before send so a second tick in the same minute cannot double-send.
      await db.setMeta(dedupeKey, `claim:${new Date().toISOString()}`);
    }

    const lastAt = (await db.getLastInboundAt?.(phone)) || null;
    if (!shouldRemindAdmin(lastAt, slotId, force)) {
      results.push({ phone, ok: true, skipped: true, reason: 'recently_pinged' });
      continue;
    }

    try {
      await sendText(phone, body);
      if (!force) await db.setMeta(dedupeKey, new Date().toISOString());
      results.push({ phone, ok: true, skipped: false });
    } catch (err) {
      // Allow retry later today if send failed (e.g. outside 24h window).
      if (!force) {
        try {
          await db.setMeta(dedupeKey, '');
        } catch {
          /* ignore */
        }
      }
      results.push({
        phone,
        ok: false,
        skipped: false,
        error: err.message || 'send failed',
      });
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  return {
    slot: slotId,
    force,
    results,
    note:
      'If send failed, that admin’s 24h window may be closed — they must message the bot first, then retry.',
  };
}

/** Call every minute from index.js — fires morning/evening IST slots once per day. */
export async function runAdminPingReminderSchedule() {
  if (config.adminPingRemindersEnabled === false) return;
  const t = nowIst();
  const db = getDb();
  for (const slot of ADMIN_PING_SLOTS) {
    if (t.hour !== slot.hour || t.minute !== slot.minute) continue;
    // Slot lock: interval can tick twice in the same IST minute.
    const slotLock = `admin_ping_slot_${t.isoDate}_${slot.id}`;
    try {
      if (await db.getMeta(slotLock)) continue;
      await db.setMeta(slotLock, new Date().toISOString());
    } catch (err) {
      console.error('Admin ping slot lock failed', slot.id, err);
      continue;
    }
    try {
      const out = await sendAdminPingReminders({ slot: slot.id, force: false });
      const sent = out.results.filter((r) => r.ok && !r.skipped);
      if (sent.length) {
        console.log(`Admin ping reminders (${slot.id}):`, sent.map((r) => r.phone).join(', '));
      }
    } catch (err) {
      console.error('Admin ping schedule failed', slot.id, err);
    }
  }
}
