# WhatsApp Flows (Amma Chethi Ruchulu Food)

Official Cloud API only. **Order path = WhatsApp Flow.** Button/list bot is a silent fallback when `WHATSAPP_FLOW_ID` is empty or `sendFlow` fails. **View menu** sends poster image(s). Catalog sync is **dormant** (not used in chat).

## Feature flags (safe rollback)

| Env | Effect when empty |
|-----|-------------------|
| `WHATSAPP_FLOW_ID` | Lunch/Dinner use buttons only |
| `WHATSAPP_FLOW_PRIVATE_KEY` | `POST /flows` cannot decrypt (set before linking Meta endpoint) |
| `WHATSAPP_CATALOG_ID` | Catalog sync disabled (preferred for chat — leave empty) |
| `WHATSAPP_CATALOG_IMAGE_URL` | Sync refused if someone runs admin sync |

Add to `.env` (VPS):

```bash
WHATSAPP_FLOW_ID=
WHATSAPP_FLOW_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
WHATSAPP_FLOW_PASSPHRASE=
# Use draft while testing an unpublished Flow; switch to published after Meta Publish
WHATSAPP_FLOW_MODE=published
# Leave empty — Catalog is not a customer order channel
# WHATSAPP_CATALOG_ID=
```

Health check exposes `"flows": true/false` and `"catalog": true/false` (expect `catalog: false`).

---

## Flows setup (Meta Manager)

### 1. RSA key pair (laptop)

```bash
openssl genrsa -aes256 -out flow_private.pem 2048
openssl rsa -in flow_private.pem -pubout -out flow_public.pem
```

Upload **public** key via Graph:

```bash
curl -X POST "https://graph.facebook.com/v21.0/PHONE_NUMBER_ID/whatsapp_business_encryption" \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"business_public_key\":\"$(awk 'NF {sub(/\r/, \"\"); printf \"%s\\\\n\",$0;}' flow_public.pem)\"}"
```

Put the **private** PEM into `WHATSAPP_FLOW_PRIVATE_KEY` on the VPS (escape newlines as `\n`).

### 2. Data endpoint

- URL: `https://order.ammachethiruchulu.co.in/flows`
- App already mounts `GET/POST /flows` (encrypted POST).

### 3. Flow JSON screens (create in Flow Builder)

Match these **screen IDs** (endpoint routing in `src/flows/screens.js`):

| Screen ID | Purpose | Key fields submitted |
|-----------|---------|----------------------|
| `MEAL` | Lunch / Dinner (pre-selected when opened from chat button) | `meal` |
| `CATEGORY` | Dynamic categories | `category`, `meal` |
| `DISH` | Dynamic dishes (radio, required) | `dish_code`, `meal`, `category` |
| `QTY` | Quantity 1–30 → adds line to cart | `qty`, `dish_code`, `meal` |
| `CART` | Summary · **Add another** / **Checkout** | `next_step`, `meal` |
| `ADDRESS` | Text address | `address`, `meal` |
| `CONFIRM` | Summary → complete | `meal`, `address` |

Canonical JSON to paste in Meta Flow Builder: [`flow-order-v2.json`](./flow-order-v2.json).

Endpoint fills options dynamically from `menu.js` / DB. Cart is stored in the same DB session as the button bot (phone from `flow_token`).

On CONFIRM complete, chat receives `nfm_reply` → bot uses session cart → **map pin** (reuse saved pin if any, else ask) → auto delivery fee → Razorpay/UPI.

Pins with lat/lng are already stored on the customer when shared; Flow checkout offers **Use saved pin**.

### Tester allowlist

```bash
# Empty = all customers get Place order Flow (when FLOW_ID is set)
WHATSAPP_FLOW_ALLOWLIST=

# While testing only:
# WHATSAPP_FLOW_ALLOWLIST=918055292935,918886128995,918308354229
```

Health shows `flowAllowlist` count (0 = unrestricted).

**Primary UX:** Hi → **Order** → Lunch/Dinner → **Order form**. **View menu** → poster images. Reply `BUTTONS` for the old step-by-step path (code kept, not promoted).

**Pin in Flow:** Meta has no LocationPicker in Flows. Address screen can list **saved addresses / pins**; new GPS pin is still collected in chat after confirm (or applied automatically when a saved pin was chosen in the form).

### 4. Publish + env

1. Paste **flow-order-v2.json** into Meta → Publish → keep same Flow ID (or update `WHATSAPP_FLOW_ID`)
2. Clear `WHATSAPP_FLOW_ALLOWLIST` for all customers
3. `pm2 restart acr-order-bot --update-env`
4. Smoke: Hi → Order → Lunch/Dinner → Order form

### Flow JSON tip

Use Form + RadioButtons / Dropdown with `${data.meal_options}` style data bindings per Meta Flow docs. Set `data_api_version` to `3.0` and point data channel to your `/flows` URL.

---

## Catalog (dormant)

Admin commands `CATALOG STATUS` / `CATALOG SYNC` / `CATALOG SET` remain for optional Commerce Manager sync. **Do not set `WHATSAPP_CATALOG_ID` for chat** — customer Catalog Place order / product taps redirect to **Order** (Flow). Menu browsing = posters only.

To remove the Catalog **shop icon** from the WhatsApp chat header, see [HIDE_CATALOG_ICON.md](./HIDE_CATALOG_ICON.md).
