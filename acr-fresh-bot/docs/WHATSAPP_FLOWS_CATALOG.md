# WhatsApp Flows (ACR-Fresh)

Official Cloud API only. **Order path = WhatsApp Flow.** Button/list bot is a silent fallback when Flow is unset or `sendFlow` fails. **View menu** = poster image(s). Catalog sync is **dormant** (not used in chat).

ACR-Fresh uses **hourly delivery slots** (not lunch/dinner). Meal is always `fresh`. Publish [`flow-order-fresh-v1.json`](./flow-order-fresh-v1.json) — first screen is `SLOT`.

**Phone:** +91 **9392044833** · Phone Number ID `1346730061850877`  
**Host:** `https://fresh.ammachethiruchulu.co.in` · Flow endpoint `https://fresh.ammachethiruchulu.co.in/flows`  
**Webhook:** Meta stays on food bot URL; food bot forwards fresh `phone_number_id` to `http://127.0.0.1:3001/webhook`.

## Feature flags (safe rollback)

| Env | Effect when empty |
|-----|-------------------|
| `WHATSAPP_FLOW_ID` | Order uses buttons only |
| `WHATSAPP_FLOW_PRIVATE_KEY` | `POST /flows` cannot decrypt (set before linking Meta endpoint) |
| `WHATSAPP_CATALOG_ID` | Catalog sync disabled (leave empty for chat) |
| `WHATSAPP_CATALOG_IMAGE_URL` | Sync refused if someone runs admin sync |

Add to `.env` (VPS):

```bash
WHATSAPP_FLOW_ID=
WHATSAPP_FLOW_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
WHATSAPP_FLOW_PASSPHRASE=
WHATSAPP_FLOW_MODE=published
# Leave empty — Catalog is not a customer order channel
# WHATSAPP_CATALOG_ID=
```

Health check exposes `"flows": true/false` and `"catalog": true/false` (expect `catalog: false`).

---

## Flows setup (Meta Manager)

**Live (Aug 2026):** Flow ID `2222222978357187` · endpoint `https://fresh.ammachethiruchulu.co.in/flows` · status **PUBLISHED**

### Quick setup (laptop)

```bash
cd acr-fresh-bot
node scripts/flow-setup.mjs          # keys + create/publish (first time)
node scripts/deploy-flow-env.mjs 2222222978357187   # push private key to VPS
WHATSAPP_FLOW_ID=2222222978357187 node scripts/upload-flow-json.mjs   # re-upload JSON only
```

WABA id (Amma Chethi Ruchulu): `2336111803586962` · Fresh phone id: `1346730061850877`

### Tester allowlist

```bash
WHATSAPP_FLOW_ALLOWLIST=
# While testing: WHATSAPP_FLOW_ALLOWLIST=91xxxxxxxxxx
```

### Publish + env

1. Publish Flow in Meta / `flow-setup.mjs`
2. Empty allowlist = everyone gets Flow
3. Smoke: **Order** → **Order form** (SLOT first) · Reply `BUTTONS` for button path

---

## Catalog (dormant)

Admin `CATALOG STATUS` / `SYNC` / `SET` remain optional. Leave `WHATSAPP_CATALOG_ID` empty for chat. Catalog Place order / product taps redirect to **Order** (Flow). Browse = posters only.

---

## Code map

| Area | Path |
|------|------|
| Shared booking / dish lists | `src/orders/checkout-shared.js` |
| Hourly slots / capacity | `src/cutoffs.js` |
| Flow screens | `src/flows/screens.js` |
| Flow HTTP | `src/flows/endpoint.js` |
| Catalog sync (dormant) | `src/catalog/sync.js` |
| Wire Order + completion | `src/handlers/message.js` |

Channel parity: [`.cursor/rules/whatsapp-channel-parity.mdc`](../../.cursor/rules/whatsapp-channel-parity.mdc).
