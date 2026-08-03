import express from 'express';
import { config } from './config.js';
import { initDb, getDb } from './db.js';
import { extractInboundMessages } from './whatsapp.js';
import { handleIncoming } from './handlers/message.js';
import { mountAdmin } from './admin/routes.js';

initDb();

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, business: config.businessName });
});

mountAdmin(app);

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
  await handleIncoming({ from, text });
  res.json({ ok: true });
});

app.get('/orders', (_req, res) => {
  res.json(getDb().listOrders(50));
});

app.listen(config.port, () => {
  console.log(`${config.businessName} order-bot on http://127.0.0.1:${config.port}`);
  console.log(`Webhook · Simulate · Orders · Admin UI http://127.0.0.1:${config.port}/admin`);
  if (!config.accessToken) {
    console.log('WHATSAPP_ACCESS_TOKEN empty — running in dry-run (logs replies only)');
  }
});
