# Ops setup — menu, UPI, admin, dashboard

## Menu (Tenali homely)

Full catalog lives in `src/menu.js` (versioned). On bot start, dishes sync automatically.

**Order cutoffs (IST):** lunch by **10:00 AM** (serve ~12–3), dinner by **4:00 PM** (serve ~7–10).  
Testing: `BYPASS_CUTOFFS=1`.

**Rules baked into bot:**
- Min food order ₹100  
- Delivery 0–3 km ₹30 · 3–6 ₹45 · 6+ ₹60 · free if food ≥ ₹300  

---

## UPI (until Razorpay)

1. Replace `assets/upi-qr.jpeg`  
2. Set `UPI_ID` / `UPI_PAYEE_NAME` in `.env`  
3. Restart bot  

Razorpay stays **last** (preserve free days).

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
Tabs: **Orders** · **Menu / stock**

---

## Customer flow (non-payment complete)

1. Hi → Lunch / Dinner / My status  
2. Category → item list → qty → address → delivery distance  
3. UPI QR + `PAID <ref>` thank-you  
4. Admin READY → OUT → DONE notifies customer  

**Later (not now):** multi-item cart, Razorpay, VPS, FSSAI soft pilot.  
