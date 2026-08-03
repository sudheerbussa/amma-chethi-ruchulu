# Local WhatsApp order bot (official Cloud API)

Amma Chethi Ruchulu — local development server for Meta WhatsApp Cloud API.  
No unofficial WhatsApp bridges.

## What it does (MVP)

1. Receives WhatsApp webhooks from Meta  
2. Interactive **buttons** (Lunch / Dinner / Full menu) + **list** dish picker  
3. Quantity reply buttons (1–3) with typed qty fallback  
4. Still accepts typed `Hi` / `Menu` / `Lunch` / `Dinner` / dish codes  
5. Enforces cutoffs (lunch 7:00 AM, dinner 2:00 PM IST)  
7. Stores orders in local **JSON** (`data/orders.json`)  
8. **Admin WhatsApp commands** + local **ops dashboard** at `/admin`  
9. Postgres-oriented schema kept in `sql/schema.sql` for later migration  

See **`OPS.md`** for UPI switch, admin phones, and dashboard token.  


## Setup

```bash
cd order-bot
cp .env.example .env
npm install
npm run db:init
BYPASS_CUTOFFS=1 npm run dev
```

### Test without Meta (dry-run)

```bash
curl -X POST http://127.0.0.1:3000/simulate \
  -H 'Content-Type: application/json' \
  -d '{"from":"919999999999","text":"Dinner"}'

curl -X POST http://127.0.0.1:3000/simulate \
  -H 'Content-Type: application/json' \
  -d '{"from":"919999999999","text":"D1"}'

# then qty, then address …
curl http://127.0.0.1:3000/orders
```

Replies print in the terminal when `WHATSAPP_ACCESS_TOKEN` is empty.

### Connect Meta later

1. Fill `.env` with Cloud API token + Phone number ID  
2. `BYPASS_CUTOFFS=0` for real cutoffs  
3. Expose HTTPS: `cloudflared tunnel --url http://127.0.0.1:3000`  
4. Meta webhook: `https://YOUR-TUNNEL/webhook`  
5. Verify token = `WHATSAPP_VERIFY_TOKEN`

## Cutoffs (IST)

| Meal | Order by |
|------|----------|
| Lunch | 07:00 |
| Dinner | 14:00 |

Set `BYPASS_CUTOFFS=1` only for after-hours local testing.
