# Rare & Unique Electronics — shop bot

Slim Express shop (same pattern as ACR food/fresh): Decorative Lights catalog, website cart, pickup/local/courier shipping, Razorpay pay, thin WhatsApp.

- Storefront: `/shop`
- Pay: `/pay/:orderRef`
- Health: `/health`
- Admin orders: `GET /admin/orders` with `x-admin-token`

Catalog source of truth: `src/menu.js` (bump `MENU_VERSION` when prices change).

```bash
cp .env.example .env
npm install
npm run dev
# http://127.0.0.1:3002/shop
```

See [DEPLOY.md](DEPLOY.md) for VPS + DNS + Caddy.
