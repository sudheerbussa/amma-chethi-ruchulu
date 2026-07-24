# Home Kitchen Delivery Platform — Business & Technical Plan

**Working name (placeholder):** DishByHome / Local Specialist Kitchen  
**Document date:** 20 Jul 2026  
**Scope of this document:** Product plan, tech dependencies, Android → iOS path, and recurring/paid service costs.  
**Not covered yet:** Detailed UI mockups, legal contracts, or production code.

---

## 1. Concept in one paragraph

Recruit **local homemakers who specialise in one (or a few) signature dishes**, list them on an app for customers in a **fixed service radius**, take orders, have the cook prepare food at home, and **hire / partner with riders** for pickup and delivery. The USP is not “fastest food” — it is **authentic, specialist home cooking**, with trust built through cook profiles, ratings, hygiene checks, and locality branding.

**Start small:** one locality / neighbourhood cluster in one city (e.g. 3–5 km radius). Expand only after unit economics (order frequency, cook capacity, rider utilisation, margins) work.

---

## 2. Who uses what (four surfaces)

| Surface | Who | Primary job |
|--------|-----|-------------|
| **Customer app** (Android first) | End users | Discover cooks/dishes, order, pay, track, rate |
| **Cook app** | Homemaker specialists | Menu, availability, accept/reject, prep status, earnings |
| **Rider app** | Delivery partners | Accept runs, navigate, pickup/drop, cash/online proof |
| **Ops / Admin web** | You / city manager | Onboard cooks & riders, zones, commissions, disputes, support |

**WhatsApp-first pilot (recommended start):** see `WHATSAPP_FIRST_BUSINESS_PLAN.md` — scheduled orders (lunch by 7 AM, dinner by 2 PM), collect from cooks → pack at hub → riders deliver. Android app built in Cursor after validation.

---

## 3. Business model (how money flows)

Typical marketplace split (tune after pilot):

| Party | Gets | Notes |
|-------|------|--------|
| **Customer** | Pays menu + delivery + platform fee (optional) | GST as applicable |
| **Cook** | ~70–80% of food value | Settled weekly/daily via bank / UPI |
| **Rider** | Delivery fee (fixed or distance-based) + incentives | Peak-hour bonuses |
| **Platform** | Commission on food + delivery margin + optional surge / packaging | Must cover ops, tech, support, marketing |

**Pilot KPIs to watch:** orders per cook per day, average ticket size, delivery time, cook rejection rate, rider idle time, contribution margin per order, repeat rate.

---

## 4. USP & trust (what you must build into the product)

Without trust, “home kitchen” fails. Plan for:

1. **Specialist positioning** — each cook is known for 1–3 dishes, not a full restaurant menu.
2. **Cook identity** — photo, locality, story, specialty, years of practice, sample reviews.
3. **Hygiene & compliance** — basic checklist, kitchen photos, FSSAI registration path for home kitchens (India), periodic re-verification.
4. **Capacity limits** — cooks set max orders/day and prep windows (avoids quality collapse).
5. **Transparent timing** — prep ETA + delivery ETA; no false “15 min” promises.
6. **Ratings with context** — food quality vs delivery separately.

---

## 5. Launch strategy (locality-first)

### Phase 0 — WhatsApp-first validate (2–6 weeks)

- Pick **one pin code / society cluster**.
- Recruit **8–15 cooks** (diverse specialties: biryani, regional thali, snacks, sweets, etc.).
- Recruit **3–5 riders** (bike + phone); riders pickup from **your packing hub**, not each cook home.
- **Scheduled orders:** lunch cutoff **7 AM**, dinner cutoff **2 PM** (or day-before).
- Take orders via **WhatsApp Business + Catalog + Google Sheet + Razorpay links** (full playbook in `WHATSAPP_FIRST_BUSINESS_PLAN.md`).
- Goal: prove people will pay a premium for specialist home food in that locality.

### Phase 1 — MVP Android apps + admin (8–14 weeks, build in Cursor)

Ship customer app first (Flutter + Supabase), then admin; cook/rider apps can stay on WhatsApp + sheet longer. Flow: **order → cook prepares → hub pack → rider → deliver → settle**.

### Phase 2 — Stabilise & densify locality (ongoing)

More cooks in same radius, better matching, support SLAs, referrals.

### Phase 3 — Next locality / city + iOS

Reuse the same backend; ship iOS if you chose a cross-platform client (recommended) or port native later.

---

## 6. MVP feature list (must-have vs later)

### Customer app — MVP

- Browse by specialty / cook / category  
- Cook profile + dish detail + prep time  
- Cart, address (within geofenced zone), slot or ASAP  
- Online payment (UPI / cards) + optional COD if you want it early  
- Order status + live tracking (basic)  
- Rate food & delivery  

### Cook app — MVP

- Toggle online / offline  
- Menu & price & daily stock / max orders  
- Incoming order accept / decline (with reason)  
- Prep statuses: Accepted → Cooking → Ready for pickup  
- Earnings summary & payout status  

### Rider app — MVP

- Go online, receive nearby jobs  
- Navigate to cook then customer  
- Confirm pickup / delivery (OTP or photo)  
- Earnings for the day  

### Admin web — MVP

- Zone / service area polygon  
- Approve cooks & riders  
- Commission & delivery fee config  
- Manual order intervention / refunds  
- Basic reports (orders, GMV, cancellations)  

### Explicitly out of MVP

- Multi-city orchestration, loyalty programs, subscriptions, dark kitchens, AI recommendations, in-app chat (use phone/WhatsApp bridge first), advanced dynamic pricing.

---

## 7. Recommended technical approach

### 7.1 Client apps: **Flutter (recommended for you)**

| Option | Pros | Cons |
|--------|------|------|
| **Flutter** (Android + iOS from one codebase) | One team, faster iOS later, good maps/payment plugins | Slightly less “native feel” if poorly designed |
| Kotlin (Android) then Swift (iOS) | Best native UX | ~2× client cost/time for iOS |
| React Native | Large hiring pool | Similar tradeoffs to Flutter |

**Recommendation:** Build **Flutter** from day one so “extend to iOS” is mostly **store submission + testing + Apple Developer account**, not a rewrite.

Backend stays the same regardless of client choice.

### 7.2 Backend

| Layer | Suggestion | Why |
|-------|------------|-----|
| API | Node.js (NestJS) or Python (FastAPI) or Firebase + Cloud Functions | Fast MVP; pick what your team knows |
| Database | PostgreSQL (orders, users, money) | Relational integrity for payments/orders |
| Auth | Firebase Auth or Supabase Auth or custom JWT + OTP | Phone OTP is standard in India |
| Realtime | WebSockets / Firebase / Supabase realtime | Order status to cook/rider/customer |
| Files | S3 / Cloudflare R2 / Firebase Storage | Cook/dish photos |
| Admin | Next.js or Flutter web | Same auth as backend |

**Simplest MVP path:** Supabase (Postgres + Auth + Realtime + Storage) + Flutter apps + Razorpay + Google Maps. Low ops burden while learning the business.

**Scale path later:** Move critical order/payment logic to a dedicated API if Supabase hits limits or compliance needs grow.

### 7.3 High-level architecture

```
[Customer App]──┐
[Cook App]──────┼──► API / BaaS ──► PostgreSQL
[Rider App]─────┤         │
[Admin Web]─────┘         ├── Payment gateway (Razorpay / similar)
                          ├── Maps & distance (Google Maps / Mapbox)
                          ├── SMS / OTP (MSG91 / Firebase)
                          ├── Push (FCM + later APNs)
                          └── Object storage (images)
```

Order state machine (simplified):

`Placed → ConfirmedByCook → Preparing → Ready → PickedUp → Delivered → Settled`  
(+ `Cancelled` / `Rejected` / `FailedDelivery` branches)

---

## 8. Dependencies (what depends on what)

### Product dependencies

1. **Cooks before marketing** — empty marketplace kills conversion.  
2. **Riders before peak volume** — otherwise cooks suffer cold food / late pickup.  
3. **Service area polygon** before open signup — refuse addresses outside zone.  
4. **Payout process** before promising weekly settlement — bank KYC, UPI verification.  
5. **FSSAI / local food rules** before scaling cook count — compliance is a business dependency, not only legal.

### Technical dependencies

| Feature | Depends on |
|---------|------------|
| Login with phone | OTP SMS provider + Auth |
| Browse dishes | Cook onboarding + image storage + CDN |
| Place order | Zone check + menu stock + payment OR COD policy |
| Cook notification | Push (FCM) + optional SMS fallback |
| Assign rider | Geo of cook + online riders + matching rules |
| Live tracking | Maps SDK + rider location updates + battery-aware polling |
| Settlements | Payment webhooks + ledger tables + payout API / manual CSV |
| iOS release | Apple Developer Program + same Flutter app + APNs keys + TestFlight |

### Team / ops dependencies

- Someone to **onboard and quality-check cooks** (not only engineers).  
- Support channel (WhatsApp Business is enough at start).  
- Local **packaging** standard (leak-proof, branding sticker).  
- Insurance / incident process for food safety complaints (define before launch).

---

## 9. Paid services & expense estimate

Costs below are **indicative India-centric ranges for an early pilot** (one locality). Exact prices change; treat as planning budgets, not quotes.

### 9.1 One-time / annual fixed tech costs

| Item | Typical cost | Notes |
|------|--------------|--------|
| Google Play Console | **$25** one-time | Android publish |
| Apple Developer Program | **~$99 / year** | Needed when you ship iOS |
| Domain + basic DNS | **₹500–2,000 / year** | e.g. yourbrand.in |
| SSL | Usually **₹0** | Included with most hosts / Cloudflare |
| Business email | **₹0–500 / user / mo** | Google Workspace optional |
| Initial design (logo, app icon) | **₹5,000–40,000** | Or DIY |

### 9.2 Monthly cloud & SaaS (MVP scale: low traffic)

| Service | Role | Ballpark / month |
|---------|------|------------------|
| **Supabase / Firebase / small VPS** | Backend, DB, auth, storage | **₹0–3,000** free tiers often enough at start; budget **₹2,000–8,000** once live |
| **Object storage + bandwidth** | Dish/cook photos | **₹200–2,000** |
| **SMS / OTP** (MSG91, Twilio, etc.) | Login & delivery OTP | **₹500–5,000** (usage-based; ~₹0.15–0.40/SMS) |
| **Push notifications** | FCM | **₹0** (Google); APNs free with Apple account |
| **Error monitoring** (Sentry free tier) | Crash reports | **₹0** then paid later |
| **Email transactional** (Resend / SES) | Receipts, payout mails | **₹0–1,000** |

### 9.3 Per-transaction / usage paid APIs (ongoing)

| Service | Typical pricing model | Planning note |
|---------|----------------------|---------------|
| **Payment gateway** (Razorpay, Cashfree, PayU) | ~**2%** of online payment (+ GST) | Biggest variable tech cost after scale |
| **Payouts to cooks/riders** | Per payout fee or % | Or pay manually via UPI at first (ops cost, not API) |
| **Google Maps Platform** | Pay-as-you-go (Maps SDK, Directions, Distance Matrix, Places) | **Easy to overspend** — set budgets & quotas; cache geocodes; use distance matrix sparingly |
| **Mapbox** (alternative) | Usage-based | Sometimes cheaper for heavy map use — compare for your volume |
| **SMS** | Per message | OTP on every login adds up; use session tokens well |

**Maps cost control tips:** don’t recalculate routes every second; update rider location every 5–15s; reuse geocoded addresses; restrict API keys by app + billing alerts.

### 9.4 App store & compliance money

| Item | Cost |
|------|------|
| Play Store | $25 once |
| App Store | ~$99/year |
| FSSAI registration (home kitchen / petty) | Government fee (relatively small) + possible consultant help |
| Company incorporation / GST | Separate business cost (not “app SaaS”) |

### 9.5 Non-software operating costs (usually larger than app SaaS)

| Item | Ballpark |
|------|----------|
| Cook recruitment & tasting | Time + small tasting budget |
| Rider retainers / minimum guarantees (pilot) | Often needed to keep supply |
| Packaging (boxes, stickers, bags) | Per-order ₹10–40+ |
| Local marketing (society WhatsApp, flyers, trials) | Variable |
| Support person (part-time) | Salary / stipend |
| Device testing phones | 2–3 Android devices |

### 9.6 Rough monthly burn — **tech only**, early pilot

| Scenario | Monthly tech burn (excl. payment % and salaries) |
|----------|--------------------------------------------------|
| Ultra-lean (free tiers + careful Maps) | **₹1,000–5,000** |
| Comfortable MVP | **₹5,000–20,000** |
| Growing locality (higher SMS + Maps + cloud) | **₹20,000–60,000+** |

Plus **~2% of online GMV** to the payment gateway.

### 9.7 Build cost

| Approach | Indicative |
|----------|------------|
| **WhatsApp + Sheet only (Phase 0)** | **₹0** software (+ payment gateway %) |
| **Self-build in Cursor (Flutter + Supabase)** | **₹0** dev agency; your time + ~₹1–3k/mo infra |
| Freelancer MVP (3 apps + admin) | Often **₹3–12+ lakh** — **avoid if building in Cursor** |
| Small agency | Often **₹8–25+ lakh** for fuller MVP |

Cross-platform Flutter **reduces** the later iOS bill to roughly **+15–30%** of Android effort (testing, polish, store), not +100%.

---

## 10. Security, money & data (non-negotiable basics)

- Never store raw card data; use payment gateway checkout / UPI intents.  
- Webhook signature verification for payment success before marking “paid”.  
- Role-based access: cook cannot see other cooks’ payouts; riders see only assigned jobs.  
- Soft-delete / audit log for order amount changes.  
- Privacy policy + terms before store listing.  
- Location data retention policy for riders.

---

## 11. Risks specific to this USP

| Risk | Mitigation |
|------|------------|
| Inconsistent quality | Specialty focus, capacity caps, mystery audits |
| Regulatory / housing society bans on commercial cooking | Cook screening, quiet packaging, legal advice |
| Cook no-shows | Backup cooks for popular categories; penalties / pauses |
| Rider shortage at lunch | Slot-based orders; staggered prep windows |
| “Restaurant clone” perception | Branding, cook stories, limited menus |
| Food safety incident | Clear process, insurance discussion, traceability of batch/time |

---

## 12. Suggested 90-day plan

| Weeks | Focus |
|-------|--------|
| 1–2 | Locality choice, competitor scan, cook interviews, WhatsApp pilot design |
| 3–4 | Manual pilot orders; measure demand & prep times; draft commission model |
| 5–8 | Flutter customer + cook MVP; Supabase schema; Razorpay test mode; admin basics |
| 9–10 | Rider app + matching; Maps with budget caps; internal dogfood |
| 11–12 | Closed beta in one locality; fix ops; Play Store listing; decide iOS date |

---

## 13. iOS extension path

If you follow the Flutter recommendation:

1. Enable iOS project in the same repo from the start (even if you only ship Android).  
2. Use plugins that support both platforms (payments, maps, push).  
3. When ready: Apple Developer account → certificates → APNs → TestFlight → App Store review.  
4. Expect extra work on: payment UPI UX differences, background location rules (stricter on iOS), App Store guideline wording for food/marketplace.

If you build **Kotlin-only** now, budget a **full second client** later (or a rewrite to Flutter/RN).

---

## 14. Decision checklist (before writing code)

- [ ] City + first locality radius defined  
- [ ] Target cuisines / specialty niches chosen  
- [ ] Commission % and delivery fee draft  
- [ ] COD yes/no for MVP  
- [ ] Flutter vs native decision  
- [ ] BaaS (Supabase/Firebase) vs custom API decision  
- [ ] Payment gateway shortlist  
- [ ] Who owns cook onboarding & support  
- [ ] FSSAI / compliance approach for home cooks  

---

## 15. What this repo can hold next

Suggested follow-on documents (when you want them):

1. `PRD_MVP.md` — screen-by-screen requirements  
2. `DATA_MODEL.md` — users, cooks, dishes, orders, ledger  
3. `UNIT_ECONOMICS.xlsx` / sheet — per-order margin calculator  
4. Wireframes / Flutter project scaffold  

---

## Summary

You are building a **three-sided local marketplace** (customer, specialist homemaker cook, rider) with a **strong trust and specialty USP**, launched in **one geofenced locality**. Prefer **Flutter + a managed backend (e.g. Supabase) + Razorpay + Maps**, keep Maps/SMS under budget alerts, and treat **cook supply and food compliance** as harder dependencies than the app itself. iOS becomes inexpensive if the client is cross-platform from day one; the largest recurring software costs are **payment fees**, then **Maps + SMS + cloud**, while **riders, packaging, and support** usually dominate real monthly burn.
