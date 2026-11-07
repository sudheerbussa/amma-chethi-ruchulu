# Deploy rue-shop-bot (Decorative Lights shop)

Target: VPS `162.35.105.110` — same host as ACR bots and the marketing site.
App listens on **127.0.0.1:3002**; public URL **https://shop.rareuniqueelectronics.com**.

## 1. DNS (Hostinger)

| Type | Name | Points to |
|------|------|-----------|
| A | `shop` | `162.35.105.110` |

Keep existing `@` / `www` records for the marketing site.

## 2. Caddy

Append to `/etc/caddy/Caddyfile`:

```
shop.rareuniqueelectronics.com {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3002
}
```

Then:

```bash
caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy
```

## 3. App on VPS

```bash
# from laptop
rsync -az --delete \
  --exclude node_modules --exclude data --exclude .env \
  ./ root@162.35.105.110:/opt/rue-shop-bot/

ssh root@162.35.105.110 '
  cd /opt/rue-shop-bot
  npm ci --omit=dev
  # create .env once from .env.example — set Razorpay + PUBLIC_BASE_URL
  mkdir -p data
  pm2 start src/index.js --name rue-shop-bot || pm2 restart rue-shop-bot
  pm2 save
'
```

Production `.env` essentials:

```
NODE_ENV=production
ALLOW_JSON_DB=1
PORT=3002
PUBLIC_BASE_URL=https://shop.rareuniqueelectronics.com
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
ADMIN_TOKEN=...
```

## 4. Razorpay webhook

Dashboard → Webhooks → URL:

`https://shop.rareuniqueelectronics.com/api/razorpay-webhook`

Events: `payment.captured`.

## 5. Smoke test

```bash
curl -s https://shop.rareuniqueelectronics.com/health
curl -s https://shop.rareuniqueelectronics.com/api/storefront/menu | head
```

Open `/shop`, add a light, checkout (test keys), pay, confirm order in:

`curl -s -H "x-admin-token: $ADMIN_TOKEN" https://shop.rareuniqueelectronics.com/admin/orders`
