import express from 'express';
import { config } from './config.js';
import { initDb, getDb } from './db.js';
import { extractInboundMessages, logInbound } from './whatsapp.js';
import { handleIncoming } from './handlers/message.js';
import { mountAdmin } from './admin/routes.js';
import { mountPayments } from './payments/routes.js';
import { isRazorpayReady } from './razorpay.js';
import { isDinnerOpen, isLunchOpen, nowIst } from './cutoffs.js';

import { resolveFromRoot } from './paths.js';

await initDb();

const app = express();
// Keep raw body for Razorpay webhook HMAC (X-Razorpay-Signature).
app.use(
  express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

/** Kitchen voiceovers + other static assets from public/ (e.g. /sounds/*.mp3) */
app.use(
  express.static(resolveFromRoot('public'), {
    index: false,
    maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
  }),
);

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    business: config.businessName,
    driver: getDb().driver || 'json',
    env: config.nodeEnv,
    ist: nowIst().dayDateLabel,
    bypassCutoffs: config.bypassCutoffs,
    lunchOpen: isLunchOpen(),
    dinnerOpen: isDinnerOpen(),
    razorpay: isRazorpayReady(),
    upiFallback: !isRazorpayReady() || config.upiFallback,
  });
});

mountAdmin(app);
mountPayments(app);

/** Meta webhook verification */
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

/** Inbound WhatsApp messages */
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const field = req.body?.entry?.[0]?.changes?.[0]?.field;
    const messages = extractInboundMessages(req.body);
    console.log('Webhook POST', {
      object: req.body?.object,
      field: field || null,
      messageCount: messages.length,
    });
    for (const msg of messages) {
      console.log('Inbound', msg.from, msg.kind || 'text', msg.text);
      await logInbound(msg);
      await handleIncoming(msg);
    }
  } catch (err) {
    console.error('Webhook handler error', err);
  }
});

/** Local testing without Meta */
app.post('/simulate', async (req, res) => {
  const from = req.body?.from || '919999999999';
  const text = req.body?.text || 'Hi';
  const profileName = req.body?.profileName || req.body?.profile_name || null;
  const msg = { from, text, profileName, kind: 'text', id: `sim_${Date.now()}` };
  await logInbound(msg);
  await handleIncoming(msg);
  res.json({ ok: true });
});

app.get('/orders', async (_req, res) => {
  res.json(await getDb().listOrders(50));
});

app.listen(config.port, () => {
  console.log(`${config.businessName} order-bot on http://127.0.0.1:${config.port}`);
  console.log(`Webhook · Simulate · Orders · Admin UI http://127.0.0.1:${config.port}/admin`);
  console.log(
    `IST ${nowIst().dayDateLabel} · db=${getDb().driver || 'json'} · BYPASS_CUTOFFS=${config.bypassCutoffs ? '1 (OFF)' : '0 (ON)'} · ` +
      `lunchOpen=${isLunchOpen()} dinnerOpen=${isDinnerOpen()}`,
  );
  if (!config.accessToken) {
    console.log('WHATSAPP_ACCESS_TOKEN empty — running in dry-run (logs replies only)');
  }
});
