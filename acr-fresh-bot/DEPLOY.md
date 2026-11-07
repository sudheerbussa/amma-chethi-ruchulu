# ACR-Fresh deploy notes

Sister of food **order-bot**. Do **not** overwrite `/opt/order-bot`.

**App:** ACR-Fresh WhatsApp produce bot  
**Suggested URL:** https://fresh.ammachethiruchulu.co.in (TBD)  
**Suggested path:** `/opt/acr-fresh-bot`  
**pm2 name:** `acr-fresh-bot` (separate from `acr-order-bot`)  
**WhatsApp number:** not activated yet — fill `WHATSAPP_*` when ready  

Flows + Catalog: [`docs/WHATSAPP_FLOWS_CATALOG.md`](./docs/WHATSAPP_FLOWS_CATALOG.md)  
Local setup: [`README.md`](./README.md)

Until go-live, develop with:

```bash
cd acr-fresh-bot
cp .env.example .env   # PORT=3001
npm install            # or link ../order-bot/node_modules
npm run db:init
BYPASS_CUTOFFS=1 npm run dev
```

When deploying beside the food bot on the same VPS: separate folder, env, DB (`acr_fresh`), webhook URL, and pm2 process.

Reuse food-bot packaging scripts (`npm run build` / `npm run package`) with paths renamed for this app.
