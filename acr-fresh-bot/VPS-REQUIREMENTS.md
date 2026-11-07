# Order-bot — VPS requirements & prerequisites

**Purpose:** Single checklist of everything you need before deploying **Amma Chethi Ruchulu** order-bot on a personal VPS (or redeploying on a new one).

**How this file is maintained:** Update this doc whenever a **new external service, runtime dependency, env var, port, DNS path, or deploy tool** is added to the project. Step-by-step commands stay in [`SETUP-VPS.md`](./SETUP-VPS.md) and [`DEPLOY.md`](./DEPLOY.md).

| Doc | Use when |
|-----|----------|
| **This file (`VPS-REQUIREMENTS.md`)** | “What do I need?” before buying or configuring a server |
| [`SETUP-VPS.md`](./SETUP-VPS.md) | First install from zero (OS → Caddy → bot → Meta) |
| [`DEPLOY.md`](./DEPLOY.md) | Code update after the bot is already live |
| [`OPS.md`](./OPS.md) | Day-to-day kitchen / WhatsApp admin commands |
| [`README.md`](./README.md) | Local development |

---

## 1. Architecture (what runs where)

```text
Customer WhatsApp  →  Meta Cloud API  →  HTTPS webhook  →  Caddy (443)
                                                              ↓
                                                    reverse_proxy
                                                              ↓
                                                    order-bot :3000 (localhost)
                                                              ↓
                                         ┌────────────────────┼────────────────────┐
                                         ↓                    ↓                    ↓
                                   Postgres (prod)      Razorpay REST       Graph API send
                                   or JSON emergency    (pay checkout)      (messages/lists)
```

| Layer | Role |
|-------|------|
| **order-bot** | Express app (`dist/server.js` on VPS; `src/` on laptop) |
| **Meta WhatsApp Cloud API** | Receive webhooks; send buttons, lists, text |
| **Caddy / Nginx** | TLS certificates + reverse proxy to port 3000 |
| **pm2** | Keep `acr-order-bot` alive across reboots |
| **Postgres** | Orders, menu, feedback (production default) |
| **Razorpay** (optional) | Standard Checkout via `/pay/:orderRef` |
| **UPI** (optional / fallback) | QR + payee when Razorpay off or `UPI_FALLBACK=1` |

Public hostname example: `https://order.YOURDOMAIN.com`  
App install path (conventional): `/opt/order-bot`  
Process name (pm2): `acr-order-bot` only — do not restart other apps on a shared VPS.

---

## 2. Prerequisites — before you touch the VPS

### 2.1 Accounts & accounts access

| Account | Required? | Why | What you need ready |
|---------|-----------|-----|---------------------|
| **Meta / Facebook Developer** | **Yes** | WhatsApp Cloud API | App, WhatsApp product, **Phone number ID**, long-lived **Access token**, webhook verify string |
| **WhatsApp Business** number | **Yes** | Customer channel | Number registered / connected to Cloud API (test number OK for pilot) |
| **Domain DNS** | **Yes** (production HTTPS) | Webhook + pay links + admin | Domain you control; ability to create an **A** record |
| **Razorpay** | Strongly recommended live | Card/UPI via Standard Checkout | `Key ID` + `Key Secret` (start with **test** keys `rzp_test_…`) |
| **UPI merchant / VPA** | If not using Razorpay yet | Manual pay path | UPI ID + payee name + optional QR image |
| **WhatsApp Community** | Optional | Soft invite after pay/delivery | Invite link `https://chat.whatsapp.com/…` |
| **SSH access to VPS** | **Yes** | Deploy & ops | Root or sudo user + strong password or SSH key |

### 2.2 Domain & network

| Item | Requirement |
|------|-------------|
| DNS A record | e.g. `order.YOURDOMAIN.com` → VPS public IPv4 |
| Public ports | **22** (SSH), **80**, **443** open on VPS firewall |
| Not public | Postgres **5432**, app **3000** (bind localhost only) |
| TLS | Let’s Encrypt via Caddy (or Nginx + certbot) — Meta requires HTTPS for webhooks |

### 2.3 Laptop (build machine)

| Tool / asset | Version / note |
|--------------|----------------|
| **Node.js** | **≥ 18** (20 LTS recommended) |
| **npm** | Ships with Node |
| This repo | `order-bot/` complete tree |
| Build | `npm install` then `npm run package` → `release/acr-order-bot-*.tar.gz` |
| **esbuild** | DevDependency; used only at package time on the laptop |
| **SSH / SCP** | To upload tarball (and optionally `.env` once) |

Nothing in the release **must** be built on the VPS except `npm install --omit=dev` for runtime deps (`express`, `dotenv`, `pg`).

---

## 3. VPS software requirements

### 3.1 Minimum recommended stack

| Software | Minimum | Purpose |
|----------|---------|---------|
| **OS** | Ubuntu 22.04+ (or similar Debian/RHEL) | Server |
| **Node.js** | 18+ (20 recommended) | Run `dist/server.js` |
| **npm** | Matching Node | Install production packages |
| **pm2** | Latest global | Process manager, auto-restart |
| **Caddy** *or* Nginx | Current stable | HTTPS reverse proxy to `127.0.0.1:3000` |
| **PostgreSQL** | 14+ | Production data store |
| **curl** | Any | Health checks |
| **rsync**, **tar** | Standard | Deploy updates without wiping `.env` / data |
| **ufw** (or cloud security group) | — | Allow only SSH + HTTP/HTTPS |

### 3.2 Optional / alternate

| Software | When |
|----------|------|
| **Docker** + Compose | Run Postgres via `docker-compose.yml` instead of apt Postgres |
| **Nginx + certbot** | Instead of Caddy |
| **cloudflared** | Temporary tunnel for local Meta testing only (not production) |

### 3.3 Runtime npm packages (production)

Installed on VPS from release `package.json` (`npm install --omit=dev`):

| Package | Role |
|---------|------|
| `express` | HTTP server, webhooks, admin, pay page |
| `dotenv` | Load `/opt/order-bot/.env` |
| `pg` | Postgres driver |

No official `razorpay` npm SDK — payments use **HTTPS REST** to Razorpay.

### 3.4 Hardware sizing (personal / pilot)

| Scale | Rough VPS |
|-------|-----------|
| Pilot / low volume (dozens of orders/day) | 1 vCPU, 1 GB RAM (e.g. DigitalOcean droplet) is enough if Postgres + bot share the host |
| Shared box with other apps | Prefer **≥ 2 GB** RAM so other pm2 apps do not OOM the bot |
| Disk | ≥ 10 GB free after OS; backups of dumps add more |

---

## 4. Public URLs the bot exposes

Must be reachable at `PUBLIC_BASE_URL` (HTTPS):

| Path | Purpose |
|------|---------|
| `GET /health` | Liveness + driver (`pg`/`json`), meal flags, Razorpay on/off |
| `GET/POST /webhook` | Meta WhatsApp webhook |
| `GET /admin` | Ops dashboard (login) |
| `POST /admin/api/*` | Admin APIs (auth required except login) |
| `POST /admin/api/login` | Username + password → session token |
| `GET /pay/:orderRef` | Razorpay checkout page for customer |
| `POST /api/create-order`, `POST /api/verify-payment` | Pay session for checkout page |
| `GET /api/pay-info/:orderRef` | Bill breakdown for pay page |

Local/dev only (do not rely on in production):

| Path | Purpose |
|------|---------|
| `POST /simulate` | Fake inbound WhatsApp without Meta |
| `GET /orders` | Debug order list |

---

## 5. Environment variables checklist

Copy from [`.env.example`](./.env.example). Put secrets only on the VPS (or private vault). Never commit real `.env`.

### 5.1 Must-have for live WhatsApp

| Variable | Required | Notes |
|----------|----------|--------|
| `WHATSAPP_VERIFY_TOKEN` | **Yes** | Same string as Meta “Verify token” |
| `WHATSAPP_ACCESS_TOKEN` | **Yes** | Long-lived / system user token |
| `WHATSAPP_PHONE_NUMBER_ID` | **Yes** | Cloud API phone number id |
| `WHATSAPP_API_VERSION` | No | Default `v21.0` |
| `PUBLIC_BASE_URL` | **Yes** | e.g. `https://order.YOURDOMAIN.com` — used for pay links |
| `ADMIN_TOKEN` | **Yes** | **Admin UI password** (and API bearer secret) |
| `ADMIN_PHONES` | **Yes** | WhatsApp admin allowlist, `countrycode…`, no `+`, comma-separated |
| `SUPPORT_PHONE` | **Yes** | Shown in help copy |

### 5.2 Data store

| Variable | Production | Notes |
|----------|------------|--------|
| `DATABASE_URL` | **Required** | e.g. `postgres://USER:PASS@127.0.0.1:5432/acr_orders` |
| `DATABASE_PATH` | Fallback | JSON path if no URL / emergency |
| `ALLOW_JSON_DB` | Emergency | `1` only if prod must run without Postgres |
| `NODE_ENV` | Set by pm2 | `production` → requires Postgres unless `ALLOW_JSON_DB=1` |

**URL tip:** If the DB password contains `@`, `#`, `%`, etc., **URL-encode** it (e.g. `@` → `%40`).

### 5.3 Payments

| Variable | When | Notes |
|----------|------|--------|
| `RAZORPAY_KEY_ID` | Live pay via Razorpay | `rzp_test_…` then live |
| `RAZORPAY_KEY_SECRET` | With key id | Server-side only |
| `UPI_FALLBACK` | Optional | Default `0` when using Razorpay only |
| `UPI_ID` | UPI or fallback | VPA |
| `UPI_PAYEE_NAME` | UPI | Display name |
| `UPI_QR_PATH` | Optional | Image path under deploy (e.g. `./assets/upi-qr.jpeg`) |

If both Razorpay keys empty → UPI path is used (when UPI configured).

### 5.4 Admin dashboard login

| Variable | Default | Notes |
|----------|---------|--------|
| `ADMIN_USER` | `superadmin` | Login form username |
| `ADMIN_TOKEN` | (you set) | Login form **password** + Bearer token after login |

Browser: `https://order.YOURDOMAIN.com/admin` → Log in → Log out in sidebar.

### 5.5 Branding, cutoffs, extras

| Variable | Default / notes |
|----------|-----------------|
| `BUSINESS_NAME` | Brand string in messages |
| `PORT` | `3000` |
| `TZ` | Prefer `Asia/Kolkata` |
| `LUNCH_CUTOFF_HOUR` | `10` IST |
| `DINNER_CUTOFF_HOUR` | `16` IST |
| `BYPASS_CUTOFFS` | `0` on VPS; `1` only for local after-hours test |
| `MIN_ORDER_PAISE` / `FREE_DELIVERY_ABOVE_PAISE` | Optional money rules in paise |
| `WHATSAPP_COMMUNITY_LINK` | Optional community invite |

---

## 6. External tools & integrations inventory

Update this table whenever a new integration ships.

| Tool / service | Status in product | Config / surface | Notes |
|----------------|-------------------|------------------|-------|
| **Meta WhatsApp Cloud API** | Required | Graph API + webhook | Official only; no unofficial WhatsApp bridges |
| **PostgreSQL** | Required prod | `DATABASE_URL` + `npm run db:migrate` | JSON is local/emergency only |
| **Caddy** (or Nginx) | Required prod | Reverse proxy | TLS for Meta webhooks |
| **pm2** | Required prod | `acr-order-bot` | Do not manage unrelated processes |
| **Razorpay** Standard Checkout | Optional (recommended) | Keys + `/pay/*` | REST + HMAC verify; no SDK |
| **UPI (manual)** | Optional fallback | `UPI_*`, QR asset | When Razorpay off or `UPI_FALLBACK=1` |
| **WhatsApp Community** | Optional | `WHATSAPP_COMMUNITY_LINK` | Soft invite after paid/delivered/feedback |
| **esbuild** | Build-time only | Laptop `npm run package` | Not required on VPS |
| **Docker Compose** | Optional | Local/VPS Postgres | See `docker-compose.yml` |
| **Ammas (home cooks)** | Required USP | Tables `ammas`, dish `amma_id`/`cook_name`; admin + weekly earnings | [`AMMAS.md`](./AMMAS.md) |

---

## 7. Meta webhook prerequisites

In Meta Developer → WhatsApp → Configuration:

| Field | Value |
|-------|--------|
| Callback URL | `https://order.YOURDOMAIN.com/webhook` |
| Verify token | Exact match to `WHATSAPP_VERIFY_TOKEN` |
| Subscribed fields | At least **`messages`** |

Firewall must allow Meta → your **443**. Bot process answers only on localhost 3000 behind proxy.

---

## 8. First-time deploy prerequisites checklist

Tick before go-live:

- [ ] VPS provisioned with public IP; SSH works  
- [ ] Node 18+, npm, pm2 installed  
- [ ] Caddy/Nginx + A record → HTTPS health succeeds  
- [ ] Postgres installed; user + database created  
- [ ] App at `/opt/order-bot` with filled `.env` (`chmod 600`)  
- [ ] `npm install --omit=dev` and `npm run db:migrate`  
- [ ] `pm2 start` + `pm2 save` + `pm2 startup`  
- [ ] `/health` shows `"ok":true`, `"driver":"pg"`, correct `env`  
- [ ] Meta webhook verified (green)  
- [ ] Send a test WhatsApp to the business number  
- [ ] Open `/admin`, log in as `superadmin` + `ADMIN_TOKEN`  
- [ ] If Razorpay: test keys then place a **test** paid order via `/pay/…`  
- [ ] Backup plan for Postgres (`pg_dump`) scheduled  

Code-update loop after this: [`DEPLOY.md`](./DEPLOY.md).

---

## 9. Security prerequisites

| Practice | Why |
|----------|-----|
| Strong unique `ADMIN_TOKEN` | Full OMS access |
| Restrict SSH (key auth preferred; rotate shared passwords) | Server compromise |
| Never expose `5432` publicly | Database attack surface |
| `chmod 600 /opt/order-bot/.env` | Tokens, DB password, Razorpay secret |
| Prefer live Razorpay keys only after test pay works | Avoid accidental live charges during pilot |
| On shared VPS, only restart **`acr-order-bot`** | Don’t kill other services |
| Clear chat/history if you ever pasted root passwords or tokens into AI/tools | Leak prevention |

---

## 10. Validation commands (after any install or upgrade)

```bash
# On VPS
curl -s http://127.0.0.1:3000/health
# expect: "ok":true, "driver":"pg", "env":"production"

curl -sI https://order.YOURDOMAIN.com/health
# expect: HTTP/2 200

# Login API (expect 401 with wrong password)
curl -s -X POST http://127.0.0.1:3000/admin/api/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"superadmin","password":"wrong"}'

pm2 status acr-order-bot
pm2 logs acr-order-bot --lines 50
```

Health fields you may see: `business`, `driver`, `env`, `ist`, `bypassCutoffs`, `lunchOpen`, `dinnerOpen`, `razorpay`, `upiFallback`.

---

## 11. Changelog of this requirements doc

| Date | Change |
|------|--------|
| 2026-08-05 | Initial requirements doc: stack, env, Meta, Postgres, Razorpay, admin login (`ADMIN_USER`/`ADMIN_TOKEN`), paths, security |
| 2026-08-05 | Amma entities + payout architecture foundation (`AMMAS.md`, tables, admin Ammas tab) |

_When you add a tool or env var in code, add a row to **§6** and the matching **§5** line, then a short **§11** entry._
