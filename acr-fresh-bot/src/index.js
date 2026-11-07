import { handleMarketingStatuses } from './marketing/service.js';
import express from 'express';
import { config } from './config.js';
import { initDb, getDb } from './db.js';
import { extractInboundMessages, logInbound } from './whatsapp.js';
import { handleIncoming } from './handlers/message.js';
import { mountAdmin } from './admin/routes.js';
import { mountPayments } from './payments/routes.js';
import { mountFlows } from './flows/endpoint.js';
import { mountPublicMedia } from './media/routes.js';
import { mountRider } from './riders/routes.js';
import { mountStorefront } from './storefront/routes.js';
import { isRazorpayReady } from './razorpay.js';
import { isDinnerOpen, isLunchOpen, mealCutoffLabel, nowIst } from './cutoffs.js';
import { runAdminPingReminderSchedule } from './admin/ping-reminder.js';
import { runBuyListSchedule } from './orders/buy-list.js';
import { resolveFromRoot } from './paths.js';

await initDb();

// Unpaid orders are NOT auto-cancelled — admin cancels manually only.
setInterval(runAdminPingReminderSchedule, 60 * 1000);
setInterval(runBuyListSchedule, 60 * 1000);

const app = express();
app.use(
  express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

mountStorefront(app);
mountPublicMedia(app);

app.use(
  express.static(resolveFromRoot('public'), {
    index: false,
    maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
  }),
);

app.get('/health', async (_req, res) => {
  let catalogId = config.whatsappCatalogId;
  try {
    const { resolveCatalogId } = await import('./catalog/sync.js');
    catalogId = await resolveCatalogId();
  } catch {
    /* ignore */
  }
  res.json({
    ok: true,
    business: config.businessName,
    driver: getDb().driver || 'json',
    env: config.nodeEnv,
    ist: nowIst().dayDateLabel,
    bypassCutoffs: config.bypassCutoffs,
    lunchOpen: isLunchOpen(),
    dinnerOpen: isDinnerOpen(),
    lunchCutoff: mealCutoffLabel('lunch'),
    dinnerCutoff: mealCutoffLabel('dinner'),
    communityInvite: Boolean(config.communityInviteUrl),
    razorpay: isRazorpayReady(),
    upiFallback: !isRazorpayReady() || config.upiFallback,
    flows: Boolean(config.whatsappFlowId),
    flowMode: config.whatsappFlowMode,
    flowAllowlist: config.whatsappFlowAllowlist.length,
    catalog: Boolean(catalogId),
    catalogImage: Boolean(config.catalogDefaultImageUrl),
    storefrontFresh: true,
  });
});

mountAdmin(app);
mountRider(app);
mountPayments(app);
mountFlows(app);

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === config.verifyToken) {
    console.log('Webhook verified');
    res.status(200).send(challenge);
    return;
  }
  res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    await handleMarketingStatuses(req.body).catch(err => console.error('Marketing status update failed', err.message));
    const field = req.body?.entry?.[0]?.changes?.[0]?.field;
    const messages = extractInboundMessages(req.body);
    console.log('Webhook POST', {
      object: req.body?.object,
      field: field || null,
      messageCount: messages.length,
    });
    for (const msg of messages) {
      console.log('Inbound', msg.from, msg.kind || 'text', msg.text);
      const duplicate = await logInbound(msg);
      if (duplicate) {
        console.log('Skip duplicate inbound', msg.from, msg.id || '-');
        continue;
      }
      await handleIncoming(msg);
    }
  } catch (err) {
    console.error('Webhook handler error', err);
  }
});

app.post('/simulate', async (req, res) => {
  const from = req.body?.from || '919999999999';
  const text = req.body?.text || 'Hi';
  const profileName = req.body?.profileName || req.body?.profile_name || null;
  const location = req.body?.location || null;
  const msg = { from, text, profileName, kind: location ? 'location' : 'text', id: `sim_${Date.now()}`, location };
  if (await logInbound(msg)) {
    res.json({ ok: true, skipped: 'duplicate' });
    return;
  }
  await handleIncoming(msg);
  res.json({ ok: true });
});

app.get('/orders', async (_req, res) => {
  res.json(await getDb().listOrders(50));
});

app.listen(config.port, () => {
  console.log(`${config.businessName} on http://127.0.0.1:${config.port}`);
  console.log(`Webhook · Admin hub http://127.0.0.1:${config.port}/admin · Rider hub /rider · app /admin/app`);
  if (!config.accessToken) {
    console.log('WHATSAPP_ACCESS_TOKEN empty — running in dry-run (logs replies only)');
  }
});
