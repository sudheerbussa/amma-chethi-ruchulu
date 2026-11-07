# ACR-Fresh — WhatsApp order bot

Sister bot to Amma Chethi Ruchulu **order-bot**, under the same Meta Business wing.

- **Brand:** ACR-Fresh (placeholder until final naming)
- **Focus:** South Indian vegetables (¼ kg–1 kg packs)
- **Add-ons:** Milk, staples, kitchen utilities (emergency)
- **Delivery:** Hourly slots with capacity lock (default **5 orders / hour**)
- **Min order:** ₹100
- **Channels:** Button/list bot + WhatsApp Flows + Catalog (same parity pattern as food bot)
- **Payments:** Same Razorpay / UPI stack (separate `.env` / number)

WhatsApp **phone number not finalized** — leave `WHATSAPP_*` empty for dry-run (`/simulate`).

## Quick start

```bash
cd acr-fresh-bot
cp .env.example .env
npm install
npm run db:init
BYPASS_CUTOFFS=1 npm run dev
# default PORT=3001 so it can run beside food order-bot on 3000
```

Dry-run:

```bash
curl -X POST http://127.0.0.1:3001/simulate \
  -H 'Content-Type: application/json' \
  -d '{"from":"919999999999","text":"Hi"}'
```

## How it differs from order-bot

| | Food order-bot | ACR-Fresh |
|--|----------------|-----------|
| Service | Lunch / Dinner cutoffs | Hourly delivery slots |
| Capacity | No per-slot cap | Lock slot at N orders (default 5) |
| Menu | Cooked dishes + Amma cooks | Vegetables + emergency staples |
| Order ref | `L`/`D` + date | `F` + date |
| Brand / number | Amma Chethi Ruchulu | ACR-Fresh / new SIM |
| Port (local) | 3000 | 3001 |

## Slot rules

- Window: **8:00–20:00 IST** (last window 19:00–20:00) — editable via ops `slot_open_hour` / `slot_close_hour`
- Capacity: **`slot_capacity`** (default 5)
- Lead time: book at least **`slot_lead_minutes`** (default 60) before slot start
- Occupying statuses: `pending_payment`, `paid`, `preparing`, `out_for_delivery`
- Customer picks slot **after cart, before address**; `finalizeOrder` re-checks capacity

## Meta setup (when SIM is ready)

1. Same Meta Business as Amma Chethi Ruchulu → add second WhatsApp number
2. Profile display name / photo for ACR-Fresh
3. Fill `WHATSAPP_ACCESS_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID`
4. Webhook → this app’s `/webhook` (separate host or path from food bot)
5. Optional: publish Flow from `docs/flow-order-fresh-v1.json`; Catalog sync from Admin

## Channel parity

Menu + prices live in `src/menu.js`. Slots in `src/cutoffs.js` / `src/slots.js`. Checkout shared via `src/orders/*`. Do not hardcode produce lists only in Flow JSON or Catalog.

See food bot rule: `../.cursor/rules/whatsapp-channel-parity.mdc` (same discipline here).

## Docs

- `docs/MENU_LIST.md` — customer-facing price list
- `docs/WHATSAPP_FLOWS_CATALOG.md` — Flows + Catalog
- Sibling food bot: `../order-bot/`
