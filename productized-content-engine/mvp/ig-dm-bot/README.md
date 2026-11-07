# IG DM Bot — comment keyword → private reply

Listens for Instagram **comment** webhooks and sends **one** private DM when the comment matches a keyword (ACR: `MENU` → WhatsApp order link).

Uses Instagram API with **Facebook Login** (Page access token) — same Meta app as `ig-poster`.

## Layout

```text
server.mjs          HTTP webhook + health
private-reply.mjs   POST /{PAGE_ID}/messages
rules.mjs           keyword match
webhook.mjs         parse Meta payloads
clients/acr.json    MENU → wa.me reply
META-SETUP.md       App permissions + webhook UI steps
```

## VPS

```text
/opt/ig-dm-bot/
/data/ig-dm-bot/processed-comments.json
https://order.ammachethiruchulu.co.in/webhooks/instagram
```

Caddy must route `/webhooks/instagram` to `127.0.0.1:3010` **before** the order-bot catch-all.

## Setup

1. Follow **[META-SETUP.md](META-SETUP.md)** (scopes, long-lived Page token, webhook subscribe, message access ON).
2. On VPS `/opt/ig-dm-bot/.env` must include `PAGE_ID`, `ACCESS_TOKEN`, `APP_SECRET`, `VERIFY_TOKEN`, `IG_USER_ID`.
3. Caddy on `order.ammachethiruchulu.co.in` proxies `/webhooks/instagram*` and `/health-ig-dm` → `127.0.0.1:3010`.
4. `pm2 start server.mjs --name ig-dm-bot --cwd /opt/ig-dm-bot` then `pm2 save`.

Callback URL for Meta:

```text
https://order.ammachethiruchulu.co.in/webhooks/instagram
```

Read verify token: `grep VERIFY_TOKEN /opt/ig-dm-bot/.env`

## Test

```bash
npm run test:rules
curl -sS http://127.0.0.1:3010/health
# From a second IG account: comment MENU on an ACR post → check DM
```

## Rules

Edit `clients/acr.json` — `match`, `mode` (`exact` | `contains`), `reply` text. Restart pm2 after edits.
