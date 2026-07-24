# WhatsApp-First Business Plan — Specialist Home Kitchen (Scheduled Orders + Hub Packing)

**Working name:** DishByHome / Local Specialist Kitchen  
**Document date:** 20 Jul 2026  
**Companion doc:** `HOME_KITCHEN_DELIVERY_PLAN.md` (full tech roadmap)  
**Your constraints:** Lowest cost · WhatsApp-first validation · Android app built yourself in **Cursor** (no agency cost)

---

## 1. Business model (updated for your operations)

### What you sell
Authentic **signature dishes made by specialist homemakers** in one locality — not restaurant food, not instant delivery.

### How fulfilment works (your model)

```
Customer orders (ahead) → Cook prepares at home → You COLLECT from cooks
    → PACK at your hub → RIDERS deliver to customers
```

You are not only a marketplace — you are also **logistics + quality control + packaging**. That is good: it builds trust and consistent delivery experience.

### Order timing (scheduled, not on-demand)

| Meal | Customer must order by | Food ready / collect | Deliver window |
|------|------------------------|----------------------|----------------|
| **Lunch** | **7:00 AM same day** OR **day before (e.g. 8 PM)** | Morning collect from cooks | ~11:30 AM – 1:30 PM |
| **Dinner** | **2:00 PM same day** OR **day before (e.g. 10 AM)** | Afternoon collect from cooks | ~7:00 PM – 9:00 PM |

**Why this fits your USP:** homemakers cook in batches; you plan pickups; riders run fixed routes. No fake “30-minute delivery” promise.

**Capacity rule:** each cook publishes **max portions per meal slot**. When sold out, WhatsApp catalog / bot shows “full”.

---

## 2. Who does what

| Role | Responsibility |
|------|----------------|
| **Customer** | Orders via WhatsApp (later app), pays UPI, receives at address |
| **Cook (homemaker)** | Makes dish at home; hands sealed containers to your collector |
| **Hub ops (you / staff)** | Collect from cooks, QC check, pack, label, batch for riders |
| **Rider** | Pickup from **your hub only** (simpler than multi-cook routing) |
| **You (founder)** | Cook recruitment, menu, cutoffs, WhatsApp comms, payouts |

**Pilot size:** 8–12 cooks, 1 small hub (home kitchen / rented room), 3–5 riders, 30–80 meals/day target.

---

## 3. Money flow (simple)

| Item | Typical |
|------|---------|
| Customer pays | Dish price + delivery fee + optional packaging (₹10–20) |
| Cook gets | 70–75% of dish price |
| Rider gets | Fixed per delivery or per route |
| You keep | 25–30% food commission + delivery margin − packaging − ops |

**Payments in WhatsApp phase:** Razorpay **Payment Link** or UPI QR sent in chat after order confirmed. No expensive checkout integration needed at start.

---

## 4. WhatsApp-first launch — 4 phases

### Phase A — Manual (Week 1–4) · **₹0 software**

**Goal:** Prove demand in one society / 2–3 km radius without writing code.

**Setup (one afternoon):**

1. **Dedicated SIM** for business (not your personal number).
2. **WhatsApp Business app** (free) on a spare Android phone.
3. **Business profile:** name, locality, hours, “Order by 7 AM for lunch / 2 PM for dinner”.
4. **Catalog:** each dish = one product (photo, price, “Lunch slot” or “Dinner slot” in description).
5. **Quick replies:** `/menu` `/lunch` `/dinner` `/address` `/pay`
6. **Google Sheet** as order book (columns below).
7. **Broadcast list** (opt-in only): daily menu + cutoff reminder.

**Customer flow (manual):**

```
Customer: Hi / Lunch menu
You (or quick reply): Today's lunch from Geeta Aunty — Paneer paratha ₹120 (max 20).
                      Order: Name, Qty, Address, Phone. Pay UPI link after confirm.
Customer: 2 paratha, Tower B 402, Rahul 98xxxx
You: Confirmed #L042. Pay ₹260 (food + delivery). [Razorpay link]
Customer: [pays screenshot]
You: Received. Delivery 12–1 PM. Thanks!
```

**Google Sheet columns:**

`order_id | date | meal | cook | dish | qty | customer_name | phone | address | amount | paid_yes_no | status | rider | notes`

**Daily ops checklist:**

| Time | Action |
|------|--------|
| Previous evening | Post tomorrow lunch menu; close at cutoff |
| 6:30 AM | Export lunch orders; message each cook quantities |
| 8:00–10:00 AM | Collect from cooks → hub → pack & label |
| 10:30 AM | Assign lunch routes to riders |
| 11:30–1:30 PM | Lunch delivery |
| 10:00 AM | Post dinner menu for today/tomorrow |
| 2:00 PM | **Lunch cutoff passed** · Dinner orders lock at 2 PM |
| 3:00–5:00 PM | Collect dinner from cooks → pack |
| 6:30 PM | Dinner dispatch |
| 7:00–9:00 PM | Dinner delivery |
| Night | Cook payouts sheet; customer thank-you + tomorrow menu teaser |

**KPIs to track in sheet:** orders/day, repeat customers, cook utilisation %, cancellation rate, avg ticket.

---

### Phase B — Structured orders (Week 5–8) · **~₹0–500/mo**

**Goal:** Reduce typing errors; customers self-serve a bit more.

**Add (still almost free):**

| Tool | Cost | Use |
|------|------|-----|
| **Google Form** | Free | “Place lunch order” — dish, qty, address, slot |
| **Form → Sheet** | Free | Auto-append rows |
| **Razorpay Payment Links** | ~2% per txn | One link per order or daily batch |
| **WhatsApp labels** | Free | New / Paid / Out for delivery / Done |
| **Canva** | Free | Daily menu image for broadcast |

**Flow:** Broadcast image menu → link to Form → you confirm on WhatsApp → send payment link → update sheet.

Optional: **free WhatsApp auto-reply** (Business app) for “Menu” and “Order link” only — keep it simple; bad bots annoy users.

---

### Phase C — Official Meta automation only (Week 9–16) · **~₹500–3,000/mo**

**Constraint:** No Baileys / Evolution / OpenClaw / unofficial WhatsApp Web bots — ever.  
**Full design:** see `META_WHATSAPP_OFFICIAL_AUTOMATION.md`.

```
Customer WhatsApp
      ↓
Meta Cloud API (official) + WhatsApp Flows
      ↓
Your HTTPS Flow endpoint / webhook (Cursor-built)
      ↓
Supabase (orders, stock, cutoffs) + Razorpay / Payments API India
```

| Component | Cost | Notes |
|-----------|------|-------|
| **Meta Cloud API** | Free platform; pay per some template msgs | Service replies in 24h window = free |
| **WhatsApp Flows** | Included with Cloud API | In-chat order form + your decision endpoint |
| **Your webhook host** | ₹0–1,500/mo | Supabase / small VPS |
| **Razorpay** | ~2% | Payment link first; later in-chat Payments API |
| **Official BSP** (optional) | ₹1.5k–8k/mo | Only if you want a visual bot UI without coding |

**What to automate first (official):**

1. Keyword / button → lunch or dinner (reject if past cutoff).
2. Flow: dish → qty → address → confirm.
3. Payment link or WhatsApp Payments `order_details`.
4. After cutoff → utility template to each cook with quantities.
5. Rider batch list from your DB / Sheet.

**Do not automate yet:** refunds, complaints, menu changes — human takeover in WhatsApp.

---

### Phase D — Android app (Month 4+) · **build in Cursor**

**Goal:** Better discovery, repeat orders, cook/rider tools — you avoid ₹3–12L agency cost.

| App | Build order | Why |
|-----|-------------|-----|
| **Customer Android** | First | Menu, scheduled slots, pay, order history |
| **Ops admin (web)** | Second | Replace sheet for dispatch |
| **Cook app** | Third | Portion counts, ready time |
| **Rider app** | Fourth | Hub pickup routes only (simpler) |

**Stack for Cursor build:** Flutter + Supabase + Razorpay + Google Maps (budget caps). Same backend as WhatsApp bot — **one order table**, multiple channels (`source: whatsapp | app`).

**WhatsApp stays:** broadcasts, support, payment link fallback for non-app users.

**iOS later:** same Flutter codebase (~15–30% extra effort for store + testing).

---

## 5. WhatsApp API — when useful, when skip

### Option 1: WhatsApp Business app only (Phase A–B)

| Pros | Cons |
|------|------|
| Free | One phone, manual |
| Catalog built-in | No real multi-agent |
| Trusted by customers | Broadcast limits; no API |

**Best for:** 0–40 orders/day, you + 1 helper.

---

### Option 2: Official WhatsApp Cloud API + Flows (Phase C+)

| Pros | Cons |
|------|------|
| Compliant, stable | Per-message cost for some templates |
| Full chatbot via **WhatsApp Flows** + your decision endpoint | Business verification + template approval |
| Payments API (India) / Razorpay | Setup takes days, not minutes |
| Multiple agents via official BSP (optional) | Marketing templates expensive |

**India indicative rates (Meta, 2026 — verify before budgeting):**

| Message type | Approx rate | Your use |
|--------------|-------------|----------|
| **Service** (customer messaged you first, reply within 24h) | **Free** | Order chat, Flow, support |
| **Utility** (order confirmed, out for delivery, cook summary) | ~₹0.12/msg | Status updates outside 24h window |
| **Marketing** (promo blast) | ~₹0.86/msg | Daily menu broadcast — use sparingly |

**Cost control:**  
- Let customers **message you first** (`wa.me` links) → free service window.  
- Prefer **utility** templates for status, not marketing.  
- Use **Meta Cloud API direct** first; add BSP (Interakt / AiSensy / WATI) only if you want a visual builder and accept ₹1.5k–8k/mo.

**Rule of thumb:** Stay on **Business app until ~30–50 orders/week**. Then move to **Cloud API + Flows** (see `META_WHATSAPP_OFFICIAL_AUTOMATION.md`). Unofficial bridges are not used at any stage.

---

## 6. Official Meta automation only (decision system)

**Policy:** Unofficial WhatsApp bridges (Baileys, Evolution unofficial, OpenClaw WA Web, WAHA) are **out of scope**.

| Tool | Role |
|------|------|
| **WhatsApp Business app + Catalog** | Phase A–B manual orders |
| **Google Form + Sheet** | Structured capture before API |
| **Meta Cloud API + WhatsApp Flows** | Official order chatbot + decisions |
| **Your Flow endpoint** | Cutoff, stock, pricing (official Meta pattern) |
| **Payments API India / Razorpay** | Collect money |
| **Cursor + Flutter** | Android app later; same order DB |

**Practical path:**  
`Business app` → `Form + Sheet` → **`Cloud API + Flows + your webhook`** → Payments API → Flutter app in Cursor.

Details: `META_WHATSAPP_OFFICIAL_AUTOMATION.md`.

---

## 7. Sample WhatsApp messages (copy-paste templates)

### Daily lunch menu (broadcast — 7–8 PM previous day)

```
🍽 DishByHome — Tomorrow LUNCH (order by 7 AM)

1️⃣ Geeta — Paneer Paratha — ₹120 (20 left)
2️⃣ Lakshmi — Lemon Rice + curry — ₹100 (15 left)
3️⃣ Sunita — Gujarati thali — ₹150 (10 left)

📍 Tower A/B/C only
Reply: LUNCH [dish no] [qty] [tower+flat]
Or form: [link]

⏰ Closes 7:00 AM sharp
```

### Order confirm

```
✅ Order #L042 confirmed
2× Paneer Paratha — Geeta
Delivery: Tomorrow 12–1 PM
Total: ₹260 (incl. delivery)

Pay now: [Razorpay link]
Unpaid orders cancelled in 30 min.
```

### Cook summary (auto or manual)

```
Geeta ji — LUNCH tomorrow:
Paneer Paratha × 14
Ready by 9:30 AM at your home.
Collector Rahul will pick up 9:45–10:15.
```

### Cutoff passed

```
Sorry — lunch orders closed at 7 AM.
Next: dinner menu at 10 AM (order by 2 PM).
```

---

## 8. Hub operations detail

### Why hub packing wins for you

| Benefit | Explanation |
|---------|-------------|
| **One rider pickup** | Riders come to your hub, not 8 cook homes |
| **Quality check** | Seal, label, temperature bag before dispatch |
| **Branding** | Sticker, napkin, thank-you card in every bag |
| **Route planning** | Batch by tower / street |

### Minimal hub setup (low cost)

| Item | One-time cost |
|------|---------------|
| Table, shelves | ₹2,000–5,000 |
| Insulated bags | ₹500–1,500 each |
| Labels (order ID, allergens) | ₹500/mo |
| Handwash, gloves, hair net | ₹300/mo |
| Optional: small fridge | ₹5,000–15,000 |

**Space:** start from home garage / spare room; rent micro-kitchen only after 60+ meals/day.

### Collector route (morning)

1. Print cook pickup list from sheet.  
2. Visit cooks in geographic order (minimise travel).  
3. Check: quantity, sealed, label matches order IDs.  
4. Return hub by 10:00 AM for lunch pack.

---

## 9. Cost summary — WhatsApp-first path

### Software & tools (monthly)

| Phase | Tools | Est. monthly |
|-------|-------|--------------|
| **A — Manual** | WA Business, Sheet, Razorpay links | **₹0** (+ 2% on payments) |
| **B — Form** | + Google Form, Canva | **₹0–200** |
| **C — Official automation** | Cloud API + Flows endpoint + Supabase + utility msgs | **₹500–3,000** |
| **C+ — Optional BSP** | Interakt / similar on Cloud API | **+₹1,500–8,000** |
| **D — Android (Cursor)** | Supabase, FCM, Maps (careful), Play $25 once | **₹0–3,000** early |

### What you deliberately avoid early

| Skip until needed | Why |
|-------------------|-----|
| Paid CRM (Interakt, WATI) | ₹1.5k–8k/mo |
| Marketing WhatsApp API blasts | ₹0.86/msg adds up |
| Agency app build | ₹3–12L+ |
| Live GPS tracking | Maps API cost; hub model needs less |
| SMS OTP | WhatsApp is already identity channel |

### Operating costs (usually bigger than software)

| Item | Est. |
|------|------|
| Packaging per order | ₹10–25 |
| Rider per delivery | ₹25–50 |
| Collector (you or staff) | Time / ₹200–500/day |
| Cook tasting & onboarding | One-time |
| Society / locality marketing | ₹2,000–10,000 pilot |

---

## 10. Legal & trust (short)

- **FSSAI:** register as petty food business / home kitchen rules for your state.  
- **GST:** consult CA when turnover crosses threshold.  
- **Rider:** clear contractor vs employee model.  
- **Allergens:** ask cooks; print on label.  
- **WhatsApp:** only message people who opted in; no spam lists from purchased numbers.

---

## 11. 90-day roadmap (WhatsApp → Android)

| Weeks | Business | Tech |
|-------|----------|------|
| 1–2 | Pick locality, recruit 5 cooks, taste test | WA Business + Catalog + Sheet |
| 3–4 | 20–30 real orders/week manual | Quick replies, Razorpay links, KPIs in sheet |
| 5–6 | Add 3 cooks, fix delivery windows | Google Form, menu images |
| 7–8 | Target 50 orders/week | Optional: VPS + Typebot prototype |
| 9–10 | Hire part-time collector if needed | Supabase schema; start **customer app in Cursor** |
| 11–12 | Closed beta 80 meals/week | Android internal test; WA + app same backend |

---

## 12. Android app in Cursor — what to build first

When moving from WhatsApp, the app should mirror what already works:

**MVP screens (customer):**

1. Home — today’s lunch/dinner with **countdown to cutoff**  
2. Cook / dish detail  
3. Cart — slot selection (lunch/dinner + date)  
4. Address (geofenced)  
5. Pay — Razorpay  
6. Orders — status: Confirmed → Packed → Out → Delivered  

**Backend:** one `orders` table; WhatsApp bot and app both write here.

**You save money by:** using Cursor for Flutter UI, Supabase free tier, skipping live map tracking in v1 (show text status only).

---

## 13. Decision checklist

- [ ] Locality + towers / streets defined  
- [ ] Lunch cutoff 7 AM · Dinner cutoff 2 PM — communicated everywhere  
- [ ] Hub address for riders  
- [ ] 8+ cooks with max portions per slot  
- [ ] Collector + 3 riders identified  
- [ ] Dedicated WhatsApp business number  
- [ ] Google Sheet order template ready  
- [ ] Razorpay account for payment links  
- [ ] Phase C tools: only after 30+ orders/week  

---

## Summary

Your model — **scheduled orders, cook → hub → rider** — fits WhatsApp-first launch. Start **free** with WhatsApp Business + Catalog + Google Sheet + Razorpay links. Automate only via **Meta Cloud API + WhatsApp Flows + your decision endpoint** (no unofficial bots). Keep customer-initiated chats for free service replies; use utility templates sparingly; avoid marketing blasts early. Build the **Android app in Cursor** once demand is proven — same order DB as WhatsApp. Biggest costs are **riders, packaging, and cook payouts**, not software.
