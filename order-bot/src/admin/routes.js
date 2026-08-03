import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from '../db.js';
import { config } from '../config.js';
import { applyOrderStatus } from '../orders/status.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token;
  if (!config.adminToken || token !== config.adminToken) {
    res.status(401).json({ error: 'Unauthorized — set ADMIN_TOKEN and use Bearer token' });
    return;
  }
  next();
}

export function mountAdmin(app) {
  app.get('/admin', (_req, res) => {
    res.sendFile(path.join(__dirname, '../../public/admin.html'));
  });

  app.get('/admin/api/orders', auth, (_req, res) => {
    res.json({
      business: config.businessName,
      orders: getDb().listOrders(100),
    });
  });

  app.get('/admin/api/dishes', auth, (_req, res) => {
    res.json({ dishes: getDb().listAllDishes() });
  });

  app.post('/admin/api/dishes/:code/stock', auth, (req, res) => {
    const max = Number(req.body?.max_portions);
    if (!Number.isFinite(max) || max < 0) {
      res.status(400).json({ error: 'max_portions must be a number >= 0' });
      return;
    }
    const dish = getDb().setDishStock(req.params.code, max);
    if (!dish) {
      res.status(404).json({ error: 'Dish not found' });
      return;
    }
    res.json({ dish });
  });

  app.post('/admin/api/dishes/:code/active', auth, (req, res) => {
    const dish = getDb().setDishActive(req.params.code, Boolean(req.body?.active));
    if (!dish) {
      res.status(404).json({ error: 'Dish not found' });
      return;
    }
    res.json({ dish });
  });

  app.post('/admin/api/orders/:ref/status', auth, async (req, res) => {
    const status = String(req.body?.status || '').trim();
    const notify = req.body?.notify !== false;
    const result = await applyOrderStatus(req.params.ref, status, { notifyCustomer: notify });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result);
  });
}
