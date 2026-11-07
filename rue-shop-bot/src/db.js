import { config } from './config.js';
import { createJsonStore } from './db/json-store.js';

/** @type {ReturnType<typeof createJsonStore> | null} */
let store = null;

export function getDb() {
  if (!store) throw new Error('Database not initialized — call await initDb() first');
  return store;
}

export async function initDb() {
  if (store) return store;
  if (config.isProduction && !config.allowJsonDb) {
    throw new Error('Set ALLOW_JSON_DB=1 for JSON store, or add Postgres later.');
  }
  store = createJsonStore();
  await store.ready();
  console.log(`Database ready: json (${store.filePath})`);
  return store;
}

if (process.argv.includes('--init')) {
  await initDb();
}
