import { isSuppressed } from '../marketing/store.js';
import { mountMarketing } from '../marketing/routes.js';
import { getDb } from '../db.js';
import { buildBuyList, buyListText, sendBuyList, tomorrowIso } from '../orders/buy-list.js';
import { config } from '../config.js';
import { applyOrderStatus } from '../orders/status.js';
import { createManualOrder } from '../orders/create-manual.js';
import { resolveFromRoot } from '../paths.js';
import { CATEGORIES } from '../menu.js';
import { sendText } from '../whatsapp.js';
import { mountReferralAdmin } from './referral-routes.js';
import { getAdminPingStatus, sendAdminPingReminders } from './ping-reminder.js';
import express from 'express';
import { deletePoster, getPoster, isPosterSlot, listPosters, savePoster, sendImageBuffer, sendMenuPosters } from '../posters.js';
import {
  loadPosterAutoSettings,
  savePosterAutoSettings,
} from '../poster-settings.js';
import { formatMenuPriceChunks, hoursAndRangeBlurb } from '../menu-text.js';
import { sendOrderToRiders } from '../ops-notify.js';
import { reviseOrderShortSupply } from '../orders/revise.js';
import {
  nowIst,
  listDaySlotHours,
  enrichSlotsWithCounts,
  SLOT_OCCUPYING_STATUSES,
} from '../cutoffs.js';
import {
  csvToPriceBoardPatches,
  mergePriceBoardImport,
  priceBoardToCsv,
} from '../price-board-io.js';

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : req.query.token;
  if (!config.adminToken || token !== config.adminToken) {
    res.status(401).json({ error: "Unauthorized \u2014 login required" });
    return;
  }
  next();
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
const WA_SESSION_NOTE = "Free-form WhatsApp text only delivers inside Meta\u2019s 24-hour customer care window (after the customer last messaged your bot). Outside that window you need an approved template.";
function formatCustomerMessage(message, { personal = true } = {}) {
  const text = String(message || "").trim();
  if (personal) return text.slice(0, 4096);
  return (`\u{1F4E2} ${config.businessName}

` + text).slice(0, 1024);
}
async function sendCustomerMessage(phone, message, { personal = true } = {}) {
  const normalized = String(phone || "").replace(/\D/g, "");
  if (normalized.length < 10) {
    throw new Error("Invalid phone");
  }
  const body = formatCustomerMessage(message, { personal });
  if (body.length < 1) {
    throw new Error("Message is empty");
  }
  await sendText(normalized, body);
  return { phone: normalized, body, personal };
}
function todayIsoIst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(/* @__PURE__ */ new Date());
}
function isSameDayIst(iso2) {
  if (!iso2) return false;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date(iso2)) === todayIsoIst();
  } catch {
    return false;
  }
}
export function mountAdmin(app) {
  mountReferralAdmin(app, auth);
  mountMarketing(app, auth);

  app.get("/admin", (_req, res) => {
    res.sendFile(resolveFromRoot("public", "admin-hub.html"));
  });
  app.get("/admin/app", (_req, res) => {
    res.sendFile(resolveFromRoot("public", "admin.html"));
  });
  app.get("/admin/api/hub-config", (_req, res) => {
    res.json({
      ok: true,
      foodAppUrl: config.adminFoodAppUrl,
      freshAppUrl: config.adminFreshAppUrl,
      hubUrl: config.adminHubUrl,
      product: config.adminHubProduct
    });
  });
  app.post("/admin/api/login", (req, res) => {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    if (!config.adminToken) {
      res.status(503).json({ error: "Admin login not configured (ADMIN_TOKEN)" });
      return;
    }
    if (username !== config.adminUser || password !== config.adminToken) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }
    res.json({
      ok: true,
      username: config.adminUser,
      token: config.adminToken,
      business: config.businessName
    });
  });
  app.get("/admin/api/posters", auth, async (_req, res) => {
    const auto = await loadPosterAutoSettings(getDb());
    res.json({ ok: true, slots: listPosters(), auto });
  });
  app.put("/admin/api/posters/auto", auth, async (req, res) => {
    try {
      const auto = await savePosterAutoSettings(getDb(), req.body || {});
      res.json({ ok: true, auto });
    } catch (err) {
      res.status(400).json({ error: err.message || "Could not save poster auto settings" });
    }
  });
  app.get("/admin/api/posters/:slot/image", auth, (req, res) => {
    const slot = String(req.params.slot || "");
    if (!isPosterSlot(slot)) {
      res.status(400).json({ error: "Unknown poster" });
      return;
    }
    const poster = getPoster(slot);
    if (!poster?.has_file || !poster.file) {
      res.status(404).json({ error: "No poster uploaded" });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.type(poster.mime || "image/jpeg");
    res.sendFile(poster.file);
  });
  app.put(
    "/admin/api/posters/:slot",
    auth,
    express.raw({
      type: ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/octet-stream"],
      limit: "5mb"
    }),
    (req, res) => {
      try {
        const slot = String(req.params.slot || "");
        if (!isPosterSlot(slot)) {
          res.status(400).json({ error: "Unknown poster" });
          return;
        }
        const mime = String(req.headers["content-type"] || "image/jpeg").split(";")[0].trim();
        const caption = String(req.query.caption || req.headers["x-poster-caption"] || "");
        const saved = savePoster(slot, {
          buffer: req.body,
          mime,
          caption
        });
        res.json({
          ok: true,
          poster: {
            id: saved.id,
            has_file: saved.has_file,
            caption: saved.caption,
            mime: saved.mime,
            updated_at: saved.updated_at,
            bytes: saved.bytes
          }
        });
      } catch (err) {
        res.status(400).json({ error: err.message || "Upload failed" });
      }
    }
  );
  app.delete("/admin/api/posters/:slot", auth, (req, res) => {
    const slot = String(req.params.slot || "");
    if (!isPosterSlot(slot)) {
      res.status(400).json({ error: "Unknown poster" });
      return;
    }
    const poster = deletePoster(slot);
    res.json({
      ok: true,
      poster: {
        id: poster.id,
        has_file: poster.has_file,
        caption: poster.caption,
        mime: poster.mime,
        updated_at: poster.updated_at,
        bytes: poster.bytes
      }
    });
  });
  app.get("/admin/api/overview", auth, async (_req, res) => {
    const db = getDb();
    const orders = await db.listOrders(300);
    const feedbacks = await db.listFeedbacks(30);
    const tickets = await db.listHelpTickets(30);
    const customers = await db.listCustomers(500);
    const today = todayIsoIst();
    const paidLike = /* @__PURE__ */ new Set(["paid", "preparing", "out_for_delivery", "delivered"]);
    let revenueToday = 0;
    let ordersToday = 0;
    let pendingPayment = 0;
    let kitchen = 0;
    let out = 0;
    for (const o of orders) {
      if (isSameDayIst(o.created_at) || o.service_date === today) {
        ordersToday += 1;
        if (paidLike.has(o.status)) revenueToday += o.total_paise || 0;
      }
      if (o.status === "pending_payment") pendingPayment += 1;
      if (o.status === "paid" || o.status === "preparing") kitchen += 1;
      if (o.status === "out_for_delivery") out += 1;
    }
    const openHelps = tickets.filter((t) => (t.ticket_status || "open") !== "closed").length;
    res.json({
      business: config.businessName,
      driver: db.driver || "json",
      today,
      stats: {
        revenue_today_paise: revenueToday,
        orders_today: ordersToday,
        pending_payment: pendingPayment,
        kitchen,
        out_for_delivery: out,
        customers: customers.length,
        open_helps: openHelps,
        avg_rating: feedbacks.length > 0 ? Number(
          (feedbacks.reduce((s, f) => s + (Number(f.average_rating) || 0), 0) / feedbacks.length).toFixed(2)
        ) : null
      },
      categories: CATEGORIES
    });
  });
  app.get("/admin/api/admins/ping-status", auth, async (_req, res) => {
    res.json(await getAdminPingStatus());
  });
  app.post("/admin/api/admins/ping-reminder", auth, async (req, res) => {
    const force = req.body?.force !== false;
    const slot = String(req.body?.slot || "manual");
    const out = await sendAdminPingReminders({ force, slot });
    res.json({ ok: true, ...out });
  });
  app.get("/admin/api/orders", auth, async (req, res) => {
    const limit = Math.min(500, Math.max(20, Number(req.query.limit) || 200));
    res.json({
      business: config.businessName,
      orders: await getDb().listOrders(limit)
    });
  });
  app.post("/admin/api/orders", auth, async (req, res) => {
    try {
      const result = await createManualOrder(req.body || {});
      if (!result.ok) {
        res.status(400).json({ error: result.error || "Could not create order" });
        return;
      }
      res.json(result);
    } catch (err) {
      console.error("Manual order create failed", err);
      res.status(500).json({ error: err.message || "Manual order failed" });
    }
  });
  app.get("/admin/api/dishes", auth, async (_req, res) => {
    res.json({ dishes: await getDb().listAllDishes(), categories: CATEGORIES });
  });

  app.get("/admin/api/price-board", auth, async (req, res) => {
    try {
      const day = String(req.query.date || "").slice(0, 10) || undefined;
      const data = await getDb().listPriceBoard(day);
      res.json(data);
    } catch (err) {
      console.error("price-board get failed", err);
      res.status(500).json({ error: err.message || "Could not load price board" });
    }
  });

  app.get("/admin/api/price-board/export.csv", auth, async (req, res) => {
    try {
      const day = String(req.query.date || "").slice(0, 10) || nowIst().isoDate;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
        res.status(400).json({ error: "date required (YYYY-MM-DD)" });
        return;
      }
      const data = await getDb().listPriceBoard(day);
      const csv = priceBoardToCsv(data.rows || [], { date: day });
      const filename = `ACR-Fresh-prices-${day}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (err) {
      console.error("price-board export failed", err);
      res.status(500).json({ error: err.message || "Export failed" });
    }
  });

  app.post("/admin/api/price-board/import", auth, async (req, res) => {
    try {
      const body = req.body || {};
      const day = String(body.date || body.observed_on || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
        res.status(400).json({ error: "date required (YYYY-MM-DD)" });
        return;
      }
      const csvText = String(body.csv || body.text || '');
      if (!csvText.trim()) {
        res.status(400).json({ error: "csv text required (upload the downloaded Excel/CSV file)" });
        return;
      }
      const publish = body.publish !== false;
      const patches = csvToPriceBoardPatches(csvText);
      const current = await getDb().listPriceBoard(day);
      const merged = mergePriceBoardImport(current.rows || [], patches);
      if (!merged.rows.length) {
        res.status(400).json({ error: "No rows to import", errors: merged.errors });
        return;
      }
      await getDb().upsertPriceBoardRows(day, merged.rows);
      let synced = null;
      if (publish) {
        synced = await getDb().syncCatalogFromPriceBoard(day, {
          deactivateMissing: true,
          applyPrices: true,
        });
      }
      const board = synced?.board || (await getDb().listPriceBoard(day));
      res.json({
        ok: true,
        observed_on: day,
        imported: patches.length,
        updated: merged.updated,
        created: merged.created,
        errors: merged.errors,
        published: publish,
        sync: synced
          ? {
              created: synced.created,
              linked: synced.linked,
              updated_prices: synced.updated_prices,
              deactivated: synced.deactivated,
            }
          : null,
        ...board,
      });
    } catch (err) {
      console.error("price-board import failed", err);
      res.status(400).json({ error: err.message || "Import failed" });
    }
  });

  app.put("/admin/api/price-board", auth, async (req, res) => {
    try {
      const body = req.body || {};
      const day = String(body.date || body.observed_on || "").slice(0, 10);
      const rows = Array.isArray(body.rows) ? body.rows : [];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
        res.status(400).json({ error: "date required (YYYY-MM-DD)" });
        return;
      }
      await getDb().upsertPriceBoardRows(day, rows);
      // Pricing is catalog SOT — push board → Menu / WA dishes on every save.
      const synced = await getDb().syncCatalogFromPriceBoard(day, {
        deactivateMissing: true,
        applyPrices: true,
      });
      res.json({
        ...synced.board,
        sync: {
          created: synced.created,
          linked: synced.linked,
          updated_prices: synced.updated_prices,
          deactivated: synced.deactivated,
        },
      });
    } catch (err) {
      console.error("price-board save failed", err);
      res.status(500).json({ error: err.message || "Could not save price board" });
    }
  });

  app.post("/admin/api/price-board/copy", auth, async (req, res) => {
    try {
      const from = String(req.body?.from || "").slice(0, 10);
      const to = String(req.body?.to || "").slice(0, 10);
      const data = await getDb().copyPriceBoardDay(from, to);
      res.json(data);
    } catch (err) {
      res.status(400).json({ error: err.message || "Copy failed" });
    }
  });

  app.post("/admin/api/price-board/add-item", auth, async (req, res) => {
    try {
      const body = req.body || {};
      const day = String(body.date || body.observed_on || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
        res.status(400).json({ error: "date required (YYYY-MM-DD)" });
        return;
      }
      const result = await getDb().addPriceBoardItem(day, body);
      let catalog = null;
      try {
        const { syncMenuToCatalog } = await import("../catalog/sync.js");
        if (process.env.WHATSAPP_CATALOG_ID) {
          catalog = await syncMenuToCatalog();
        }
      } catch (err) {
        catalog = { ok: false, error: err.message || String(err) };
      }
      res.json({
        ok: true,
        row: result.row,
        created: result.created,
        linked: result.linked,
        updated_prices: result.updated_prices,
        catalog,
        ...result.board,
      });
    } catch (err) {
      console.error("price-board add-item failed", err);
      res.status(400).json({ error: err.message || "Could not add item" });
    }
  });

  app.post("/admin/api/price-board/apply-suggested", auth, async (req, res) => {
    try {
      const day = String(req.body?.date || req.body?.observed_on || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
        res.status(400).json({ error: "date required (YYYY-MM-DD)" });
        return;
      }
      const result = await getDb().applySuggestedAcrPrices(day, { onlyLinked: true });
      let catalog = null;
      try {
        const { syncMenuToCatalog } = await import('../catalog/sync.js');
        if (process.env.WHATSAPP_CATALOG_ID) {
          catalog = await syncMenuToCatalog();
        }
      } catch (err) {
        catalog = { ok: false, error: err.message || String(err) };
      }
      const updated = result.updated || [];
      res.json({
        ok: true,
        updated,
        count: updated.length,
        created: result.created || [],
        linked: result.linked || [],
        deactivated: result.deactivated || [],
        catalog,
        ...result.board,
      });
    } catch (err) {
      console.error("apply-suggested failed", err);
      res.status(500).json({ error: err.message || "Apply failed" });    }
  });

  app.post("/admin/api/catalog/sync", auth, async (_req, res) => {
    try {
      const { syncMenuToCatalog } = await import('../catalog/sync.js');
      const result = await syncMenuToCatalog();
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message || String(err) });
    }
  });
  app.get("/admin/api/menu/text", auth, async (_req, res) => {
    const dishes = await getDb().listAllDishes();
    const chunks = formatMenuPriceChunks(dishes, { businessName: config.businessName });
    const hours = hoursAndRangeBlurb();
    res.json({
      ok: true,
      hours,
      chunks,
      text: [hours, ...chunks].join("\n\n\u2014\u2014\u2014\n\n"),
      note: WA_SESSION_NOTE
    });
  });
  app.post("/admin/api/dishes/:code/active", auth, async (req, res) => {
    const dish = await getDb().setDishActive(req.params.code, Boolean(req.body?.active));
    if (!dish) {
      res.status(404).json({ error: "Dish not found" });
      return;
    }
    res.json({ dish });
  });
  app.post("/admin/api/dishes", auth, async (req, res) => {
    const body = req.body || {};
    const code = String(body.code || "").trim().toUpperCase();
    if (!/^[A-Z0-9]{2,8}$/.test(code)) {
      res.status(400).json({ error: "code must be 2\u20138 letters/numbers (e.g. V01)" });
      return;
    }
    if (!body.name || String(body.name).trim().length < 2) {
      res.status(400).json({ error: "name required" });
      return;
    }
    const price = Number(body.price_paise ?? Math.round(Number(body.price_rupees || 0) * 100));
    if (!Number.isFinite(price) || price < 0) {
      res.status(400).json({ error: "invalid price" });
      return;
    }
    let cook_name = String(body.cook_name || "").trim().slice(0, 60);
    let amma_id = body.amma_id ? String(body.amma_id).trim() : null;
    if (amma_id) {
      const a = await getDb().getAmma(amma_id);
      if (a) cook_name = a.name;
    } else if (cook_name) {
      const list = await getDb().listAmmas();
      const hit = list.find((a) => a.name.toLowerCase() === cook_name.toLowerCase());
      if (hit) amma_id = hit.id;
      else {
        const created = await getDb().upsertAmma({ name: cook_name });
        amma_id = created?.id || null;
      }
    } else {
      cook_name = "Amma Kitchen";
    }
    const dish = await getDb().upsertDish({
      code,
      name: body.name,
      category: body.category || "veg",
      meal: body.meal || "both",
      price_paise: price,
      active: body.active !== false,
      note: body.note || null,
      advance_only: Boolean(body.advance_only),
      cook_name,
      amma_id
    });
    // Live price is dishes.price_paise (Flow / checkout / menu text). Board ACR Sell synced inside upsertDish.
    let catalog = null;
    try {
      const { syncMenuToCatalog } = await import('../catalog/sync.js');
      if (process.env.WHATSAPP_CATALOG_ID) {
        catalog = await syncMenuToCatalog();
      }
    } catch (err) {
      catalog = { ok: false, error: err.message || String(err) };
    }
    res.json({ dish, catalog });
  });
  app.get("/admin/api/ammas", auth, async (_req, res) => {
    const list = await getDb().listAmmasWithDishes();
    res.json({ ammas: list });
  });
  app.get("/admin/api/offers", auth, async (_req, res) => {
    const offers = await getDb().listOffers();
    res.json({
      offers,
      kinds: [
        { id: "flat_discount", label: "Above \u20B9X order \u2192 \u20B9Y off" },
        { id: "free_delivery", label: "Above \u20B9X order \u2192 free delivery" },
        { id: "qty_bundle", label: "Every N qty of item \u2192 \u20B9Y off" }
      ],
      note: "Enabled offers apply at checkout. Leave empty if none. Flat + free delivery stack when both qualify."
    });
  });
  app.put("/admin/api/offers", auth, async (req, res) => {
    const body = req.body || {};
    const raw = Array.isArray(body.offers) ? body.offers : null;
    if (!raw) {
      res.status(400).json({ error: "offers array required" });
      return;
    }
    const offers = await getDb().saveOffers(raw);
    res.json({ ok: true, offers });
  });
  app.post("/admin/api/offers", auth, async (req, res) => {
    const body = req.body || {};
    const list = await getDb().listOffers();
    const next = {
      id: body.id || void 0,
      kind: body.kind,
      enabled: body.enabled !== false,
      title: body.title,
      above_paise: body.above_paise != null ? Math.round(Number(body.above_paise)) : body.above_rupees != null ? Math.round(Number(body.above_rupees) * 100) : 0,
      discount_paise: body.discount_paise != null ? Math.round(Number(body.discount_paise)) : body.discount_rupees != null ? Math.round(Number(body.discount_rupees) * 100) : 0,
      dish_code: body.dish_code || body.dishCode || void 0,
      every_qty: body.every_qty != null ? Math.round(Number(body.every_qty)) : body.everyQty != null ? Math.round(Number(body.everyQty)) : void 0,
      valid_date: body.valid_date || body.validDate || void 0
    };
    const idx = list.findIndex((o) => o.id === next.id);
    if (idx >= 0) list[idx] = { ...list[idx], ...next };
    else list.push(next);
    const offers = await getDb().saveOffers(list);
    res.json({ ok: true, offers });
  });
  app.post("/admin/api/offers/:id/toggle", auth, async (req, res) => {
    const id = String(req.params.id || "");
    const list = await getDb().listOffers();
    const o = list.find((x) => x.id === id);
    if (!o) {
      res.status(404).json({ error: "Offer not found" });
      return;
    }
    const want = req.body?.enabled != null ? Boolean(req.body.enabled) : !o.enabled;
    o.enabled = want;
    const offers = await getDb().saveOffers(list);
    res.json({ ok: true, offers });
  });
  app.delete("/admin/api/offers/:id", auth, async (req, res) => {
    const id = String(req.params.id || "");
    const list = (await getDb().listOffers()).filter((o) => o.id !== id);
    const offers = await getDb().saveOffers(list);
    res.json({ ok: true, offers });
  });
  app.get("/admin/api/delivery-settings", auth, async (_req, res) => {
    const today = nowIst().isoDate;
    const settings = await getDb().getDeliverySettings();
    const effective = await getDb().getEffectiveDeliverySettings(today);
    res.json({
      settings,
      effective,
      today,
      zones: [
        { id: "z1", title: "0\u20133 km", fee_paise: 3e3 },
        { id: "z2", title: "3\u20136 km", fee_paise: 4500 },
        { id: "z3", title: "Above 6 km", fee_paise: 6e3 }
      ],
      note: "Distance = ask customer km band. Flat = one fee for all Tenali that day (no km picker). Free-delivery offers still zero the fee when food threshold met. Tracking: set Maps URL + contact + ETA under Delivery tracking \u2014 sent when Out for delivery."
    });
  });
  app.put("/admin/api/delivery-settings", auth, async (req, res) => {
    const body = req.body || {};
    const today = nowIst().isoDate;
    const current = await getDb().getDeliverySettings();
    let flatPaise = current.flat_paise;
    if (body.flat_paise != null) flatPaise = Math.round(Number(body.flat_paise));
    else if (body.flat_rupees != null) flatPaise = Math.round(Number(body.flat_rupees) * 100);
    let mode = String(body.mode || current.mode || "distance").toLowerCase();
    if (mode !== "flat" && mode !== "distance") mode = "distance";
    let day_override = current.day_override;
    if (body.clear_day_override === true) {
      day_override = null;
    } else if (body.apply_only_today === true || body.day_override) {
      const d = body.day_override || {};
      const ovMode = String(d.mode || body.mode || mode).toLowerCase() === "flat" ? "flat" : "distance";
      let ovFlat = flatPaise;
      if (d.flat_paise != null) ovFlat = Math.round(Number(d.flat_paise));
      else if (d.flat_rupees != null) ovFlat = Math.round(Number(d.flat_rupees) * 100);
      else if (body.flat_rupees != null) ovFlat = Math.round(Number(body.flat_rupees) * 100);
      day_override = {
        date: String(d.date || body.override_date || today).slice(0, 10),
        mode: ovMode,
        flat_paise: ovFlat
      };
    } else if (body.day_override === null) {
      day_override = null;
    }
    const next = {
      mode: body.set_default === false && body.apply_only_today ? current.mode : mode,
      flat_paise: body.set_default === false && body.apply_only_today ? current.flat_paise : flatPaise,
      day_override,
      track_map_url: body.track_map_url != null ? String(body.track_map_url).trim() : current.track_map_url || "",
      delivery_contact: body.delivery_contact != null ? String(body.delivery_contact).replace(/\D/g, "") : current.delivery_contact || "",
      eta_minutes_z1: body.eta_minutes_z1 != null ? body.eta_minutes_z1 : current.eta_minutes_z1,
      eta_minutes_z2: body.eta_minutes_z2 != null ? body.eta_minutes_z2 : current.eta_minutes_z2,
      eta_minutes_z3: body.eta_minutes_z3 != null ? body.eta_minutes_z3 : current.eta_minutes_z3,
      eta_minutes_flat: body.eta_minutes_flat != null ? body.eta_minutes_flat : current.eta_minutes_flat
    };
    if (body.apply_only_today === true && body.set_default !== true) {
      next.mode = current.mode;
      next.flat_paise = current.flat_paise;
      next.day_override = {
        date: today,
        mode,
        flat_paise: flatPaise
      };
    }
    const settings = await getDb().saveDeliverySettings(next);
    const effective = await getDb().getEffectiveDeliverySettings(today);
    res.json({ ok: true, settings, effective, today });
  });
  /** Market buying list for a delivery day (default tomorrow). */
  app.get('/admin/api/buy-list', auth, async (req, res) => {
    try {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || '')) ? req.query.date : tomorrowIso();
      const list = await buildBuyList(date);
      res.json({ ok: true, ...list, text: buyListText(list) });
    } catch (err) {
      console.error('[admin] buy-list', err);
      res.status(500).json({ ok: false, error: 'Could not build buying list' });
    }
  });

  app.post('/admin/api/buy-list/send', auth, async (req, res) => {
    try {
      const raw = String(req.body?.date || '');
      const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : tomorrowIso();
      const out = await sendBuyList(date);
      res.json({ ok: true, date, sent: out.sent, failed: out.failed, text: out.text });
    } catch (err) {
      console.error('[admin] buy-list send', err);
      res.status(500).json({ ok: false, error: 'Could not send buying list' });
    }
  });

  async function buildSlotsSnapshot(isoDate) {
    const hours = listDaySlotHours(isoDate);
    const ids = hours.map((s) => s.id);
    let counts = {};
    try {
      if (typeof getDb().countOrdersByDeliverySlot === "function") {
        counts = await getDb().countOrdersByDeliverySlot(ids, SLOT_OCCUPYING_STATUSES);
      }
    } catch {
      counts = {};
    }
    const slots = enrichSlotsWithCounts(hours, counts);
    const open = slots.filter((s) => s.available).length;
    const locked = slots.filter((s) => s.locked).length;
    const booked = slots.reduce((n, s) => n + (Number(s.booked) || 0), 0);
    return {
      isoDate,
      open,
      locked,
      booked,
      capacity_per_slot: slots[0]?.capacity ?? null,
      slots
    };
  }
  app.get("/admin/api/ops-settings", auth, async (_req, res) => {
    const today = nowIst().isoDate;
    const settings = await getDb().getOpsSettings();
    const minOrderPaise = await getDb().getMinOrderPaise(today);
    const slotsToday = await buildSlotsSnapshot(today);
    res.json({
      settings,
      today,
      slots_today: slotsToday,
      effective: {
        min_order_paise: minOrderPaise,
        min_order_rupees: Math.round(minOrderPaise) / 100,
        slot_open_hour: settings.slot_open_hour,
        slot_close_hour: settings.slot_close_hour,
        slot_capacity: settings.slot_capacity,
        slot_lead_minutes: settings.slot_lead_minutes,
        lunch_cutoff_hour: settings.lunch_cutoff_hour,
        dinner_cutoff_hour: settings.dinner_cutoff_hour,
        lunch_cutoff_minute: settings.lunch_cutoff_minute,
        dinner_cutoff_minute: settings.dinner_cutoff_minute,
        source: settings.min_order_day_override?.date === today ? "day_override" : "default"
      },
      note: "Min order is item total before checkout. Delivery uses hourly slots (IST). When a slot reaches capacity, it locks for new orders. Lead minutes = how far ahead customers must book."
    });
  });
  app.put("/admin/api/ops-settings", auth, async (req, res) => {
    const body = req.body || {};
    const today = nowIst().isoDate;
    const current = await getDb().getOpsSettings();
    const parseMin = () => {
      if (body.min_order_paise != null) return Math.max(0, Math.round(Number(body.min_order_paise) || 0));
      if (body.min_order_rupees != null) {
        return Math.max(0, Math.round(Number(body.min_order_rupees) * 100) || 0);
      }
      return null;
    };
    const requestedMin = parseMin();
    let min_order_paise = current.min_order_paise;
    let min_order_day_override = current.min_order_day_override;
    let launch_iso = current.launch_iso;
    let slot_open_hour = current.slot_open_hour ?? current.lunch_cutoff_hour ?? 8;
    let slot_close_hour = current.slot_close_hour ?? current.dinner_cutoff_hour ?? 20;
    let slot_capacity = current.slot_capacity ?? 0;
    let slot_lead_minutes = current.slot_lead_minutes ?? 60;
    let lunch_cutoff_minute = current.lunch_cutoff_minute ?? 0;
    let dinner_cutoff_minute = current.dinner_cutoff_minute ?? 0;
    let saturday_dinner_open = current.saturday_dinner_open !== false;
    let sunday_dinner_party_open = current.sunday_dinner_party_open !== false;
    if (body.launch_iso != null && String(body.launch_iso).trim()) {
      launch_iso = String(body.launch_iso).slice(0, 10);
    }
    if (body.slot_open_hour != null) slot_open_hour = body.slot_open_hour;
    else if (body.lunch_cutoff_hour != null) slot_open_hour = body.lunch_cutoff_hour;
    if (body.slot_close_hour != null) slot_close_hour = body.slot_close_hour;
    else if (body.dinner_cutoff_hour != null) slot_close_hour = body.dinner_cutoff_hour;
    if (body.slot_capacity != null) slot_capacity = body.slot_capacity;
    if (body.slot_lead_minutes != null) slot_lead_minutes = body.slot_lead_minutes;
    if (body.lunch_cutoff_minute != null) lunch_cutoff_minute = body.lunch_cutoff_minute;
    if (body.dinner_cutoff_minute != null) dinner_cutoff_minute = body.dinner_cutoff_minute;
    if (body.saturday_dinner_open != null) {
      saturday_dinner_open = body.saturday_dinner_open === true || body.saturday_dinner_open === 1 || body.saturday_dinner_open === "1" || body.saturday_dinner_open === "true";
    }
    if (body.sunday_dinner_party_open != null) {
      sunday_dinner_party_open = body.sunday_dinner_party_open === true || body.sunday_dinner_party_open === 1 || body.sunday_dinner_party_open === "1" || body.sunday_dinner_party_open === "true";
    }
    if (body.clear_min_order_day_override === true) {
      min_order_day_override = null;
    }
    if (body.apply_min_order_only_today === true && requestedMin != null) {
      min_order_day_override = { date: today, min_order_paise: requestedMin };
    } else if (requestedMin != null) {
      min_order_paise = requestedMin;
      if (body.clear_min_order_day_override !== false) {
        if (body.keep_min_order_day_override !== true) min_order_day_override = null;
      }
    }
    const settings = await getDb().saveOpsSettings({
      min_order_paise,
      min_order_day_override,
      launch_iso,
      slot_open_hour,
      slot_close_hour,
      slot_capacity,
      slot_lead_minutes,
      lunch_cutoff_hour: slot_open_hour,
      dinner_cutoff_hour: slot_close_hour,
      lunch_cutoff_minute,
      dinner_cutoff_minute,
      saturday_dinner_open,
      sunday_dinner_party_open
    });
    const effectivePaise = await getDb().getMinOrderPaise(today);
    const slotsToday = await buildSlotsSnapshot(today);
    res.json({
      ok: true,
      settings,
      today,
      slots_today: slotsToday,
      effective: {
        min_order_paise: effectivePaise,
        min_order_rupees: Math.round(effectivePaise) / 100,
        slot_open_hour: settings.slot_open_hour,
        slot_close_hour: settings.slot_close_hour,
        slot_capacity: settings.slot_capacity,
        slot_lead_minutes: settings.slot_lead_minutes,
        lunch_cutoff_hour: settings.lunch_cutoff_hour,
        dinner_cutoff_hour: settings.dinner_cutoff_hour,
        lunch_cutoff_minute: settings.lunch_cutoff_minute,
        dinner_cutoff_minute: settings.dinner_cutoff_minute,
        source: settings.min_order_day_override?.date === today ? "day_override" : "default"
      }
    });
  });
  app.post("/admin/api/ammas", auth, async (req, res) => {
    const body = req.body || {};
    if (!body.name || String(body.name).trim().length < 2) {
      res.status(400).json({ error: "name required" });
      return;
    }
    let share = body.payout_share_bps;
    if (body.payout_share_pct != null) {
      share = Math.round(Number(body.payout_share_pct) * 100);
    }
    const amma = await getDb().upsertAmma({
      id: body.id,
      name: body.name,
      phone: body.phone,
      active: body.active !== false,
      payout_share_bps: share,
      upi_id: body.upi_id,
      notes: body.notes
    });
    if (!amma) {
      res.status(400).json({ error: "Could not save Amma" });
      return;
    }
    res.json({ amma });
  });
  app.get("/admin/api/ammas/earnings", auth, async (req, res) => {
    try {
      const weekStart = req.query.week_start ? String(req.query.week_start) : void 0;
      const weekEnd = req.query.week_end ? String(req.query.week_end) : void 0;
      const data = await getDb().previewAmmaEarnings({ weekStart, weekEnd });
      res.json(data);
    } catch (err) {
      console.error("ammas/earnings failed", err);
      res.status(500).json({ error: "Could not load Amma earnings preview" });
    }
  });
  app.put("/admin/api/dishes/:code", auth, async (req, res) => {
    const body = req.body || {};
    const code = String(req.params.code || "").toUpperCase();
    const existing = await getDb().getDish(code);
    if (!existing) {
      res.status(404).json({ error: "Dish not found" });
      return;
    }
    const priceRupees = body.price_rupees != null ? Number(body.price_rupees) : null;
    const price = body.price_paise != null ? Number(body.price_paise) : priceRupees != null ? Math.round(priceRupees * 100) : existing.price_paise;
    const dish = await getDb().upsertDish({
      ...existing,
      ...body,
      code,
      price_paise: price
    });
    res.json({ dish });
  });
  app.get("/admin/api/customers", auth, async (req, res) => {
    const limit = Math.min(5e3, Math.max(10, Number(req.query.limit) || 300));
    res.json({ customers: await getDb().listCustomers(limit) });
  });
  app.get("/admin/api/customers/export.csv", auth, async (req, res) => {
    const scope = String(req.query.scope || "all").toLowerCase();
    const limit = Math.min(5e3, Math.max(1, Number(req.query.limit) || 5e3));
    const db = getDb();
    let rows = await db.listCustomers(limit);
    if (scope === "ordered") {
      rows = rows.filter((c) => (c.order_count || 0) > 0);
    } else if (scope === "messaged") {
      try {
        const convos = await db.listConversations?.(5e3);
        if (Array.isArray(convos) && convos.length) {
          const set = new Set(convos.map((c) => String(c.phone || "").replace(/\D/g, "")));
          rows = rows.filter((c) => set.has(String(c.phone || "").replace(/\D/g, "")));
          const lastByPhone = new Map(
            convos.map((c) => [String(c.phone || "").replace(/\D/g, ""), c.last_at || null])
          );
          rows = rows.map((c) => ({
            ...c,
            last_wa_at: lastByPhone.get(String(c.phone || "").replace(/\D/g, "")) || null
          }));
        }
      } catch {
      }
    }
    function contactDateIso(c) {
      const candidates = [c.last_order_at, c.last_wa_at, c.created_at].map((x) => String(x || "").trim()).filter(Boolean);
      if (!candidates.length) return "";
      return candidates.sort((a, b) => b.localeCompare(a))[0];
    }
    function formatDateIst(iso2) {
      if (!iso2) return "";
      const t = Date.parse(iso2);
      if (!Number.isFinite(t)) return String(iso2).slice(0, 10);
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(new Date(t));
    }
    rows = [...rows].map((c) => ({ ...c, _date: contactDateIso(c) })).sort((a, b) => String(b._date).localeCompare(String(a._date)));
    const esc = (v) => {
      const s = String(v ?? "");
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = ["Phone,Name,Date,Address"];
    for (const c of rows) {
      const phone = String(c.phone || "").replace(/\D/g, "");
      lines.push(
        [esc(phone), esc(c.name || ""), esc(formatDateIst(c._date)), esc(c.last_address || "")].join(",")
      );
    }
    const stamp = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="acr-customers-${scope}-${stamp}.csv"`
    );
    res.send(`\uFEFF${lines.join("\n")}
`);
  });
  app.get("/admin/api/feedbacks", auth, async (_req, res) => {
    res.json({ feedbacks: await getDb().listFeedbacks(50) });
  });
  app.get("/admin/api/helps", auth, async (_req, res) => {
    res.json({ tickets: await getDb().listHelpTickets(50) });
  });
  app.post("/admin/api/helps/:id/status", auth, async (req, res) => {
    const id = Number(req.params.id);
    const status = String(req.body?.ticket_status || req.body?.status || "closed").toLowerCase();
    if (!Number.isFinite(id) || id < 1) {
      res.status(400).json({ error: "Invalid ticket id" });
      return;
    }
    if (!["open", "closed"].includes(status)) {
      res.status(400).json({ error: "ticket_status must be open or closed" });
      return;
    }
    const ticket = await getDb().updateHelpTicket(id, {
      ticket_status: status,
      closed_at: status === "closed" ? (/* @__PURE__ */ new Date()).toISOString() : null
    });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    res.json({ ok: true, ticket });
  });
  app.get("/admin/api/conversations", auth, async (req, res) => {
    const limit = Math.min(300, Math.max(20, Number(req.query.limit) || 100));
    const q = String(req.query.q || "").trim().toLowerCase();
    let conversations = await getDb().listConversations(limit * 2);
    if (q) {
      conversations = conversations.filter(
        (c) => [c.phone, c.customer_name, c.profile_name, c.last_body].join(" ").toLowerCase().includes(q)
      );
    }
    res.json({
      conversations: conversations.slice(0, limit),
      note: "History starts when this feature was deployed. In + out messages for the bot number only."
    });
  });
  app.get("/admin/api/conversations/:phone", auth, async (req, res) => {
    const phone = String(req.params.phone || "").replace(/\D/g, "");
    if (phone.length < 10) {
      res.status(400).json({ error: "Invalid phone" });
      return;
    }
    const limit = Math.min(500, Math.max(20, Number(req.query.limit) || 200));
    const messages = await getDb().listMessagesForPhone(phone, limit);
    const cust = await getDb().getCustomer(phone);
    const lastCustomerMsg = [...messages].reverse().find((m) => m.direction === "in");
    res.json({
      phone,
      customer_name: cust?.name || null,
      messages,
      last_customer_at: lastCustomerMsg?.created_at || null,
      session_note: WA_SESSION_NOTE
    });
  });
  app.post("/admin/api/messages/send", auth, async (req, res) => {
    const phone = String(req.body?.phone || "").replace(/\D/g, "");
    const message = String(req.body?.message || "").trim();
    const personal = req.body?.personal !== false;
    const maxLen = personal ? 4096 : 900;
    if (phone.length < 10) {
      res.status(400).json({ error: "Valid customer phone required" });
      return;
    }
    if (message.length < 1 || message.length > maxLen) {
      res.status(400).json({ error: `message must be 1\u2013${maxLen} characters` });
      return;
    }
    const orderRef = String(req.body?.order_ref || "").trim() || null;
    try {
      const sent = await sendCustomerMessage(phone, message, { personal });
      res.json({
        ok: true,
        ...sent,
        order_ref: orderRef,
        note: WA_SESSION_NOTE
      });
    } catch (err) {
      res.status(502).json({
        error: err.message || "WhatsApp send failed",
        note: WA_SESSION_NOTE
      });
    }
  });
  app.post(
    "/admin/api/messages/send-image",
    auth,
    express.raw({
      type: ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/octet-stream"],
      limit: "5mb"
    }),
    async (req, res) => {
      const phone = String(req.query.phone || req.headers["x-wa-phone"] || "").replace(/\D/g, "");
      const caption = String(req.query.caption || req.headers["x-image-caption"] || "").slice(0, 1024);
      if (phone.length < 10) {
        res.status(400).json({ error: "Valid customer phone required (?phone=)" });
        return;
      }
      try {
        const mime = String(req.headers["content-type"] || "image/jpeg").split(";")[0].trim();
        const result = await sendImageBuffer(phone, {
          buffer: req.body,
          mime,
          caption: caption || void 0
        });
        res.json({
          ok: true,
          phone,
          ...result,
          note: WA_SESSION_NOTE
        });
      } catch (err) {
        res.status(502).json({
          error: err.message || "WhatsApp image send failed",
          note: WA_SESSION_NOTE
        });
      }
    }
  );
  app.post("/admin/api/messages/send-menu-text", auth, async (req, res) => {
    const includeHours = req.body?.include_hours !== false;
    const db = getDb();
    let phones = [];
    const one = String(req.body?.phone || "").replace(/\D/g, "");
    if (one.length >= 10) phones = [one];
    if (Array.isArray(req.body?.phones)) {
      phones = req.body.phones.map((p) => String(p).replace(/\D/g, "")).filter((p) => p.length >= 10);
    }
    if (!phones.length) {
      const audience = String(req.body?.audience || "");
      if (!audience) {
        res.status(400).json({ error: "phone, phones, or audience required" });
        return;
      }
      const customers = await db.listCustomers(500);
      if (audience === "ordered") {
        phones = customers.filter((c) => (c.order_count || 0) > 0).map((c) => c.phone);
      } else if (audience === "recent") {
        const weekAgo = Date.now() - 7 * 24 * 3600 * 1e3;
        phones = customers.filter((c) => c.last_order_at && new Date(c.last_order_at).getTime() >= weekAgo).map((c) => c.phone);
      } else if (audience === "all") {
        phones = customers.map((c) => c.phone);
      } else {
        res.status(400).json({ error: "For selected audience, pass phones[]" });
        return;
      }
    }
    phones = [...new Set(phones)].slice(0, 200);
    if (!phones.length) {
      res.status(400).json({ error: "No recipients matched" });
      return;
    }
    const dishes = await db.listAllDishes();
    const chunks = formatMenuPriceChunks(dishes, { businessName: config.businessName });
    const parts = includeHours ? [hoursAndRangeBlurb(), ...chunks] : chunks;
    const results = {
      ok: 0,
      fail: 0,
      sent_parts: 0,
      errors: [],
      note: WA_SESSION_NOTE
    };
    for (const phone of phones) {
      try {
        if (await isSuppressed(phone)) { results.skipped = (results.skipped || 0) + 1; continue; }
        for (const part of parts) {
          await sendText(phone, part);
          results.sent_parts += 1;
          await sleep(120);
        }
        results.ok += 1;
      } catch (err) {
        results.fail += 1;
        if (results.errors.length < 20) {
          results.errors.push({ phone, error: err.message || "send failed" });
        }
      }
      await sleep(150);
    }
    res.json({
      ...results,
      sent_to: phones.length,
      tip: "Text menu from live Admin \u2192 Menu. Same 24h WhatsApp window as other free-form messages."
    });
  });
  app.post("/admin/api/messages/send-menu", auth, async (req, res) => {
    const includeSpecials = req.body?.include_specials !== false;
    const includeFullMenu = req.body?.include_full_menu !== false;
    const includeDaily = req.body?.include_daily !== false;
    const intro = req.body?.intro === false || req.body?.intro === 0 ? false : req.body?.intro != null ? String(req.body.intro) : void 0;
    const db = getDb();
    let phones = [];
    const one = String(req.body?.phone || "").replace(/\D/g, "");
    if (one.length >= 10) phones = [one];
    if (Array.isArray(req.body?.phones)) {
      phones = req.body.phones.map((p) => String(p).replace(/\D/g, "")).filter((p) => p.length >= 10);
    }
    if (!phones.length) {
      const audience = String(req.body?.audience || "");
      if (!audience) {
        res.status(400).json({ error: "phone, phones, or audience required" });
        return;
      }
      const customers = await db.listCustomers(500);
      if (audience === "ordered") {
        phones = customers.filter((c) => (c.order_count || 0) > 0).map((c) => c.phone);
      } else if (audience === "recent") {
        const weekAgo = Date.now() - 7 * 24 * 3600 * 1e3;
        phones = customers.filter((c) => c.last_order_at && new Date(c.last_order_at).getTime() >= weekAgo).map((c) => c.phone);
      } else if (audience === "all") {
        phones = customers.map((c) => c.phone);
      } else {
        res.status(400).json({ error: "For selected audience, pass phones[]" });
        return;
      }
    }
    phones = [...new Set(phones)].slice(0, 200);
    if (!phones.length) {
      res.status(400).json({ error: "No recipients matched" });
      return;
    }
    const results = {
      ok: 0,
      fail: 0,
      sent_images: 0,
      errors: [],
      note: WA_SESSION_NOTE
    };
    for (const phone of phones) {
      try {
        if (await isSuppressed(phone)) { results.skipped = (results.skipped || 0) + 1; continue; }
        const r = await sendMenuPosters(phone, {
          intro: intro === false ? false : intro,
          includeSpecials,
          includeFullMenu,
          includeDaily
        });
        if (r.sent > 0) {
          results.ok += 1;
          results.sent_images += r.sent;
        } else {
          results.fail += 1;
          if (results.errors.length < 20) {
            results.errors.push({
              phone,
              error: r.errors.join("; ") || "No menu posters uploaded \u2014 upload Daily offers / Complete list in Admin \u2192 Posters"
            });
          }
        }
      } catch (err) {
        results.fail += 1;
        if (results.errors.length < 20) {
          results.errors.push({ phone, error: err.message || "send failed" });
        }
      }
      await sleep(150);
    }
    res.json({
      ...results,
      sent_to: phones.length,
      tip: "Upload Daily offers and/or Complete list under Admin \u2192 Posters. Customer must be in the 24h WhatsApp window."
    });
  });
  app.post("/admin/api/orders/:ref/status", auth, async (req, res) => {
    const status = String(req.body?.status || "").trim();
    const notify = req.body?.notify !== false;
    const extra = {};
    if (req.body?.track_map_url != null) extra.track_map_url = String(req.body.track_map_url).trim();
    if (req.body?.delivery_contact != null) {
      extra.delivery_contact = String(req.body.delivery_contact).replace(/\D/g, "");
    }
    if (req.body?.eta_minutes != null) extra.eta_minutes = Number(req.body.eta_minutes);
    if (status === "paid") {
      extra.paid_via = "admin";
      extra.payment_method = "prepaid";
      extra.cod_due_paise = 0;
      extra.cash_confirmed_at = new Date().toISOString();
      extra.cod_collected_paise = null;
    }
    const result = await applyOrderStatus(req.params.ref, status, {
      notifyCustomer: notify,
      extra
    });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result);
  });

  /** Short supply / revised bill — cut delivered qty, recompute total, WhatsApp customer. */
  app.post("/admin/api/orders/:ref/revise", auth, async (req, res) => {
    try {
      const body = req.body || {};
      const result = await reviseOrderShortSupply(req.params.ref, {
        delivered: body.delivered,
        add_items: body.add_items,
        notify: body.notify !== false,
        note: body.note,
      });
      if (!result.ok) {
        res.status(400).json({ error: result.error || "Revise failed" });
        return;
      }
      res.json(result);
    } catch (err) {
      console.error("order revise failed", err);
      res.status(500).json({ error: err.message || "Revise failed" });
    }
  });

  app.post("/admin/api/orders/:ref/send-to-rider", auth, async (req, res) => {
    const ref = String(req.params.ref || "").trim().toUpperCase();
    const order = await getDb().findOrderByRef(ref);
    if (!order) {
      res.status(404).json({ error: `Order ${ref} not found` });
      return;
    }
    if (!(config.riderPhones || []).length) {
      res.status(400).json({ error: "RIDER_PHONES not configured on server" });
      return;
    }
    try {
      const sent_to = await sendOrderToRiders(order);
      res.json({ ok: true, order_ref: ref, sent_to, riders: config.riderPhones });
    } catch (err) {
      res.status(502).json({ error: err.message || "WhatsApp send to rider failed" });
    }
  });
  app.post("/admin/api/broadcast", auth, async (req, res) => {
    const personal = req.body?.personal === true;
    const message = String(req.body?.message || "").trim();
    const maxLen = personal ? 4096 : 900;
    if (message.length < (personal ? 1 : 3) || message.length > maxLen) {
      res.status(400).json({
        error: personal ? `message must be 1\u2013${maxLen} characters` : "message must be 3\u2013900 characters"
      });
      return;
    }
    const db = getDb();
    let phones = Array.isArray(req.body?.phones) ? req.body.phones.map((p) => String(p).replace(/\D/g, "")).filter(Boolean) : [];
    if (!phones.length) {
      const audience = String(req.body?.audience || "all");
      const customers = await db.listCustomers(500);
      if (audience === "ordered") {
        phones = customers.filter((c) => (c.order_count || 0) > 0).map((c) => c.phone);
      } else if (audience === "recent") {
        const weekAgo = Date.now() - 7 * 24 * 3600 * 1e3;
        phones = customers.filter((c) => c.last_order_at && new Date(c.last_order_at).getTime() >= weekAgo).map((c) => c.phone);
      } else {
        phones = customers.map((c) => c.phone);
      }
    }
    phones = [...new Set(phones)].slice(0, 200);
    if (!phones.length) {
      res.status(400).json({ error: "No recipients matched" });
      return;
    }
    const results = { ok: 0, fail: 0, errors: [] };
    for (const phone of phones) {
      try {
        if (await isSuppressed(phone)) { results.skipped = (results.skipped || 0) + 1; continue; }
        await sendCustomerMessage(phone, message, { personal });
        results.ok += 1;
      } catch (err) {
        results.fail += 1;
        if (results.errors.length < 15) {
          results.errors.push({ phone, error: err.message || "send failed" });
        }
      }
      await sleep(120);
    }
    res.json({
      ...results,
      sent_to: phones.length,
      note: WA_SESSION_NOTE
    });
  });
}

