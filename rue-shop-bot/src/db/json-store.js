import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { projectRoot } from '../paths.js';
import { maxSeqFromRefs, formatOrderRef, serviceStampToday } from '../orders/refs.js';

function dbFilePath() {
  const p = config.databasePath.replace(/\.db$/i, '.json');
  return path.isAbsolute(p) ? p : path.join(projectRoot, p);
}

function emptyStore() {
  return {
    meta: {},
    customers: {},
    orders: [],
    messages: [],
    nextOrderId: 1,
    nextMessageId: 1,
  };
}

export function createJsonStore() {
  let store = null;

  function load() {
    if (store) return store;
    const file = dbFilePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file)) {
      store = JSON.parse(fs.readFileSync(file, 'utf8'));
    } else {
      store = emptyStore();
    }
    if (!Array.isArray(store.orders)) store.orders = [];
    if (!store.customers || typeof store.customers !== 'object') store.customers = {};
    return store;
  }

  function save() {
    const file = dbFilePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(store, null, 2));
  }

  return {
    driver: 'json',
    filePath: dbFilePath(),
    async ready() {
      load();
    },

    async upsertCustomer(phone, patch = {}) {
      const s = load();
      const key = String(phone || '').replace(/\D/g, '');
      if (!key) return null;
      const prev = s.customers[key] || { phone: key, created_at: new Date().toISOString() };
      s.customers[key] = { ...prev, ...patch, phone: key, updated_at: new Date().toISOString() };
      save();
      return s.customers[key];
    },

    async findCustomer(phone) {
      const s = load();
      const key = String(phone || '').replace(/\D/g, '');
      return s.customers[key] || null;
    },

    async nextOrderRef() {
      const s = load();
      const stamp = serviceStampToday();
      const refs = s.orders.map((o) => o.order_ref);
      const seq = maxSeqFromRefs(refs, stamp) + 1;
      return formatOrderRef(stamp, seq);
    },

    async createOrder(order) {
      const s = load();
      const row = {
        id: s.nextOrderId++,
        ...order,
        created_at: order.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      s.orders.unshift(row);
      if (row.phone) {
        const key = String(row.phone).replace(/\D/g, '');
        const prev = s.customers[key] || { phone: key, created_at: new Date().toISOString() };
        s.customers[key] = {
          ...prev,
          name: row.customer_name || prev.name,
          phone: key,
          updated_at: new Date().toISOString(),
        };
      }
      save();
      return row;
    },

    async findOrderByRef(orderRef) {
      const s = load();
      const ref = String(orderRef || '').trim().toUpperCase();
      return s.orders.find((o) => String(o.order_ref).toUpperCase() === ref) || null;
    },

    async listOrders(limit = 100) {
      const s = load();
      return s.orders.slice(0, Math.max(1, Number(limit) || 100));
    },

    async updateOrderStatus(orderRef, status, extra = {}) {
      const s = load();
      const ref = String(orderRef || '').trim().toUpperCase();
      const order = s.orders.find((o) => String(o.order_ref).toUpperCase() === ref);
      if (!order) return null;
      order.status = status;
      Object.assign(order, extra);
      order.updated_at = new Date().toISOString();
      save();
      return order;
    },

    async patchOrder(orderRef, patch = {}) {
      const s = load();
      const ref = String(orderRef || '').trim().toUpperCase();
      const order = s.orders.find((o) => String(o.order_ref).toUpperCase() === ref);
      if (!order) return null;
      Object.assign(order, patch);
      order.updated_at = new Date().toISOString();
      save();
      return order;
    },

    async logMessage({ phone, direction, body }) {
      const s = load();
      if (!Array.isArray(s.messages)) s.messages = [];
      s.messages.push({
        id: s.nextMessageId++,
        phone: String(phone || '').replace(/\D/g, ''),
        direction,
        body: String(body || '').slice(0, 4000),
        at: new Date().toISOString(),
      });
      if (s.messages.length > 2000) s.messages = s.messages.slice(-1500);
      save();
    },
  };
}
