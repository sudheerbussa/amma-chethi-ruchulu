# WhatsApp System — Internal GTM, Pricing & Hosting Strategy

**Audience:** Internal only (not for customer PPT)  
**Date:** 12 Aug 2026  
**Why this exists:** Feedback on the long pitch deck — separate **customer story** from **commercial model**.

---

## 1. What the feedback means

| Feedback | Interpretation | Response |
|----------|----------------|----------|
| PPT too long (want 2–3 slides) | Local owners won’t read 15 slides | Use **Minimal** (3) or **Customer** (7, no price) |
| Per-order fee feels like tracking revenue | Trust issue for moderately successful shops | Keep per-order **internal / negotiated only**; default quote = **flat monthly** |
| Pricing & use-case matrix shouldn’t be in customer deck | Sales collateral ≠ commercial playbook | Customer = problem → solution → proof; Internal = money & variants |
| Small towns don’t care about VPS/Meta maths | They only ask: “How much extra will I pay?” | One clear monthly number; don’t explain hosting stack unless asked |
| Remove one-time setup | Setup friction kills deals | Prefer **₹0 setup** for standard template; recover via months 1–3 or higher monthly |
| Builder invested heavily / customization costs time | Valid — don’t give custom away free | Template = low monthly; **custom = change-request or higher tier** |
| Maybe approach established businesses | Higher willingness to pay for solved pain | Dual track: local micro (simple fee) + established (problem-priced) |

---

## 2. Customer decks (external)

| File | Slides | Contains | Use when |
|------|--------|----------|----------|
| `pitch/WhatsApp_System_Pitch_Minimal.pptx` | **3** | Problem → proof → demo CTA | First WhatsApp/email touch, busy owners |
| `pitch/WhatsApp_System_Pitch_Customer.pptx` | **~7** | Problem, solution, verticals, proof, what you get, CTA — **no prices** | Short meeting / follow-up |
| Older 15-slide decks | Archive | Pricing, Meta costs, plan matrices | Do **not** send to cold local leads |

**Screenshots:** Drop ACR chat images into `pitch/proof-screenshots/` as `1.png`, `2.png`, `3.png` (or any `.png/.jpg`) and rebuild:

```bash
python3 order-bot/scripts/build_pitch_deck_customer_v2.py
```

---

## 3. Commercial models (internal) — by business type

### Principle
- Customer hears: **“Simple monthly tool fee.”**
- You decide: flat vs hybrid based on segment.
- **Do not lead with per-order** for shops who fear “you’ll see my sales.” If used, frame as *usage credit* after trust, or only for high-volume established clients who accept SaaS norms.

### A. Local micro (tiffin, laundry, water can, small bakery)

| Approach | Fee shape | When |
|----------|-----------|------|
| **Recommended** | ₹1,999–2,999 / month · **₹0 setup** · 3-month min | Standard template, light support |
| Alternative | ₹999 / month + soft usage band (e.g. up to 150 events included) | Very price-sensitive; still avoid “per order” wording |
| Avoid | High one-time + per-order | Matches feedback that killed interest |

**Your cost cover:** shared VPS, Meta pass-through billed to client or buffered in monthly, template only.

### B. Local growth (busy restaurant, multi-staff salon, single clinic)

| Approach | Fee shape | When |
|----------|-----------|------|
| **Recommended** | ₹3,999–6,999 / month · ₹0–4,999 setup only if heavy menu load | Still flat monthly storytelling |
| Optional | Quarter prepaid = 1 month free | Improves cash |

### C. Established / multi-outlet / multi-doctor / retail catalog

| Approach | Fee shape | When |
|----------|-----------|------|
| **Recommended** | ₹15,000–45,000+ / month or project + retainer | They buy **problem solved**, not “cheap bot” |
| Setup / discovery | ₹25,000–1L+ scoped SOW | Custom rules, integrations, AI optional |
| Success / usage | Only if they already use SaaS; contract transparency | Never hide it |

### D. Recovering your build effort without scaring micro shops

| Work type | How to charge |
|-----------|----------------|
| Template deploy (ACR-class clone) | Inside monthly (₹0 setup pitch) |
| Menu/services load > plan | Fixed pack (e.g. ₹1,999 / +50 items) — not “setup tax” |
| Custom flow / AI API | Change request or Business+ tier |
| On their VPS / their cloud | Higher monthly or one-time hardening fee |

**Opinion balanced with feedback:** Keep monthly low for micro, but **stop unlimited customization**. Custom = paid. One-time can return as **“onboarding pack”** for established clients only — not on the first slide for small towns.

---

## 4. Security & hosting — if customer asks (FAQ)

Most small-town clients won’t ask. Established ones might.

### Options

| Option | What it means | Pros | Cons | Suggest when |
|--------|---------------|------|------|--------------|
| **1. Our hosted (default)** | App on your VPS; their WhatsApp + payments | Fastest, cheapest for them | Data on your infra | 90% of micro clients |
| **2. Their VPS / cloud** | Same app, they own the server | “Data with us” comfort | More setup & support cost | Clinics, larger retail |
| **3. On-prem / local machine** | PC/NAS in their shop | Max control feeling | Power cuts, no 24×7 webhook, weak SSL, Meta needs public HTTPS | Rarely — usually **discourage** |

### Honest technical constraint
Meta WhatsApp Cloud API needs a **public HTTPS webhook**. A laptop at the shop only works with tunnels (Cloudflare Tunnel / ngrok) — fragile for production. Prefer **their cloud VPS** over true “local only.”

### Security talking points (short)
- Official Meta API only (no unofficial WhatsApp hacks).
- Payments via their Razorpay/PhonePe — money settles to **their** account.
- Access limited by admin login + allowlisted staff numbers.
- Option 2 available if they want isolation; priced higher.
- We do **not** need per-order billing to “track finances” — flat monthly means we don’t meter their revenue for pricing optics.

---

## 5. Go-to-market: two customer tracks

### Track 1 — Small town micro (volume game)
- Pain: missed WhatsApp orders / bookings.
- Collateral: **Minimal 3-slide** + live demo.
- Price: flat monthly, ₹0 setup.
- Customize lightly; queue change requests.

### Track 2 — Established businesses (margin game)
- Pain: lost revenue, staff chaos, aggregator dependency, clinic no-shows.
- Collateral: **Customer 7-slide** + ACR proof + private commercial note.
- Price: problem-priced retainer / SOW.
- This is where customization + AI API cost is acceptable.

**Strategic recommendation:** Don’t abandon micro — use them for proof and referrals. **Actively hunt Track 2** (chains of 2–5 outlets, busy clinics, established restaurants) so your build effort is valued. Same product core; different packaging and fee.

---

## 6. What to say about money on the customer call

1. “This is a **monthly tool**, like your internet bill.”  
2. “We configure your WhatsApp flow; you keep your customers and payments.”  
3. If they ask setup: “Standard start has **no separate setup fee**; custom work is quoted only if you need extras.”  
4. Never open with Meta message rates / VPS / your margin.  
5. Per-order: only if *they* ask for pay-as-you-grow — then position as **included events**, not commission on sales.

---

## 7. Next actions

1. Add ACR chat screenshots → `pitch/proof-screenshots/` → rebuild customer decks.  
2. Send **Minimal** to new local leads; keep old 15-slide decks off that list.  
3. Draft a 1-page **private quote** template (Track 1 vs Track 2) — not a PPT.  
4. Pick 10 established prospects (clinics / multi-outlet food) for Track 2 outreach this month.

---

## File map

```
order-bot/pitch/
  WhatsApp_System_Pitch_Minimal.pptx      ← send first
  WhatsApp_System_Pitch_Customer.pptx     ← meeting deck (no price)
  WhatsApp_Order_System_Client_Pitch.pptx ← old long (archive for cold leads)
  WhatsApp_Order_System_Client_Pitch_Storyset.pptx
  proof-screenshots/                      ← your ACR chats
  INTERNAL_GTM_PRICING_HOSTING.md         ← this file
```
