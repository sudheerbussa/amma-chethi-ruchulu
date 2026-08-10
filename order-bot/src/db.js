import { config } from './config.js';
import { createJsonStore } from './db/json-store.js';

/** @type {Awaited<ReturnType<typeof createJsonStore>> | null} */
let store = null;

export function getDb() {
  if (!store) {
    throw new Error('Database not initialized — call await initDb() first');
  }
  return store;
}

export async function initDb() {
  if (store) return store;

  if (config.databaseUrl) {
    const { createPgStore } = await import('./db/pg-store.js');
    store = await createPgStore(config.databaseUrl);
    await store.ready();
    console.log('Database ready: postgres (driver=pg)');
    return store;
  }

  // Production VPS: Postgres only — refuse silent JSON so order/pay state stays durable
  if (config.isProduction && !config.allowJsonDb) {
    throw new Error(
      'DATABASE_URL is required in production. ' +
        'Set Postgres DATABASE_URL in .env (see SETUP-VPS.md). ' +
        'Emergency JSON only: ALLOW_JSON_DB=1 (not recommended).',
    );
  }

  store = createJsonStore();
  await store.ready();
  console.log(
    `Database ready: json (${store.filePath || 'file'})` +
      (config.isProduction ? ' [ALLOW_JSON_DB=1]' : ' [local/dev fallback]'),
  );
  return store;
}

if (process.argv.includes('--init')) {
  await initDb();
}
