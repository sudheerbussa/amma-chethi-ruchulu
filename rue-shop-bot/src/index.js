import express from 'express';
import { config, isWhatsappReady } from './config.js';
import { initDb, getDb } from './db.js';
import { extractInboundMessages, logInbound } from './whatsapp.js';
import { handleIncoming } from './handlers/message.js';
import { mountPayments } from './payments/routes.js';
import { mountStorefront } from './storefront/routes.js';
import { isRazorpayReady } from './razorpay.js';
import { resolveFromRoot } from './paths.js';

await initDb();

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

app.use(
  express.static(resolveFromRoot('public'), {
    index: false,
    maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
  }),
);

app.get('/', (_req, res) => {
  res.redirect(302, '/shop/');
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    business: config.businessName,
    driver: getDb().driver || 'json',
    env: config.nodeEnv,
    razorpay: isRazorpayReady(),
    whatsapp: isWhatsappReady(),
    shop: true,
  });
});

/** Minimal admin list — protect with ADMIN_TOKEN header or ?token= */
app.get('/admin/orders', async (req, res) => {
  const token = req.get('x-admin-token') || req.query.token;
  if (token !== config.adminToken) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const orders = await getDb().listOrders(Number(req.query.limit) || 100);
  res.json({ orders });
});

mountPayments(app);

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
    const messages = extractInboundMessages(req.body);
    logInbound(messages);
    for (const msg of messages) {
      try {
        await handleIncoming(msg);
      } catch (err) {
        console.error('handleIncoming', err);
      }
    }
  } catch (err) {
    console.error('webhook handler', err);
  }
});

app.listen(config.port, '127.0.0.1', () => {
  console.log(
    `${config.businessName} shop listening on 127.0.0.1:${config.port} (${config.publicBaseUrl})`,
  );
});
