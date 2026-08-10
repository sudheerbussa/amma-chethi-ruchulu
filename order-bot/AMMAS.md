# Ammas — architecture (MVP → weekly pay)

## Why

**Home cooks (“Ammas”) + dish names** are the USP of Amma Chethi Ruchulu.  
Customers on WhatsApp must see *who* cooks each dish. Ops needs directory + later **weekly payouts**.

## Data model

```text
ammas
  id (slug), name, phone?, upi_id?,
  payout_share_bps (e.g. 7000 = 70% of food gross on her lines),
  active, notes

dishes
  amma_id → ammas.id
  cook_name  (denormalized display name — WhatsApp USP)

order items (JSON on orders)
  code, name (customer-facing, includes Amma), base_name?,
  cook_name, amma_id, qty, unit_price_paise
  ↑ snapshot at checkout so historical weeks stay correct if menu changes

Future (schema reserved):
  amma_payout_weeks   (week_start, week_end, status: draft|approved|paid)
  amma_payout_lines   (week_id, amma_id, portions, gross, share, status)
```

## Customer display (WhatsApp)

| Surface | Format |
|---------|--------|
| List **title** (24 chars) | Dish name only |
| List **description** | `by Lakshmi Amma · ₹60 · 5 left` |
| Qty / cart / order / kitchen | `Tomato Pappu · Lakshmi Amma` |

Helpers: `src/ammas.js` → `formatDishLabel`, `formatDishListDescription`.

## Admin MVP

1. **Ammas** tab — list each Amma, dish count, share %, optional phone/UPI/notes; add/edit.  
2. **Menu editor** — Amma field (select existing Amma or type name).  
3. **Earnings (preview)** — this IST week, food gross × `payout_share_bps` per Amma from **paid and after** orders.

## Weekly payments (next phase)

1. Cron/admin action: **Close week** → insert `amma_payout_weeks` + lines from same aggregate as preview.  
2. Ops reviews → **Approve** → mark **Paid** (UPI outs of band, cash, NEFT).  
3. Optional WhatsApp weekly summary to Amma phone when onboarded.  
4. Never recompute **paid** weeks from live menu—only from **snapshotted** order lines.

## Default seed share

`payout_share_bps = 7000` (70% of **food** portion of paid lines attributed to that Amma).  
Platform holds delivery fee + remainder. Editable per Amma.

## Ops notes

- Production DB already seeded: boot runs `ensureAmmas` + backfills placeholder `cook_name` once from menu seed when value is blank / `Amma Kitchen`.  
- Admin-edited Amma/dish links are never wiped by package deploy.
