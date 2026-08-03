# WhatsApp Cloud API — test now (while Meta verifies)

**Status:** Business verification **done**. Next: publish app + live webhook test with `order-bot`.  
**Goal today:** Prove send/receive + your `order-bot` webhook works on the real path.  
**Official only** — Meta Cloud API (no Baileys / unofficial tools).

---

## What verification unlocked


| You can do now                                 | Still later                                          |
| ---------------------------------------------- | ---------------------------------------------------- |
| Publish app → Live (real phone → webhook)      | Higher production limits / broad marketing templates |
| Permanent System User token (recommended)      | Full production phone polish if still on test number |
| Webhook → local bot via Cloudflare Tunnel      | VPS deploy                                           |
| Connect business number `8886128995` when ready | FSSAI must finish before selling food                |

---



## Step 1 — Meta Developer App

1. Open [https://developers.facebook.com](https://developers.facebook.com)
2. Log in with the same Facebook account used for Amma Chethi Ruchulu Business Manager
3. **My Apps → Create App**
4. Use case: **Other** (or Business) → type **Business**
5. App name: `Amma Chethi Ruchulu Orders`
6. Select Business portfolio: **Amma Chethi Ruchulu** (if asked)

---



## Step 2 — Add WhatsApp

1. In the app dashboard: **Add Product → WhatsApp → Set up**
2. Open **WhatsApp → API Setup** (left menu)
3. You will see:
  - A **temporary access token** (copy — expires in ~24 hours; fine for first test)  
  - **Phone number ID** (test number Meta gives you)  
  - **WhatsApp Business Account ID**
4. Under **To**, click **Manage phone number list** → add **your personal WhatsApp** as a test recipient (OTP on that phone)
5. Click **Send message** on the sample curl / UI — you should get a WhatsApp from Meta’s test number

If that works, Cloud API is alive. Next: wire your bot.

---



## Step 3 — Values for `.env`

Copy from API Setup into `order-bot/.env`:

```bash
PORT=3000
TZ=Asia/Kolkata
BYPASS_CUTOFFS=1

WHATSAPP_VERIFY_TOKEN=amma_chethi_verify_2026
WHATSAPP_ACCESS_TOKEN=EAAcBURI8wHgBSOcXzlUHm4EkrP3ToHWbJfeewGf1uOyEr4T4O0v9VsfYHrFBLz5269IMZBmZBXs3zkH63rwul1vKXVwgRBgls5k0mBwtYyfqXInnoiRKNZAMmSFsiB1BZACxea2VTnvOb4EOpZAxZBt4aBCHWXUh7RuqHRzmP8l94P8Ps7jdeZC5oPGviJYL51DNTMZB9FAS8Wr66fhR2O1pso7DwsViq48i4RYZBU0je4CRh5U9p5cKcdt0fam6gB5wZBpXf29f2NAVZBLbx2okOOJhJmiKj4ZD
WHATSAPP_PHONE_NUMBER_ID=1189626347571635
WHATSAPP_API_VERSION=v21.0

DATABASE_PATH=./data/orders.json
BUSINESS_NAME=Amma Chethi Ruchulu
SUPPORT_PHONE=918886128995
```

- `BYPASS_CUTOFFS=1` so lunch/dinner work any time during testing  
- Temporary token expires — later replace with a **System User** permanent token (after verification)

---



## Step 4 — Run bot + HTTPS tunnel

Terminal A:

```bash
cd order-bot
cp .env.example .env   # if .env missing — then paste tokens
npm install
npm run db:init
npm run dev
```

Terminal B (public HTTPS for Meta):

```bash
# Install once if needed (from project root):
# wget -O bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
# chmod +x bin/cloudflared

../bin/cloudflared tunnel --url http://127.0.0.1:3000
# or system-wide: cloudflared tunnel --url http://127.0.0.1:3000
```

Copy the `https://….trycloudflare.com` URL.

---



## Step 5 — Register webhook in Meta

1. WhatsApp → **Configuration** (or App → WhatsApp → Configuration)
2. Callback URL: `https://YOUR-TUNNEL.trycloudflare.com/webhook`
3. Verify token: exactly `amma_chethi_verify_2026` (same as `.env`)
4. **Verify and save**
5. Subscribe to webhook field: **messages**

You should see `Webhook verified` in the bot terminal.

---



## Step 6 — End-to-end test

From the **test recipient** WhatsApp (the number you added in Step 2), message the **Meta test number**:

```
Hi
```

Then try:

```
Menu
Dinner
D1
2
Guntur test address
```

Bot should reply; check:

```bash
curl http://127.0.0.1:3000/orders
```

---



## After Meta shows Verified

1. Create permanent **System User** token (Business Settings → Users → System users) with `whatsapp_business_messaging`
2. Add / migrate real business number (current registered number: `+91 98235 83498`) and complete display name approval
3. Update `.env` Phone number ID + permanent token
4. Set `BYPASS_CUTOFFS=0`
5. Move bot to VPS later; keep same webhook path

---



## If something fails


| Symptom | Fix |
| ----------------------------- | ----------------------------------------------------------------------------- |
| Verify webhook 403 | Verify token mismatch — must match `.env` exactly |
| Meta shows message, bot has **no Inbound** | App still **unpublished** — see “Publish app” below. Also run WABA `subscribed_apps` |
| No inbound messages | Subscribe **messages**; tunnel URL must be current (tunnel restart = new URL) |
| Send fails 401 | Temporary token expired — generate new one in API Setup |
| “Recipient not in allow list” | Add that phone under test numbers |
| Bot dry-run only | `WHATSAPP_ACCESS_TOKEN` empty in `.env` |


---

## Publish app (required for real phone → webhook)

Meta warning: *while the app is unpublished, only dashboard test webhooks are delivered — not real WhatsApp messages.*

1. Meta Developers → your app **Amma Chethi Ruchulu Orders**
2. Top bar / App settings → **Publish** / switch from **Development** to **Live** (wording varies)
3. Confirm publish (this is **not** an App Store listing — it only allows production webhook data)
4. If Live is blocked until business verification, keep checking Security Centre

### Also subscribe WABA → app (Graph API)

From `order-bot/` with `.env` filled:

```bash
set -a && source .env && set +a
wget -qO- --method=POST \
  --header="Authorization: Bearer $WHATSAPP_ACCESS_TOKEN" \
  "https://graph.facebook.com/${WHATSAPP_API_VERSION}/2209791036533014/subscribed_apps"
echo
```

(Expect JSON with `"success": true`.)

### Prove tunnel works (dashboard test)

Configure Webhooks → field **messages** → **Test** / send test event.  
Bot terminal should show `Webhook POST` even if there is no real phone message.

---



## Send me when stuck / done

1. Screenshot of **WhatsApp → API Setup** (blur token)
2. Or: “webhook verified” + sample inbound log line
3. Whether test message arrived on your phone

