import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { MENU_DISHES, MENU_VERSION } from './menu.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function dbFilePath() {
  const p = config.databasePath.replace(/\.db$/i, '.json');
  return path.isAbsolute(p) ? p : path.join(root, p);
}

function emptyStore() {
  return {
    menu_version: 0,
    dishes: [],
    customers: {},
    sessions: {},
    orders: [],
    nextOrderId: 1,
  };
}

let store;

function load() {
  if (store) return store;
  const file = dbFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) {
    store = JSON.parse(fs.readFileSync(file, 'utf8'));
  } else {
    store = emptyStore();
  }
  return store;
}

function save() {
  const file = dbFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(store, null, 2));
}

function ensureMenu() {
  const s = load();
  if (s.menu_version === MENU_VERSION && s.dishes?.length) return;
  const prevSold = new Map((s.dishes || []).map((d) => [d.code, d.portions_sold || 0]));
  s.dishes = MENU_DISHES.map((d) => ({
    ...d,
    portions_sold: prevSold.get(d.code) || 0,
  }));
  s.menu_version = MENU_VERSION;
  save();
  console.log(`Menu synced to version ${MENU_VERSION} (${s.dishes.length} dishes)`);
}

export function getDb() {
  ensureMenu();
  return {
    listDishes(meal, category) {
      const s = load();
      return s.dishes.filter((d) => {
        if (!d.active) return false;
        if (meal && d.meal !== meal && d.meal !== 'both') return false;
        if (category && d.category !== category) return false;
        return true;
      });
    },
    listAllDishes() {
      return load().dishes.slice();
    },
    getDish(code) {
      return load().dishes.find((d) => d.code === String(code || '').toUpperCase());
    },
    setDishStock(code, maxPortions) {
      const s = load();
      const dish = s.dishes.find((d) => d.code === String(code).toUpperCase());
      if (!dish) return null;
      dish.max_portions = Math.max(0, Number(maxPortions) || 0);
      save();
      return { ...dish };
    },
    setDishActive(code, active) {
      const s = load();
      const dish = s.dishes.find((d) => d.code === String(code).toUpperCase());
      if (!dish) return null;
      dish.active = Boolean(active);
      save();
      return { ...dish };
    },
    getSession(phone) {
      const s = load();
      if (!s.sessions[phone]) {
        s.sessions[phone] = {
          phone,
          state: 'idle',
          meal: null,
          category: null,
          dish_code: null,
          qty: null,
          address: null,
          delivery_zone: null,
        };
        save();
      }
      return { ...s.sessions[phone] };
    },
    setSession(phone, patch) {
      const s = load();
      const cur = s.sessions[phone] || {
        phone,
        state: 'idle',
        meal: null,
        category: null,
        dish_code: null,
        qty: null,
        address: null,
        delivery_zone: null,
      };
      s.sessions[phone] = { ...cur, ...patch };
      save();
    },
    upsertCustomer(phone, address) {
      const s = load();
      s.customers[phone] = {
        phone,
        last_address: address,
        created_at: s.customers[phone]?.created_at || new Date().toISOString(),
      };
      save();
    },
    createOrder(order) {
      const s = load();
      const row = {
        id: s.nextOrderId++,
        ...order,
        created_at: new Date().toISOString(),
      };
      s.orders.push(row);
      const dish = s.dishes.find((d) => d.code === order.dish_code);
      if (dish) dish.portions_sold += order.qty;
      save();
      return row;
    },
    listOrders(limit = 50) {
      return load().orders.slice().reverse().slice(0, limit);
    },
    listOrdersForMeal(meal, statuses = ['paid', 'preparing', 'out_for_delivery']) {
      return load()
        .orders
        .filter((o) => o.meal === meal && statuses.includes(o.status))
        .slice()
        .reverse();
    },
    findOrderByRef(orderRef) {
      const ref = String(orderRef || '').trim().toUpperCase();
      return load().orders.find((o) => String(o.order_ref).toUpperCase() === ref) || null;
    },
    findLatestOrder(phone) {
      const rows = load().orders.filter((o) => o.phone === phone);
      return rows.length ? rows[rows.length - 1] : null;
    },
    findLatestPendingOrder(phone) {
      const rows = load().orders.filter(
        (o) => o.phone === phone && o.status === 'pending_payment',
      );
      return rows.length ? rows[rows.length - 1] : null;
    },
    updateOrderStatus(orderRef, status, extra = {}) {
      const s = load();
      const ref = String(orderRef || '').trim().toUpperCase();
      const order = s.orders.find((o) => String(o.order_ref).toUpperCase() === ref);
      if (!order) return null;
      order.status = status;
      Object.assign(order, extra);
      order.updated_at = new Date().toISOString();
      save();
      return { ...order };
    },
  };
}

export function initDb() {
  ensureMenu();
  console.log('Database ready:', dbFilePath());
}

if (process.argv.includes('--init')) {
  initDb();
}
