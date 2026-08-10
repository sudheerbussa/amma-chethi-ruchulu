# Deploy after every code update

**First time on a new VPS / what accounts & tools you need?**  
[`VPS-REQUIREMENTS.md`](./VPS-REQUIREMENTS.md) (checklist) → then [`SETUP-VPS.md`](./SETUP-VPS.md) (install steps).

This file is only for **updates after the bot is already installed**.

**App:** Amma Chethi Ruchulu WhatsApp order-bot  
**Production URL:** https://order.ammachethiruchulu.co.in  
**Server path:** `/opt/order-bot`  
**SSH:** `ssh root@206.189.138.213`  
**Process (pm2):** `acr-order-bot` only — do **not** restart or delete other pm2 apps  

Build with **esbuild** on the laptop, upload a **tarball**, extract on the VPS.  

**After deploying an Amma-related schema update**, on VPS once:

```bash
cd /opt/order-bot && npm run db:migrate && pm2 restart acr-order-bot
```

Bot boot also seeds Ammas and backfills placeholder cook names.

---

## Checklist — code update (use this every time)

### A. Laptop (build)

```bash
cd ~/SudhirLaptop_Backup/business_proposal/order-bot

# if dependencies changed:
npm install

# build esbuild bundle + release tarball
npm run package
```

Note the file path printed at the end, e.g.:

```text
release/acr-order-bot-YYYYMMDD-HHMMSS.tar.gz
```

### B. Laptop (upload)

Replace the filename with the one you just built:

```bash
scp ~/SudhirLaptop_Backup/business_proposal/order-bot/release/acr-order-bot-YYYYMMDD-HHMMSS.tar.gz \
  root@206.189.138.213:/tmp/
```

Only if **`.env` keys changed** (tokens, UPI, admins) — otherwise skip:

```bash
scp ~/SudhirLaptop_Backup/business_proposal/order-bot/.env \
  root@206.189.138.213:/tmp/order-bot.env
```

### C. VPS (deploy — preserve .env and orders)

SSH in:

```bash
ssh root@206.189.138.213
```

Then:

```bash
# 1) Extract
cd /tmp
tar -xzf acr-order-bot-YYYYMMDD-HHMMSS.tar.gz
# list folder name if unsure:
ls -d /tmp/acr-order-bot-*

# 2) Sync code ONLY — keeps production secrets + data
#    EXCLUDE .env and data/ (orders.json)
rsync -a \
  --exclude '.env' \
  --exclude 'data/' \
  /tmp/acr-order-bot-YYYYMMDD-HHMMSS/ \
  /opt/order-bot/

# 3) If you uploaded a new .env this round:
# cp /tmp/order-bot.env /opt/order-bot/.env
# chmod 600 /opt/order-bot/.env

# 4) Restart bot only
cd /opt/order-bot
pm2 restart acr-order-bot

# if restart says process not found (rare):
# pm2 start ecosystem.config.cjs
# pm2 save

# 5) Smoke test
curl -s http://127.0.0.1:3000/health
curl -sI https://order.ammachethiruchulu.co.in/health
pm2 status acr-order-bot
pm2 logs acr-order-bot --lines 30
```

Expect health JSON like: `{"ok":true,"business":"Amma Chethi Ruchulu"}`.

### D. Quick WhatsApp check

1. WhatsApp → bot number → `Hi`  
2. Confirm menus/cart still work  
3. Confirm laptop **cloudflared** is **stopped** (only VPS should receive webhooks)

### E. If something broke

```bash
pm2 logs acr-order-bot --lines 100 --nostream
pm2 describe acr-order-bot

# If you see "Dynamic require of path is not supported":
# rebuild locally with latest scripts/build.mjs (createRequire banner), redeploy.
```

Process must show **fork** mode (not cluster) and listen on **3000**:

```bash
ss -tlnp | grep 3000
curl -s http://127.0.0.1:3000/health
```

Do **not** touch:

- Other `pm2` processes (`WMS-QR-…`, `ent_backend`, `serverMonitor`, `slave_simulator`)  
- Caddy blocks for other hostnames  
- Postgres or ports 2024 / 4000 / 5000  

---

## One-shot copy-paste (update only)

After `npm run package` and `scp` of the **new** tarball name:

```bash
# --- on VPS ---
TS=YYYYMMDD-HHMMSS   # set this to match your tarball
cd /tmp && tar -xzf acr-order-bot-${TS}.tar.gz
rsync -a --exclude '.env' --exclude 'data/' \
  /tmp/acr-order-bot-${TS}/ /opt/order-bot/
cd /opt/order-bot && pm2 restart acr-order-bot
curl -s http://127.0.0.1:3000/health
curl -sI https://order.ammachethiruchulu.co.in/health
```

---

## First-time setup only (already done if live — reference)

### DNS

| Type | Name | Value |
|------|------|--------|
| A | `order` | `206.189.138.213` |

URL: **https://order.ammachethiruchulu.co.in**

Check (from VPS, not broken laptop DNS):

```bash
dig +short order.ammachethiruchulu.co.in @8.8.8.8
# expect: 206.189.138.213
```

### First install on VPS

```bash
mkdir -p /opt/order-bot
tar -xzf /tmp/acr-order-bot-YYYYMMDD-HHMMSS.tar.gz -C /tmp
rsync -a /tmp/acr-order-bot-YYYYMMDD-HHMMSS/ /opt/order-bot/
# secrets once
cp /tmp/order-bot.env /opt/order-bot/.env   # after scp from laptop
chmod 600 /opt/order-bot/.env
mkdir -p /opt/order-bot/data
cd /opt/order-bot
# PORT=3000 recommended in .env
pm2 start ecosystem.config.cjs
pm2 save
curl -s http://127.0.0.1:3000/health
```

### Caddy (once — append only)

Config file in use: **`/etc/caddy/Caddyfile`**

```bash
cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak.$(date +%Y%m%d)

# Only if this block is missing:
grep -q 'order.ammachethiruchulu.co.in' /etc/caddy/Caddyfile || cat >> /etc/caddy/Caddyfile <<'EOF'

# Amma Chethi Ruchulu WhatsApp order-bot
order.ammachethiruchulu.co.in {
	encode gzip
	reverse_proxy 127.0.0.1:3000
}
EOF

caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

### Meta webhook (once, or when URL changes)

| Field | Value |
|-------|--------|
| Callback URL | `https://order.ammachethiruchulu.co.in/webhook` |
| Verify token | `WHATSAPP_VERIFY_TOKEN` from `.env` (e.g. `amma_chethi_verify_2026`) |
| Subscribe | `messages` |

Stop local cloudflared after Meta verify succeeds.

---

## What ends up on the VPS after package

| Path | Purpose |
|------|---------|
| `dist/server.js` | esbuild bundle (app + express/dotenv) |
| `public/` | Admin HTML |
| `assets/` | UPI QR image (if present) |
| `ecosystem.config.cjs` | pm2 config (`acr-order-bot`, port 3000) |
| `.env` | **Server only** — never in git / tarball secrets |
| `data/orders.json` | Orders/stock DB — **never overwrite on update** |

---

## Local scripts

| Command | When |
|---------|------|
| `npm run dev` | Local development |
| `npm run build` | esbuild → `dist/server.js` only |
| `npm run package` | build + `release/acr-order-bot-*.tar.gz` |
| `npm run start:prod` | run bundle locally (`node dist/server.js`) |

---

## Ops URLs

| Purpose | URL |
|---------|-----|
| Health | https://order.ammachethiruchulu.co.in/health |
| Admin dashboard | https://order.ammachethiruchulu.co.in/admin |
| Webhook | https://order.ammachethiruchulu.co.in/webhook |

Admin bearer token = `ADMIN_TOKEN` in `.env`.

---

## Moving to your personal VPS later

1. Build + package + scp same way  
2. Install Node + pm2 + Caddy on new host  
3. Copy **`.env`** and **`data/`** from old VPS  
4. Point DNS **A** `order` to the **new** IP  
5. Meta webhook URL can stay the same if the hostname stays `order.ammachethiruchulu.co.in`
