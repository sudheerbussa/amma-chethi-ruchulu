# Full setup — new VPS (and how to use Postgres vs JSON)

This is the **from-zero** guide for Amma Chethi Ruchulu WhatsApp **order-bot**.

**Before you start:** skim the prerequisites inventory in [`VPS-REQUIREMENTS.md`](./VPS-REQUIREMENTS.md) (accounts, software, env vars, public URLs). Keep that file updated when new tools are added.

For **day-to-day code updates** after the bot is already live, use [`DEPLOY.md`](./DEPLOY.md) instead.

---

## Your choice of data store (read this first)

| Mode | When to use | How it is selected |
|------|-------------|--------------------|
| **Postgres** (production default) | VPS live bot | Set `DATABASE_URL`. pm2 sets `NODE_ENV=production` → bot **requires** it. |
| **JSON** | Laptop / quick local test | Leave `DATABASE_URL` empty |
| **JSON emergency on VPS** | Only if Postgres is down | `ALLOW_JSON_DB=1` + empty `DATABASE_URL` |

Rule used by the bot:

```text
If DATABASE_URL is set  →  always Postgres
If DATABASE_URL empty + NODE_ENV=production + no ALLOW_JSON_DB → refuse to start
If DATABASE_URL empty + local/dev (or ALLOW_JSON_DB=1) → JSON file at DATABASE_PATH
```

Check what is running:

```bash
curl -s http://127.0.0.1:3000/health
# "driver":"pg"   → Postgres  (expected on VPS)
# "driver":"json" → JSON file (local or emergency)
```

---

## Next step (pick one)

### A) Stay on JSON (simplest — no extra software)

Already configured if `.env` has only:

```env
DATABASE_PATH=./data/orders.json
# DATABASE_URL is absent or empty
```

On VPS after deploy:

```bash
cd /opt/order-bot
pm2 restart acr-order-bot
curl -s http://127.0.0.1:3000/health   # expect "driver":"json"
```

Nothing else required for the database.

### B) Enable Postgres (recommended when you can)

You will:

1. Install PostgreSQL (or Docker Postgres)
2. Create database + user
3. Put `DATABASE_URL=...` in `.env`
4. Run migration
5. Optionally import old JSON data once
6. Restart bot

Commands are in **§5 Enable Postgres** below.

### C) Fall back from Postgres to JSON

```bash
# on the VPS
cd /opt/order-bot
nano .env
# Comment out or delete this line:
# DATABASE_URL=postgres://...

# Ensure JSON path exists:
# DATABASE_PATH=./data/orders.json
mkdir -p data
pm2 restart acr-order-bot
curl -s http://127.0.0.1:3000/health   # expect "driver":"json"
```

**Note:** Orders that only exist in Postgres are **not** auto-copied back to JSON when you fall back. Export/backup Postgres first if you need that history.

---

## 1. What you need

### On your laptop (build)

- Node.js 18+
- This repo: `order-bot/`
- Meta WhatsApp Cloud API credentials (token, phone number id)
- Ability to SSH/SCP to the VPS

### On the VPS (run)

| Software | Purpose |
|----------|---------|
| Ubuntu 22.04+ (or similar) | OS |
| Node.js 18+ | Run `dist/server.js` |
| npm | Install `pg` (+ other deps shipped in release) |
| pm2 | Keep process alive |
| Caddy or Nginx | HTTPS reverse proxy |
| DNS A record | e.g. `order.yourdomain.com` → VPS IP |
| Open ports 80, 443 | Let’s Encrypt + HTTPS |
| **Either** nothing **or** PostgreSQL 14+ | JSON vs Postgres |

Port for the bot process: **3000** (localhost only; public traffic via Caddy).

---

## 2. New VPS — base install

SSH in as root (or sudo user):

```bash
ssh root@YOUR_VPS_IP
```

### 2.1 System packages

```bash
apt update && apt upgrade -y
apt install -y curl ca-certificates git ufw
```

### 2.2 Node.js 20 (example via NodeSource)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v   # v20.x
npm -v
```

### 2.3 pm2

```bash
npm install -g pm2
pm2 startup
# run the command it prints if asked
```

### 2.4 Firewall (VPS)

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

Do **not** expose Postgres (5432) to the public internet unless you know why.

### 2.5 Caddy (HTTPS)

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
```

Create `/etc/caddy/Caddyfile` (adjust domain):

```caddy
order.YOURDOMAIN.com {
	reverse_proxy 127.0.0.1:3000
}
```

```bash
systemctl enable --now caddy
systemctl reload caddy
```

DNS: create **A** record:

| Type | Name   | Value        |
|------|--------|--------------|
| A    | `order`| `YOUR_VPS_IP`|

Wait until `dig +short order.YOURDOMAIN.com` shows the VPS IP.

---

## 3. Build on laptop and upload

On the **laptop**:

```bash
cd ~/path/to/order-bot   # this project

npm install              # includes express, dotenv, pg
npm run package
# prints: release/acr-order-bot-YYYYMMDD-HHMMSS.tar.gz
```

Upload:

```bash
# replace stamp with the file you just built
TARBALL=acr-order-bot-YYYYMMDD-HHMMSS.tar.gz

scp release/${TARBALL} root@YOUR_VPS_IP:/tmp/
```

Optional (first time only): upload a filled `.env` from laptop:

```bash
scp .env root@YOUR_VPS_IP:/tmp/order-bot.env
```

Never commit real `.env` to git.

---

## 4. Install app on VPS (first time)

```bash
ssh root@YOUR_VPS_IP

# Extract tarball name from upload
TAR=acr-order-bot-YYYYMMDD-HHMMSS   # no .tar.gz

mkdir -p /opt/order-bot
cd /tmp
tar -xzf ${TAR}.tar.gz
rsync -a /tmp/${TAR}/ /opt/order-bot/

cd /opt/order-bot
mkdir -p data assets

# Env: copy template or the file you uploaded
if [ -f /tmp/order-bot.env ]; then
  cp /tmp/order-bot.env /opt/order-bot/.env
else
  cp .env.example .env
  nano .env   # fill tokens (see §7)
fi
chmod 600 .env

# Dependencies (pg + runtime libs; app logic is in dist/server.js)
npm install --omit=dev

# Start with pm2
pm2 start ecosystem.config.cjs
# or, if no ecosystem file:
#   pm2 start dist/server.js --name acr-order-bot --cwd /opt/order-bot
pm2 save
pm2 status
```

Smoke test:

```bash
curl -s http://127.0.0.1:3000/health
curl -sI https://order.YOURDOMAIN.com/health
```

Expect JSON with `"ok":true`.  
Default first install without `DATABASE_URL` → `"driver":"json"`.

---

## 5. Enable Postgres

### 5.1 Install Postgres on the VPS

**Option A — native (Ubuntu):**

```bash
apt install -y postgresql postgresql-contrib
systemctl enable --now postgresql

# Create role + database (change password!)
sudo -u postgres psql <<'SQL'
CREATE USER acr WITH PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
CREATE DATABASE acr_orders OWNER acr;
GRANT ALL PRIVILEGES ON DATABASE acr_orders TO acr;
\c acr_orders
GRANT ALL ON SCHEMA public TO acr;
SQL
```

**Option B — Docker (if Docker is installed):**

```bash
cd /opt/order-bot
# edit password in docker-compose.yml if needed
docker compose up -d
# default URL in example is:
# postgres://acr:acr_dev@127.0.0.1:5432/acr_orders
```

### 5.2 Point the bot at Postgres

Edit `/opt/order-bot/.env`:

```env
# JSON path is ignored while DATABASE_URL is set
DATABASE_PATH=./data/orders.json

DATABASE_URL=postgres://acr:CHANGE_ME_STRONG_PASSWORD@127.0.0.1:5432/acr_orders
```

### 5.3 Create tables + (optional) import old JSON

```bash
cd /opt/order-bot

# Apply schema (sql/schema.pg.sql)
npm run db:migrate

# ONE TIME only: if you already have pilot orders in data/orders.json
# (copy production JSON here first if needed)
npm run db:import-json
# or: node scripts/import-json-to-pg.mjs /path/to/orders.json
```

### 5.4 Restart and verify

```bash
pm2 restart acr-order-bot
curl -s http://127.0.0.1:3000/health
# must include: "driver":"pg"
```

If you see connection errors in `pm2 logs acr-order-bot`:

- wrong password / URL  
- Postgres not running: `systemctl status postgresql` or `docker compose ps`  
- `pg` module missing: `cd /opt/order-bot && npm install --omit=dev`

---

## 6. Fall back to JSON (commands)

```bash
cd /opt/order-bot
nano .env
```

**Disable Postgres** — comment out or remove:

```env
# DATABASE_URL=postgres://acr:...@127.0.0.1:5432/acr_orders
```

**Ensure JSON is ready:**

```env
DATABASE_PATH=./data/orders.json
```

```bash
mkdir -p /opt/order-bot/data
# Optional: restore a backup orders.json into data/
pm2 restart acr-order-bot
curl -s http://127.0.0.1:3000/health
# expect: "driver":"json"
```

You can leave PostgreSQL installed and unused; it only matters when `DATABASE_URL` is non-empty.

---

## 7. Required `.env` keys

Full matrix (always up to date): **[`VPS-REQUIREMENTS.md` §5](./VPS-REQUIREMENTS.md#5-environment-variables-checklist)**.

| Variable | Required | Notes |
|----------|----------|--------|
| `WHATSAPP_VERIFY_TOKEN` | Yes | Meta webhook verify string |
| `WHATSAPP_ACCESS_TOKEN` | Yes | Permanent or long-lived Meta token |
| `WHATSAPP_PHONE_NUMBER_ID` | Yes | Cloud API phone number id |
| `WHATSAPP_API_VERSION` | No | default `v21.0` |
| `PUBLIC_BASE_URL` | Yes | HTTPS origin for pay links + customers |
| `PORT` | No | default `3000` |
| `TZ` | No | use `Asia/Kolkata` |
| `BYPASS_CUTOFFS` | No | `0` production, `1` after-hours testing only |
| `LUNCH_CUTOFF_HOUR` | No | default `10` |
| `DINNER_CUTOFF_HOUR` | No | default `16` |
| `DATABASE_PATH` | JSON mode | default `./data/orders.json` |
| `DATABASE_URL` | **Yes on prod** | Postgres (see requirements doc) |
| `ALLOW_JSON_DB` | Emergency | `1` only if prod must use JSON |
| `BUSINESS_NAME` | No | display name |
| `SUPPORT_PHONE` | Yes | help contact |
| `RAZORPAY_KEY_ID` / `SECRET` | Recommended | Standard Checkout; empty → UPI path |
| `UPI_FALLBACK` | No | default `0` with Razorpay |
| `UPI_ID` / `UPI_PAYEE_NAME` | If no Razorpay | manual UPI |
| `UPI_QR_PATH` | No | path to QR image under deploy |
| `WHATSAPP_COMMUNITY_LINK` | No | optional community invite |
| `ADMIN_PHONES` | Yes | comma-separated, country code, no `+` |
| `ADMIN_USER` | No | default `superadmin` |
| `ADMIN_TOKEN` | Yes | admin **password** + API bearer |

---

## 8. Meta WhatsApp webhook

In Meta Developer → WhatsApp → Configuration:

| Field | Value |
|-------|--------|
| Callback URL | `https://order.YOURDOMAIN.com/webhook` |
| Verify token | same as `WHATSAPP_VERIFY_TOKEN` |
| Subscribe | `messages` |

Verify:

```bash
# From VPS or any machine once DNS works:
curl -sI https://order.YOURDOMAIN.com/health
```

Webhook must return challenge on GET (Meta does this during “Verify and save”).

---

## 9. Admin dashboard + kitchen

- Dashboard (browser): `https://order.YOURDOMAIN.com/admin`  
  Login: username `ADMIN_USER` (default **`superadmin`**), password = **`ADMIN_TOKEN`**  
  APIs after login use Bearer `ADMIN_TOKEN` (stored in browser after login).
- Admin phones: WhatsApp commands from numbers listed in `ADMIN_PHONES`  
  See [`OPS.md`](./OPS.md) for `ORDERS`, `PAID`, `COOK`, etc.

---

## 10. Day-to-day updates (after first install)

On laptop:

```bash
cd order-bot
npm run package
scp release/acr-order-bot-*.tar.gz root@YOUR_VPS_IP:/tmp/
```

On VPS (preserve `.env` and `data/`):

```bash
TAR=acr-order-bot-YYYYMMDD-HHMMSS
cd /tmp && tar -xzf ${TAR}.tar.gz
rsync -a --exclude '.env' --exclude 'data/' /tmp/${TAR}/ /opt/order-bot/
cd /opt/order-bot
npm install --omit=dev    # if package.json / deps changed
pm2 restart acr-order-bot
curl -s http://127.0.0.1:3000/health
```

Full checklist: [`DEPLOY.md`](./DEPLOY.md).

---

## 11. Backups

### JSON mode

```bash
# daily cron example
0 2 * * * cp /opt/order-bot/data/orders.json /opt/order-bot/data/orders-$(date +\%F).json
```

### Postgres mode

```bash
# dump
pg_dump "$DATABASE_URL" -Fc -f /root/backups/acr_orders-$(date +%F).dump

# restore (example)
pg_restore -d "$DATABASE_URL" --clean --if-exists /root/backups/acr_orders-YYYY-MM-DD.dump
```

---

## 12. Troubleshooting

| Symptom | Check |
|---------|--------|
| `"driver":"json"` but you set PG | Is `DATABASE_URL` non-empty in **production** `/opt/order-bot/.env`? Restart after edit. |
| `Cannot find package 'pg'` | `cd /opt/order-bot && npm install --omit=dev` |
| Bot crash on start with PG | `pm2 logs acr-order-bot --lines 50`; test `psql "$DATABASE_URL" -c 'select 1'` |
| Meta webhook 403 | verify token mismatch |
| WhatsApp no reply | token expired, wrong phone id, `pm2 logs` Graph API errors |
| Port 3000 in use | `ss -tlnp \| grep 3000`; only one `acr-order-bot` |

---

## 13. Quick reference card

```bash
# --- ENABLE POSTGRES ---
# 1. Postgres running + DB + user created
# 2. In .env:
#    DATABASE_URL=postgres://USER:PASS@127.0.0.1:5432/acr_orders
# 3. Migrate / import / restart
cd /opt/order-bot
npm run db:migrate
# npm run db:import-json   # optional once
pm2 restart acr-order-bot
curl -s http://127.0.0.1:3000/health   # "driver":"pg"

# --- FALL BACK TO JSON ---
# 1. In .env: remove/comment DATABASE_URL
# 2. DATABASE_PATH=./data/orders.json
mkdir -p /opt/order-bot/data
pm2 restart acr-order-bot
curl -s http://127.0.0.1:3000/health   # "driver":"json"
```

---

## Related docs

| Doc | Use for |
|-----|---------|
| [`VPS-REQUIREMENTS.md`](./VPS-REQUIREMENTS.md) | Prerequisites inventory (update when tools change) |
| [`SETUP-VPS.md`](./SETUP-VPS.md) (this file) | New server + PG/JSON |
| [`DEPLOY.md`](./DEPLOY.md) | Code update deploy loop |
| [`OPS.md`](./OPS.md) | Cutoffs, UPI, admin commands |
| [`README.md`](./README.md) | Local laptop dev |
