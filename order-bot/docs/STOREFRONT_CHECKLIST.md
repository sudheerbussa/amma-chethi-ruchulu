# Food / Fresh web storefront — mandatory later checklist

Do **after** Phase 3–4 (checkout + WA deep link) work on both Food and Fresh, **before** heavy IG promotion of the web order URLs.

This is a **required** gate, not optional polish.

## 1. Design (Vercel / Cursor skills)

Use workspace skills when upgrading the UI (today’s `/food` is a lean static page):

| Skill / guide | Use for |
|---------------|---------|
| `react-best-practices` (Vercel plugin) | If/when storefront moves to React/Next components |
| `nextjs` / `shadcn` (Vercel plugin) | If rebuilding as Next + shadcn on Vercel or hybrid |
| Cursor user rule: frontend design | Brand-first hero, no generic AI layouts, motion, accessibility |
| Existing `public/pay.html` palette | Keep Food/Fresh visual family consistent with pay |

**Goals:** clearer hierarchy, better mobile cart UX, dish image gallery, Telugu+EN balance, loading/empty/error states.

## 2. Security review (mandatory)

Run before public ads / “order on website” as primary CTA:

- [x] Rate-limit `POST /api/storefront/checkout` (and slots/menu if abused) — **PASS soft** (8/15m in-memory; 429 live). Strengthen before heavy IG.
- [x] Validate phone, address length, qty caps, slot membership server-side (never trust client totals) — **PASS** (code review + Security Review)
- [x] CORS: storefront APIs same-origin only (or strict allowlist) — **PASS** (OPTIONS/GET; no `Access-Control-Allow-Origin`)
- [x] No secrets in client JS; Razorpay keys only on pay flow as today — **PASS** (`/food` HTML scan)
- [x] Signed WA deep-link tokens (Phase 4) — **TTL 48h** (product decision). Phone binding on checkout **not required** (ops gets unpaid alerts; kitchen serves paid / confirmed only — same as WA Flow). Prefer dedicated `STOREFRONT_LINK_SECRET` in prod when convenient.
- [x] Admin dish-image upload: auth already required — confirm size/type limits stay enforced — **PASS** (401 unauth; MIME/5MB; code sanitize)
- [x] Run Cursor **Security Review** subagent on storefront + checkout diff — done 2026-09-17 (3 medium findings; phone-bind + rate-limit hardening deferred by product)
- [x] Smoke: unpaid order flood, invalid slot, out-of-zone pin, XSS in name/address display — flood→429; closed window after 9:30; XSS via `esc()`; zone endpoint present (`/api/storefront/zone`)

## 3. Product parity

- [ ] Food `/food` and Fresh `/fresh` both complete — Food only
- [x] Same create-order rules as WhatsApp (menu, fees, min order, slots) — Food path uses `createManualOrder`
- [ ] Marketing site CTAs point to storefronts
- [ ] IG bio / stories updated

## Status

| Phase | Status |
|-------|--------|
| 1 Browse + search | Done (Food) |
| 2 Dish images | Done (Food) |
| 3 Web checkout | Done (Food) — live smoke 2026-09-17 |
| 4 WA deep link | Done (Food) — CTA “Order on website”; TTL 48h |
| Design skills pass | **Mandatory later** |
| Security review | **Accepted soft-launch posture** — no phone bind; rate limits OK for now; TTL 48h |
| Fresh replicate | After Food verified |

## Product decisions (2026-09-17)

- Do **not** bind checkout phone to WA token (unpaid → ops alert; serve only after pay/confirm).
- Link TTL = **48 hours**.
- Current in-memory checkout rate limit is fine for now.

## Checklist test log (2026-09-17 ~21:30 IST)

Live `https://order.ammachethiruchulu.co.in`:

| Check | Result |
|-------|--------|
| `GET /api/storefront/menu` | 73 items, `orderingOpen: false` (after last-order 9:30) |
| `GET /api/storefront/slots` | 0 slots, closed |
| `GET /api/storefront/session?t=bad` | 401 Invalid or expired link |
| `POST /api/storefront/checkout` | 429 rate limit (already tripped) |
| Checkout flood ×12 | all 429 |
| `GET /media/dish/NOPE99` | 404 |
| `PUT /admin/api/dishes/S01/image` no auth | 401 |
| `GET /food/` | 200; no secrets in HTML |
| CORS | no permissive ACAO |
| Dish path sanitize | `../../etc/passwd` → null find; writes only under `data/dish-images/` |
| Security Review | No critical; medium: phone binding, secret/TTL, thin rate limits |

**Verdict (updated):** soft / friends OK. Phone bind and stricter rate limits deferred. Deploy **48h TTL** before relying on WA deep links.
