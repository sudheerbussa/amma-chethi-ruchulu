# Local WhatsApp order bot (official Cloud API)

Amma Chethi Ruchulu — local development server for Meta WhatsApp Cloud API.  
No unofficial WhatsApp bridges.

## What it does (MVP)

**MVP** = *Minimum Viable Product* — smallest set of features that can run real daily orders (WhatsApp order → kitchen → pay → deliver).

1. Receives WhatsApp webhooks from Meta  
2. Interactive **buttons** (Lunch / Dinner) + **list** dish picker + multi-item cart  
3. Cutoffs (lunch 10:00 / dinner 16:00 IST) with **next-day pre-order** after deadline  
4. Stores data in **Postgres** on VPS (`DATABASE_URL`); local may use JSON when URL is empty  
5. **Admin WhatsApp commands** + ops dashboard at `/admin`  
6. Payment: **Razorpay** web checkout when keys set (`UPI_FALLBACK=0` by default); else UPI QR + `PAID`

See **`AMMAS.md`** for home-cook (Amma) data model and weekly payout design.  
See **`VPS-REQUIREMENTS.md`** for the full prerequisites checklist before any personal VPS deploy (accounts, OS stack, env vars, integrations).  
See **`OPS.md`** for ops. See **`DEPLOY.md`** for code updates after go-live.  
See **`SETUP-VPS.md`** for **new VPS from zero** + **Postgres enable / JSON fallback** (copy-paste commands).

## Setup

```bash
cd order-bot
cp .env.example .env
npm install
npm run db:init
BYPASS_CUTOFFS=1 npm run dev
```

### Postgres (optional)

```bash
# needs Docker
docker compose up -d

# in .env:
# DATABASE_URL=postgres://acr:acr_dev@127.0.0.1:5432/acr_orders

npm run db:migrate
# one-time import of existing orders.json:
npm run db:import-json

npm run dev
# /health should show "driver":"pg"
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
| Lunch | 10:00 |
| Dinner | 16:00 |

After cut-off, customers can pre-order the next day. Set `BYPASS_CUTOFFS=1` only for after-hours local testing.
