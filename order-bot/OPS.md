# Ops setup — menu, UPI, admin, dashboard

## Menu (Tenali homely)

Full catalog lives in `src/menu.js` (versioned). On bot start, dishes sync automatically.

**Order cutoffs (IST) — finalized:**

| Meal | Order by (same day) | Serve / delivery |
|------|---------------------|------------------|
| **Lunch** | **10:00 AM** | **12:00–3:00 PM** |
| **Dinner** | **4:00 PM** | **7:00–10:00 PM** |

Welcome shows **today’s date + weekday** and each meal OPEN/CLOSED.  
If closed, bot states **cutoff passed for today (date)** and **next open day (date + weekday)** with order-by + serve times.

Customers can **pre-order the next day** after that meal’s deadline (confirm slot).  
Same-day cart is cleared only if cut-off hits mid-order without an advance service date.  
Customer **Cancel** of pending payment only while that meal is still open (or for future-day pre-orders); after same-day deadline → **HELP** (admin may still `CANCELORD`).  
`BYPASS_CUTOFFS=1` for local testing only.  

**Rules baked into bot:**
- Min food order ₹100  
- Delivery 0–3 km ₹30 · 3–6 ₹45 · 6+ ₹60 · free if food ≥ ₹300  

---

## UPI / Razorpay

**Razorpay on VPS (recommended):**
1. Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (test keys OK first)  
2. `PUBLIC_BASE_URL=https://order.ammachethiruchulu.co.in`  
3. `UPI_FALLBACK=0` (default) → pay link only, auto-paid after checkout  

**UPI fallback (optional):** set `UPI_FALLBACK=1` if you still want QR + manual `PAID` when Razorpay is on.  
**UPI only:** leave Razorpay keys empty → QR + `PAID` as before.

Endpoints: `POST /api/create-order`, `POST /api/verify-payment`, `GET /pay/:orderRef`.

## Database

**VPS production:** Postgres only (`DATABASE_URL` required; see SETUP-VPS.md).  
**Local:** JSON if `DATABASE_URL` empty.  
`/health` → `"driver":"pg"` or `"json"`.

```bash
# Postgres (VPS)
npm run db:migrate
# optional once: npm run db:import-json
```

---

## WhatsApp admin commands

| Command | Effect |
|---------|--------|
| `ADMIN` | Help |
| `ORDERS` / `PENDING` | Lists |
| `PAID\|READY\|OUT\|DONE\|CANCELORD <ref>` | Status + notify customer |
| `COOK` / `COOK DINNER` | Kitchen + packing summary |
| `MENU` | All dishes + stock |
| `STOCK V01 20` | Set max portions |
| `OFF V01` / `ON V01` | Hide / show dish |

`ADMIN_PHONES` = ops WhatsApp numbers (91…).

---

## Local dashboard

http://127.0.0.1:3000/admin — token = `ADMIN_TOKEN`  
Tabs: **Orders** · **Menu / stock** · **Feedbacks** (+ help tickets)

---

## Customer flow (non-payment complete)

1. Hi → Lunch / Dinner / **Help**  
2. Category → item → qty → **cart** (Add more / Checkout / **Edit cart**)  
   - Edit: pick a line → set qty 1–5 or **Remove item** (or CLEAR all)  
3. Address → delivery distance  
4. UPI QR + `PAID <ref>` thank-you (or **Help** if payment stuck)  
5. Admin READY → OUT → DONE notifies customer  
6. **After DONE:** rating for **only ordered item(s)** → optional comment  
7. If they **SKIP** or leave mid-rating → one soft **Rate now** nudge on next Hi; anytime `RATE`  
8. Admin `FEEDBACKS` / `HELPS` or dashboard Feedbacks tab  

**Multi-item cart:** up to 10 different dishes; Edit cart for qty/remove.  

**Customer memory:** name (first visit) · saved addresses (pick / new) · optional last distance ·  
**Again** re-orders last successful cart when available. Orders store `customer_name`.  

**Language:** Telugu-first customer copy; menu dish names still mostly English codes (hybrid). Admin English.  

**Later:** full menu Telugu names, Razorpay, personal VPS migration.  
 
