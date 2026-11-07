# ACR Referral Program — "Oka Customer, Oka Kotha Family"

One referral code and one wallet per customer, shared by **ACR Food** (`order-bot`) and **ACR Fresh** (`acr-fresh-bot`).
Goal: grow among locals by rewarding customers only when a friend's first order is actually delivered.

## Rules (decided 3 Oct 2026)

| Rule | Value (admin-editable) |
|---|---|
| Friend (referee) gets — Food | **One** Chicken Dum Biryani (single, `B04`) **or** Chepala Pulusu (2 pcs, `D18`) at **₹99**, no minimum — **or** ₹50 off on food ₹300+, whichever saves more (never both). Admin → Referrals: deal codes / price / text |
| Friend (referee) gets — Fresh | **₹50 off first order** (food ₹300+) |
| Referrer gets | **₹30 ACR Credit** per friend whose first order is **delivered** |
| Bonus tiers | None (one simple reward) |
| Min friend first order (food total) | ₹300 for the flat ₹50 (Food dish deal has no minimum). Referrer is rewarded if the friend's order used the referral welcome **or** reached ₹300 |
| Wallet use per order | Up to **50% of food total** |
| Credit expiry | 90 days from earning |
| Generic first-order ₹50 offer (Food) | **Removed** — replaced by referral welcome |

### Who counts as a "new customer"
- No paid / preparing / out-for-delivery / delivered order on **either** Food or Fresh.
- Only paid orders count — people who only messaged WhatsApp or visited the site are still "new".
- Offline / phone orders count once admin enters them in the portal (manual order) and marks them paid or COD.
- Cannot refer yourself (same phone).
- One referrer per friend, locked at the first valid code (first touch wins).
- Unpaid orders that get cancelled do not consume the friend's welcome discount.

### When the reward is paid
- On the friend's first order reaching **delivered** (not `paid` — COD is marked paid before cash is collected).
- Only if that order's food total ≥ min first order.
- If the delivered order was cancelled/refunded later by admin, admin can reverse the credit (manual ledger entry).

## Customer experience

### Getting a code
- Code auto-created on first need: name + 2 digits, e.g. `SHYAM27` (letters A–Z only, 3–8 letters + 2 digits, unique).
- WhatsApp command `REFER` (either bot) → code, ready-to-forward Telugu/English message, and a `wa.me` link that pre-fills `Hi SHYAM27`.
- Share prompt also sent after a delivered order (with feedback), not on every order.

### Using a code (friend)
- Ordering is **website only** (WhatsApp Flow / buttons off). WhatsApp replies with the signed website link.
- WhatsApp: any message containing a valid code (`Hi SHYAM27`, `ACR-SHYAM27`) or `referral <mobile>` → "✅ Referral applied" → website link. A bare number in normal chat is ignored.
- Website: review step has a **"Friend's code or mobile number"** box with an Apply check (`POST /api/storefront/referral-check`, nothing saved). Prefilled from `/food?ref=SHYAM27` / `/fresh?ref=SHYAM27`.
- **Phone must be verified.** Checkout only applies a typed referral when the site was opened from the signed WhatsApp link (`?t=`) for the same phone. Opened directly (no token): after a valid check the box shows **"Send on WhatsApp"** — a `wa.me` link to that brand's bot pre-filled `Hi SHYAM27` or `Hi, referral 98xxxxxxxx`. The bot links the referral to the WhatsApp number and replies with the signed website link; the cart is kept in the browser, so the discount shows at checkout.
- Admin manual / phone order: "Referral code or friend's number" field (admin is trusted).

### Referral by mobile number
- The friend may type the referrer's 10-digit number instead of the code.
- Accepted only if that number has a **paid order** on Food or Fresh. A code is created for them automatically so tracking is the same.
- Cannot be the same number placing the order (self-referral).
- Neither the website nor the WhatsApp reply shows the referrer's name or code for a number lookup, so it does not reveal who the number belongs to.

### Wallet (Phase 2)
- Command `WALLET` → balance + last entries.
- Amount used = min(balance, 50% of food, food after other discounts), whole rupees (`walletUseFor`).
- WhatsApp (Flow + buttons): applied automatically in `finalizeOrder`; shows as an `ACR Credit −₹X` offer line.
- Website: only when opened from the signed WhatsApp link (`?t=`) for the same phone; review step has a "Use ACR Credit" checkbox (default on).
- Admin manual order: "Use customer's ACR Credit" checkbox (default off).
- Order stores `meta.wallet_paise`. Ledger is debited when the order moves to `paid` (online pay or COD confirm) and refunded on `cancelled`. Both are idempotent per order. If the balance dropped between checkout and payment, only what is left is debited and a `[wallet] shortfall` line is logged.
- Expiry: unused credit older than 90 days is written off oldest-first (lazily on every balance read, and for everyone when the admin Referrals tab loads).

### Notifications
- Referrer: "🎉 Your friend's first order is delivered — ₹30 ACR Credit added" (sent by the bot whose order was delivered).
- WhatsApp only allows free-form messages within 24h of the customer's last message. If the send fails, the credit still exists; the next `Hi` / welcome shows the wallet balance. (Optional later: approved Meta template for reward alerts.)

## Architecture

### Where data lives
- Food and Fresh have **separate Postgres DBs**. Referral data lives in the **Food DB** (`acr_orders`).
- Food bot: uses its own `DATABASE_URL`.
- Fresh bot: new env `REFERRAL_DATABASE_URL` → Food DB. Unset = referrals disabled on Fresh.
- "Has ordered on the other brand?" check:
  - Food → Fresh DB via existing `FRESH_DATABASE_URL` (already used by cashbook).
  - Fresh → Food DB via `REFERRAL_DATABASE_URL`.

### Tables (created on startup, `CREATE IF NOT EXISTS`)

```sql
referral_codes (phone PK, code UNIQUE, name, brand, created_at)
referrals      (id, referee_phone UNIQUE, referrer_phone, code, brand, source,
                status pending|rewarded|rejected, first_order_ref, first_order_brand,
                reward_paise, rewarded_at, note, created_at, updated_at)
wallet_ledger  (id, phone, delta_paise, kind referral_reward|order_debit|order_refund|admin_adjust|expiry,
                brand, order_ref, referral_id, note, expires_at, created_by, created_at)
               -- unique (kind, brand, order_ref) for idempotency
```

Settings: `referral_settings` table (single row, JSON) in the Food DB (`enabled`, amounts, min order, wallet %, expiry days). Turning the program off stops new referrals and rewards; existing credit stays spendable.

### Code layout (same files in both bots — keep in sync)
- `src/referrals.js` — **identical in both bots** (brand from config): pool, schema, settings, codes, referrals, ledger, wallet (`walletUseFor`, `walletDebitForOrder`, `walletRefundForOrder`, expiry), customer copy, admin queries.
- `src/offers.js` — `applyOffers({ referralWelcome })` adds a `referral_welcome` line; `applyWalletCredit(pricing, amount)` adds the `wallet_credit` line last.
- Hooks:
  - `handlers/message.js` — code capture **before** greeting / name-entry handling; `REFER`, `WALLET` commands; welcome discount + wallet in `finalizeOrder`.
  - `orders/create-manual.js` — `referral_code` and `use_wallet` body fields (admin + web).
  - `storefront/routes.js` + web page — `?ref=` capture → `referral_code`; session returns `wallet`; checkout sends `t` + `use_wallet`.
  - `orders/status.js` — `paid` → debit, `cancelled` → refund, `delivered` → `onOrderDelivered(order)`.
  - Admin — Referrals tab (leaderboard, referral list with reject, wallet ledger + manual adjust, settings, CSV) and manual-order wallet checkbox.

### Channel parity
Flow, button bot, website and admin all price through `applyOffers` and create orders through `finalizeOrder` / `createManualOrder`; the referral welcome and wallet are applied there, never in a single channel.

## Abuse guards
- Reward only on delivered + min order; one referrer per friend; no self-referral.
- Cross-brand "new customer" check.
- Website wallet use only with the signed WhatsApp link (`?t=`), not a typed phone (Phase 2).
- Admin can reject a referral or reverse credit; every change is a ledger row.

## Phases

| Phase | Scope |
|---|---|
| 1 | Tables + settings, codes, `REFER`, code capture (WhatsApp / web / admin), friend discount (now ₹50, min ₹300), reward on delivered, referrer alert, admin Referrals tab, disable ₹50 first-order offer |
| 2 | Wallet spend at checkout (all channels, 50% cap), debit on confirm, refund on cancel, expiry, `WALLET` command |
| 3 | Share prompt after delivery, referral card poster, monthly top-referrer message |

## Deploy checklist (Phase 1 + 2)
1. Fresh `.env`: `REFERRAL_DATABASE_URL=<Food DB URL>` (same Postgres server; grant Fresh's DB user access or reuse Food credentials).
2. Deploy Food first (creates tables; boot removes the retired `first_order_50` offer), then Fresh. Ship `dist/server.js`, `public/admin.html`, and the storefront `index.html` for each.
3. Update posters / copy that advertise "First order ₹50 OFF" (specials poster) → "Friend referral ₹50 OFF".
4. Smoke:
   - `REFER` on both numbers → code + share text.
   - Friend `Hi CODE` → order ≥ ₹300 shows ₹50 off → mark delivered → referrer `WALLET` shows +₹30.
   - Referrer orders → `ACR Credit −₹X` line, max 50% of food → pay → `WALLET` shows the debit; cancel → refund.
   - Website via WhatsApp link shows the credit checkbox; typed phone without link does not.
   - WhatsApp `Hi` / `order` / old buttons → website link only; `status`, `help`, `REFER`, `WALLET` still answer.
   - Website referral box: friend's code ✅, number with a paid order ✅, own number ❌, number with no paid order ❌, existing paid customer as friend ❌.
   - Food website at 10 PM shows tomorrow's slots.
5. Offline customers: enter their orders in admin (manual order, mark paid / COD) so they count as existing customers.
