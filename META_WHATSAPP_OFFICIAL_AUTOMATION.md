# Official Meta WhatsApp Automation Plan (No Unofficial Methods)

**Constraint:** Only Meta-approved WhatsApp Business Platform / Cloud API.  
**Forbidden at every stage:** Baileys, Evolution (unofficial), WAHA, OpenClaw WhatsApp Web linking, any “WhatsApp Web scraper” bot.  
**Companion docs:** `WHATSAPP_FIRST_BUSINESS_PLAN.md`, `HOME_KITCHEN_DELIVERY_PLAN.md`  
**Date:** 22 Jul 2026

---

## 1. Direct answer

**Yes.** You can design a **decision-based order + payment system** using Meta’s official stack:

| Meta building block | What it does for you |
|---------------------|----------------------|
| **WhatsApp Cloud API** | Send/receive messages, buttons, lists, webhooks |
| **WhatsApp Flows** | Multi-screen in-chat forms (meal → dish → qty → address) with **server-side decisions** |
| **Message templates** | Cutoff reminders, “out for delivery”, cook summaries (when outside 24h window) |
| **Catalog / Commerce** | Browse dishes inside WhatsApp |
| **Payments API (India)** | UPI / Razorpay / PayU **inside WhatsApp** (`order_details` invoice) |
| **Your backend (Cursor)** | Cutoff rules, stock, cook capacity, payment verify, hub packing lists |

Meta does **not** give you a full “Zapier inside WhatsApp Manager” for complex food logistics.  
**Decision logic lives on your endpoint** — Meta Flows call your HTTPS API; you return the next screen / sold-out / closed.

That is still **100% official**.

---

## 2. What Meta alone can do vs what you must build

### Inside Meta (WhatsApp Manager / Flows Builder)

- Create **Flows** (screens, dropdowns, text fields, radio buttons)
- Publish templates (utility / marketing)
- Connect **Catalog**
- Link **payment configuration** (Razorpay / PayU, India)
- View quality rating, phone number, message limits

### On your server (you build in Cursor — still official)

- Is lunch open? (before 7 AM?)
- Which dishes still have portions left?
- Which cook for this dish?
- Total = food + delivery
- Create order ID → send payment invoice
- On paid webhook → lock order
- After cutoff → message cooks with quantities
- Packing / rider lists for hub

**Rule:** Meta = channel + UI forms + payments plumbing.  
**You** = business rules (cutoffs, capacity, hub ops).

---

## 3. Architecture (official only)

```
Customer WhatsApp
       │
       ▼
Meta Cloud API  ◄──── WhatsApp Manager (Flows, templates, catalog, payments)
       │
       ├── Interactive buttons / list messages
       ├── WhatsApp Flow (in-chat multi-screen form)
       │         │
       │         └── HTTPS Flow Endpoint (your server)
       │                   │
       │                   ├── Check cutoff & stock
       │                   ├── Next screen or “closed”
       │                   └── On submit → create order
       │
       ├── Payments API (order_details) → Razorpay / PayU / UPI
       │
       └── Webhooks → your backend
                 ├── message received
                 ├── flow completed
                 └── payment status

Your backend (Supabase / small API)
       ├── orders, cooks, dishes, slots
       ├── Razorpay verify
       └── Admin sheet/dashboard for hub packing
```

**Optional BSP:** Interakt, AiSensy, WATI, etc. — they sit **on top of** Cloud API (official). They charge platform fees. You can also use **Meta Cloud API directly** (cheapest software path) and build Flows + webhook yourself in Cursor.

---

## 4. Decision system design (your lunch/dinner model)

### 4.1 Entry points (customer starts chat = free service window)

| Trigger | Message |
|---------|---------|
| Click link | `https://wa.me/91XXXXXXXXXX?text=Menu` |
| Keyword | `Hi`, `Menu`, `Lunch`, `Dinner` |
| Catalog | Customer taps product → enquiry |

Your webhook replies with buttons:

```
[ Today's Lunch ]  [ Today's Dinner ]  [ My Orders ]  [ Help ]
```

### 4.2 Decision tree (server-side)

```
IF keyword in {Lunch, Today's Lunch}:
    IF now >= 07:00 IST (lunch cutoff):
        reply "Lunch closed. Dinner open until 2 PM." + [Order Dinner]
    ELSE IF lunch_stock == 0:
        reply "Lunch sold out."
    ELSE:
        send Flow "ORDER_LUNCH"  (or list of dishes)

IF keyword == Dinner:
    IF now >= 14:00 IST:
        reply "Dinner closed. Order tomorrow lunch after 8 PM."
    ELSE:
        send Flow "ORDER_DINNER"

IF Flow completed:
    create order (unpaid)
    send Payments order_details (or Razorpay payment link if Payments API not ready yet)
    
IF payment webhook == captured:
    mark paid
    reply "Paid ✔ Order #L042. Delivery 12–1 PM."
    decrement stock

IF cron 07:05 (lunch closed):
    for each cook with paid lunch orders:
        send utility template "COOK_SUMMARY" with quantities
```

This **is** a decision-based automation system. Meta provides the channel; your endpoint is the brain.

### 4.3 WhatsApp Flow screens (example)

| Screen | Fields | Decision on submit |
|--------|--------|--------------------|
| 1. Meal | Lunch / Dinner (pre-filled) | Reject if past cutoff |
| 2. Dish | Dropdown from **endpoint** (only available dishes) | Hide sold-out |
| 3. Qty | 1–5 | Cap by remaining stock |
| 4. Address | Tower + flat / text | Must be in service zone |
| 5. Confirm | Summary + total | Create order → close Flow |

**Dynamic Flow endpoint** (official Meta pattern): when user picks a dish, your server returns next screen data — e.g. price, cook name, “8 left”.

Docs: [WhatsApp Flows](https://developers.facebook.com/docs/whatsapp/flows/) · [Flow endpoint](https://developers.facebook.com/docs/whatsapp/flows/guides/implementingyourflowendpoint/)

---

## 5. Payments (official)

### Preferred (India, in-chat)

**WhatsApp Payments API — India**

1. Cloud API + WABA verified  
2. WhatsApp Manager → Payment configurations → link **Razorpay** or **PayU**  
3. Send interactive **`order_details`** message (invoice)  
4. Customer pays via UPI apps / cards inside WhatsApp flow  
5. Gateway webhook → you verify → send **`order_status`** update  

Meta docs: [Payments API — India](https://developers.facebook.com/docs/whatsapp/cloud-api/payments-api/payments-in/)

### Simpler Phase-1 (still official)

If Payments API onboarding is slow:

- After Flow submit → reply with **Razorpay Payment Link** (HTTPS link in chat)  
- Still 100% official WhatsApp messaging  
- Upgrade to in-chat Payments API later  

---

## 6. What is free vs paid (official)

| Activity | Typical cost |
|----------|--------------|
| Customer messages you → you reply within 24h (menu, Flow, pay link) | **Free** (service) |
| Utility template outside window (order confirmed, out for delivery, cook summary) | ~**₹0.12**/delivered msg |
| Marketing template (daily menu blast) | ~**₹0.86**/delivered msg |
| Cloud API hosting (Meta) | Free |
| Your VPS / Supabase for webhook + Flow endpoint | ~₹0–1,500/mo |
| Official BSP (optional) | Often ₹1,500–8,000/mo + Meta rates |

**Cost-saving rules:**

1. Always make customers **start** the chat (`wa.me` link on posters / society groups).  
2. Prefer **utility** templates for status, not marketing.  
3. For daily menu: start with **opt-in customers messaging “Menu”** instead of blasting marketing templates.  
4. When you must broadcast menu: use marketing templates only to **opted-in** list; keep list small.

---

## 7. Phased plan (official only)

### Phase 0 — Manual official (Week 1–3) · ₹0 Meta fees

- WhatsApp **Business app** (not API yet)  
- Catalog + quick replies + Razorpay links  
- Google Sheet  
- **No bot** — learn demand  

### Phase 1 — Official Cloud API + simple decisions (Week 4–8)

**Requirements:**

- Meta Business Manager (business verification)  
- WhatsApp Business Account (WABA)  
- Cloud API phone number (dedicated SIM)  
- App + webhook URL (you host)  

**Automate:**

- Keyword → menu buttons  
- Cutoff check before offering lunch/dinner  
- After confirm → payment link  
- Paid → confirmation message  

**Build in Cursor:** small Node/Python webhook + Supabase.

### Phase 2 — WhatsApp Flows (Week 8–12)

- Build `ORDER_LUNCH` / `ORDER_DINNER` Flows in WhatsApp Manager  
- Connect **Flow data endpoint** for live stock + cutoff  
- Persist orders from Flow completion webhook  

### Phase 3 — In-chat Payments + ops templates

- Link Razorpay in WhatsApp Manager  
- `order_details` + `order_status`  
- Utility templates: cook summary, rider out-for-delivery  
- Optional: official BSP if you want a visual bot builder without coding Flows JSON  

### Phase 4 — Android app (Cursor)

- Same Supabase `orders` table  
- WhatsApp remains channel A; app becomes channel B  
- No change to Meta rules  

---

## 8. Templates you will need (approve in WhatsApp Manager)

| Template name | Category | When sent |
|---------------|----------|-----------|
| `daily_menu_invite` | Marketing (optional) | “Today’s lunch is live — reply Menu” |
| `order_confirmed` | Utility | After payment |
| `out_for_delivery` | Utility | Rider left hub |
| `cook_portion_summary` | Utility | After cutoff to cook |
| `cutoff_reminder` | Utility / Marketing | “1 hour left to order lunch” |

Templates need Meta approval (usually hours–days). Word them as transactional where possible so they stay **utility**.

---

## 9. Decision checklist — Meta setup

- [ ] Dedicated business phone number  
- [ ] Meta Business Manager created + **business verified**  
- [ ] WABA + Cloud API number registered  
- [ ] Display name approved  
- [ ] Webhook server with HTTPS (ngrok only for local test)  
- [ ] Privacy policy URL (often required)  
- [ ] Razorpay account (payment link first, then Payments API)  
- [ ] Flow created + published  
- [ ] Utility templates submitted  
- [ ] Opt-in language for broadcasts (“Reply YES for daily menu”)  

---

## 10. Can Meta alone do “full automation” without your code?

| Need | Meta-only? | Reality |
|------|------------|---------|
| Greeting / FAQ | Partial | Limited without API |
| Multi-step order form | **Flows** | Yes, with Flow Builder |
| Cutoff / stock decisions | Needs **your endpoint** | Official pattern |
| Payments in chat | **Payments API** | Yes (India) |
| Cook WhatsApp after cutoff | Templates + your cron | Yes |
| Hub packing board | Not in Meta | Your Sheet / admin |

**Verdict:** Meta gives you the **official automation platform** (Cloud API + Flows + Payments). A real food business still needs a **small decision backend** — that is normal and allowed.

---

## 11. What we removed from earlier plans

Do **not** use at any stage:

- Evolution API (Baileys mode)  
- OpenClaw WhatsApp channel (WhatsApp Web / Baileys)  
- WAHA / Baileys bots  
- Any “free unlimited WhatsApp API” that is not Meta Cloud API  

Allowed:

- WhatsApp Business **app** (manual)  
- WhatsApp **Cloud API** (Meta)  
- Official **BSPs** on Cloud API  
- Your own webhook / Flows endpoint / Razorpay  

---

## 12. Local testing → VPS (no BSP)

```
[Develop] Local PC + Cloudflare Tunnel + Postgres / Supabase Free
     → test with your own WhatsApp numbers
     → keep chats customer-initiated (service window = free)
[Then] Same app → cheap VPS
     → Meta Cloud API direct (no BSP)
```

### Development Meta costs — are you right?

**Mostly yes, with one correction:** careful testing can stay at **~₹0**, not “must pay utility.”

| What you send in testing | Cost |
|--------------------------|------|
| Customer (you/friend) messages first → bot replies within 24h | **Free** (service) |
| Buttons, lists, **Flows**, payment links inside that window | **Free** |
| **Utility templates** outside 24h window | ~₹0.12 each |
| **Marketing templates** | ~₹0.86 — **skip in development** |

**Rule:** always open chat from the customer side. Approve utility templates only when testing them. Cloud API + local host + Razorpay test mode ≈ **₹0**.

### Do you need Meta business verification?

| Step | Required? | Notes |
|------|-----------|--------|
| Business Manager + Cloud API setup | Early | Limited messaging possible before full verify |
| **Business Verification** | **Yes for production / higher limits** | Plan on it for a live food business |
| Pvt Ltd / GST | **Not mandatory** | Sole proprietor OK |
| Personal ID only | Often **not enough** | Need a **business** document |

**Solo founder path (India):** free **Udyam (MSME)** in your trade name (Aadhaar + PAN), or Shop & Establishment / GST. Match the **exact legal name** in Business Manager. Add a simple site + privacy policy URL.

“Verify as person” is often for ads/identity. For **WhatsApp Business Platform**, use **Business Verification** with proprietorship docs — you do **not** need a registered company first.

### Development hours (solo + Cursor, no BSP)

| Work package | Hours |
|--------------|------:|
| Meta BM + WABA + phone + webhook verify | 4–8 (+ wait days) |
| Local server, tunnel, Postgres schema | 6–10 |
| Buttons + cutoff logic | 8–12 |
| WhatsApp Flows + Flow endpoint | 12–20 |
| Orders DB + hub packing list | 6–10 |
| Razorpay payment link + webhook | 6–10 |
| Utility templates wiring | 4–6 |
| E2E test + fixes | 8–12 |
| **MVP code total** | **~55–90 h** |
| Deploy same app to VPS | 2–4 |
| Payments API in-chat (later) | +8–16 |

**Calendar:** ~2–3 weeks at 4 h/day, or ~1.5–2 weeks full-time coding. Add **3–10 calendar days** for Meta verification + template approval — start Udyam/verification **in parallel** with the local server.

**Build order:** schema + webhook hello-world → buttons/cutoff → Flows → payment link → cook utility template → VPS.

---

## 13. Summary

You **can** design a decision-based order and payment system on Meta:

1. **Cloud API** for messaging + webhooks  
2. **WhatsApp Flows** for structured ordering (decision screens)  
3. **Your Flow endpoint** for cutoff, stock, pricing  
4. **Payments API (India)** or Razorpay links for money  
5. **Utility templates** for cook/rider updates  

Customer-initiated chats keep most order conversations **free**. Marketing blasts are the expensive part — avoid them early. Develop on **local + tunnel**, then **VPS without BSP**.

Next concrete deliverables (pick one):

1. Flow screen wireframe + decision rules JSON outline  
2. Webhook / Postgres schema + local server scaffold  
3. ~~Step-by-step Meta Business Manager + Udyam verification checklist~~ → see `UDYAM_META_VERIFICATION_CHECKLIST.md`  
