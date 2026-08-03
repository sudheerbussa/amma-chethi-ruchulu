# Chronological Startup Checklist — Amma Chethi Ruchulu

**Finalized name:** **Amma Chethi Ruchulu** / **అమ్మ చేతి రుచులు**  
**Logo file:** [`logo.jpeg`](./logo.jpeg)  
**Launch market:** Small town, Andhra Pradesh  
**Date:** 23 Jul 2026

---

## Brand lock (FINAL)

| Item | Value |
|------|--------|
| Legal / Udyam name | `Amma Chethi Ruchulu` (confirm exact spelling on certificate) |
| Telugu name | అమ్మ చేతి రుచులు |
| WhatsApp display name | `Amma Chethi Ruchulu` (19 chars — within WhatsApp limit) |
| Tagline (logo) | Authentic Home Cooked Flavors |
| Tagline (ops/site) | Signature dishes from specialist home cooks in your town |
| Logo | `logo.jpeg` |
| Primary colours | Terracotta / marigold orange, leaf green, deep brown, cream |

**Freeze rule:** Same English spelling on Udyam, Meta, website, WhatsApp. Telugu on logo/ads is fine.

### Phase 0 status

- [x] **0.1** Final business name chosen → **Amma Chethi Ruchulu**  
- [x] **0.2** Spelling frozen (English + Telugu)  
- [x] **0.3** WhatsApp display name = full brand name  
- [x] **0.4** Logo saved → `logo.jpeg`  
- [x] **0.5** Colours from logo (terracotta, green, brown, cream)  
- [x] **0.6** Tagline → *Authentic Home Cooked Flavors*  

**Exit:** Name + logo + tagline frozen. → **DONE**

### Logo improvements (optional polish — not blockers)

See notes below before printing stickers / Play Store icon. Current logo is strong for posters and WhatsApp full profile.

---

## Name history (superseded)

Earlier options (IntiVanta, HomePlate, etc.) are **not** used. Brand is **Amma Chethi Ruchulu** only.

---

### Phase 1 — Minimal web presence (Day 1–2)

**Note:** Website is for Meta / brand only. **FSSAI is not required before building the site.**  
**Stack:** Astro 4 in [`website/`](./website/) → host on **Vercel** or **GitHub Pages**.

- [x] **1.0** Astro project scaffolded (`website/`)  
- [x] **1.1** Edit `website/src/site.config.ts` — town, WhatsApp, address, email  
- [ ] **1.2** `cd website && npm install && npm run dev` — preview locally  
- [x] **1.3** Deployed on Vercel → https://amma-chethi-ruchulu.vercel.app/  
- [x] **1.4** Home + privacy live · URLs saved in Brand pack below  
- [x] **1.5** Create Gmail → `order.ammachethiruchulu@gmail.com` · Facebook Page ✓  
  https://www.facebook.com/profile.php?id=61592543611685  

**Exit:** Live website URL + privacy policy URL (can change later).  
**Dev docs:** `website/README.md`

---

### Phase 2 — Udyam ✓ DONE

**URN:** `UDYAM-AP-04-0142646`  
**Fill-in sheet:** [`UDYAM_FILL_SHEET.md`](./UDYAM_FILL_SHEET.md)

- [x] **2.1** Gather Aadhaar (OTP mobile), PAN, bank IFSC  
- [x] **2.2** Register on official portal only (₹0)  
- [x] **2.3** Proprietorship · enterprise name = **Amma Chethi Ruchulu** · address updated to Tenali (proof-ready)  
- [x] **2.4** Download latest Udyam PDF · saved in `meta-verification/` (29 Jul 2026)  
- [x] **2.5** Ready for Meta (use exact name/address from **latest** PDF)  

**Exit:** ✓ Certificate saved → **Phase 3 Meta verification next.** FSSAI (2B) before real food sales.

---

### Phase 2B — FSSAI registration (do in parallel with Meta wait)

**Fill-in sheet:** [`FSSAI_FILL_SHEET.md`](./FSSAI_FILL_SHEET.md) · Portal: [foscos.fssai.gov.in](https://foscos.fssai.gov.in)

**Do not block website / Meta on this** — but **must complete before Phase 6 real paid orders.**

For a small home-kitchen / tiffin-style pilot in AP (turnover typically well under ₹1.5 crore), you usually need **FSSAI Basic Registration** (petty FBO), not a full State License.

| Apply for | When | Portal |
|-----------|------|--------|
| **Basic Registration** | Before first real customer sale | [foscos.fssai.gov.in](https://foscos.fssai.gov.in) |

- [ ] **2B.1** Decide FBO address = Udyam address (Tenali — same as certificate)  
- [ ] **2B.2** Gather: photo, Aadhaar/PAN (Lakshmi), address proof for Tenali, food product list  
- [ ] **2B.3** Apply online → pay fee → save application reference  
- [ ] **2B.4** Save **14-digit FSSAI number** + certificate PDF in `meta-verification/`  
- [ ] **2B.5** Plan to print FSSAI no. on packaging / labels  
- [ ] **2B.6** (Later) Guide each cook on their own registration if needed  

**Exit:** FSSAI registration active for Amma Chethi Ruchulu before live food sales.  
**Not required for:** Meta wait, or local order-bot testing with simulate.

---

### Phase 3 — Meta Business verification (IN PROGRESS)

**Submitted:** Business verification with Udyam PDF (proprietor: Lakshmi Penumaka).  
**Typical wait:** 1–5+ business days. Check Security Centre + `order.ammachethiruchulu@gmail.com`.

- [x] **3.1** Create/open [Meta Business Manager](https://business.facebook.com) → Amma Chethi Ruchulu portfolio  
- [x] **3.2** Legal name + address = **exact Udyam match**  
- [x] **3.3** Website + privacy URLs from Phase 1  
- [x] **3.4** Start **Business Verification** → upload Udyam  
- [ ] **3.5** Respond to Meta emails if they ask for more docs; wait for decision  
- [ ] **3.6** Mark verified when Security Centre shows Verified  

**Exit:** Business Verified → Phase 4 WhatsApp Cloud API.

---

### Phase 4 — WhatsApp channel setup (can start while Meta verifies)

**Guide:** [`WHATSAPP_API_TEST_NOW.md`](./WHATSAPP_API_TEST_NOW.md) — sandbox test number first.

- [ ] **4.1** (Optional later) dedicated +91 SIM — for now use Meta **test number**  
- [ ] **4.2** Create Developer App → add WhatsApp → API Setup  
- [ ] **4.3** Copy temporary token + Phone number ID into `order-bot/.env`  
- [ ] **4.4** Add your phone as test recipient; send Meta sample message  
- [ ] **4.5** After Verified: real number `8886128995` + display name + logo + website  
- [ ] **4.6** (Later) Submit **utility** templates  

**Exit:** Cloud API test send/receive works with order-bot.

---

### Phase 5 — Local server for architecture testing (STARTED)

**Code:** [`order-bot/`](./order-bot/) — Express + JSON store + official Cloud API webhook

- [x] **5.1** Schema (cooks/dishes via `dishes`, orders, sessions) in `order-bot/sql/schema.sql`  
- [x] **5.2** Webhook app scaffold (`order-bot/src`)  
- [ ] **5.3** Cloudflare Tunnel (public HTTPS) when Meta WhatsApp is ready  
- [ ] **5.4** Connect Meta webhook → receive test messages  
- [x] **5.5** Buttons/text + lunch/dinner cutoff logic  
- [ ] **5.6** WhatsApp Flow (order form) — later  
- [ ] **5.7** Razorpay **test** payment links — later  
- [ ] **5.8** Hub packing list: `GET /orders` for now  

**Local test now (no Meta token needed):**

```bash
cd order-bot && npm install && npm run db:init && npm run dev
curl -X POST http://127.0.0.1:3000/simulate -H 'Content-Type: application/json' -d '{"from":"919999999999","text":"Lunch"}'
```

**Exit:** End-to-end test order on WhatsApp without real customers.  
**Cost target:** ~₹0 Meta (customer-initiated chats only).

---

### Phase 6 — Soft ops pilot (manual or semi-auto)

**Prerequisite:** Phase **2B FSSAI** done (or at least applied and usable) before real paid food orders.

- [ ] **6.0** Confirm FSSAI number on packing labels / WhatsApp about (optional but good)  
- [ ] **6.1** Recruit 5–8 specialist cooks in one locality  
- [ ] **6.2** Fix lunch cutoff **7 AM** / dinner **2 PM**  
- [ ] **6.3** Hub packing spot + riders  
- [ ] **6.4** 2–4 weeks real orders (Sheet and/or bot)  
- [ ] **6.5** Measure repeat rate, prep times, margins  

**Exit:** Demand proven.

---

### Phase 7 — VPS production (no BSP)

- [ ] **7.1** Deploy same app to cheap VPS  
- [ ] **7.2** Point Meta webhook to VPS HTTPS URL  
- [ ] **7.3** Razorpay live keys  
- [ ] **7.4** Utility templates for cook summary / out for delivery  
- [ ] **7.5** Skip marketing blasts until stable  

**Exit:** Production WhatsApp ordering live.

---

### Phase 8 — Android app (Cursor) — after Phase 6–7

- [ ] **8.1** Flutter customer app (same DB)  
- [ ] **8.2** Play Store ($25)  
- [ ] **8.3** Keep WhatsApp for support + non-app users  

---

## This week only (minimum path)

| Order | Task | Done? |
|------:|------|-------|
| 1 | Freeze name | [x] Amma Chethi Ruchulu |
| 2 | Save logo | [x] `logo.jpeg` |
| 3 | One-page site + privacy (Astro) | [x] live on Vercel |
| 4 | Udyam certificate | [ ] |
| 5 | Start FSSAI Basic Registration | [ ] see `FSSAI_FILL_SHEET.md` |
| 6 | Start Meta verification | [x] submitted |
| 7 | Dedicated SIM / Cloud API phone | [ ] after Verified |
| 8 | Local order bot scaffold | [x] `order-bot/` — run simulate |

---

## Brand pack

| Item | Value |
|------|--------|
| Legal / Udyam name | Amma Chethi Ruchulu |
| Brand / display name | Amma Chethi Ruchulu |
| Telugu | అమ్మ చేతి రుచులు |
| Tagline | Authentic Home Cooked Flavors |
| Address (public site) | **Guntur, Andhra Pradesh** only |
| Address (Udyam / Meta / FSSAI) | 11-4-89, Donka Road, Chenchupeta, Tenali, Guntur, Andhra Pradesh — 522202 |
| Website URL | https://ammachethiruchulu.co.in/ |
| Privacy policy URL | https://ammachethiruchulu.co.in/privacy |
| Logo file path | `logo.jpeg` / `website/public/logo.jpeg` |
| Primary colour | Terracotta / marigold |
| Secondary | Leaf green, deep brown, cream |
| WhatsApp (site / wa.me) | +91 98235 83498 (`919823583498`) |
| Email | **order.ammachethiruchulu@gmail.com** ✓ |
| Facebook Page | https://www.facebook.com/profile.php?id=61592543611685 ✓ |
| Udyam URN | **UDYAM-AP-04-0142646** ✓ (26 Jul 2026) |

### Email (finalized)

**`order.ammachethiruchulu@gmail.com`** — set in `website/src/site.config.ts`. Use this for Meta Business Manager and site contact.

---

## Logo review — what works + improvements

**What works well**

- Clear Andhra / home-cook story (Amma + banana leaf + handi)
- Bilingual Telugu + English — right for small-town AP
- Warm earthy palette (marigold, terracotta, cream) fits food packaging
- Circular badge works for WhatsApp profile and stickers

**Suggested improvements** (do when you reprint / make app icon — current file is fine to start)

| Priority | Issue | Suggestion |
|----------|--------|------------|
| High | **Too detailed at small size** | Export a **simplified icon**: Amma face + leaf OR handi only, for WhatsApp cropped circle and favicon (64–256 px) |
| High | **JPEG background** | Also save **PNG** with transparent or clean cream background for web/print |
| Medium | Top tagline hard to read when small | Drop “AUTHENTIC HOME COOKED FLAVORS” on tiny icons; keep it on posters / website header |
| Medium | Busy marigold border | For app icon / stamps, use a **cleaner single-ring** version; keep florals for bills / packaging |
| Low | Long English name in all caps | On narrow UI, allow 2-line wrap or shorter lockup: Telugu large + English smaller |
| Low | Meta / Play Store | Prefer **square PNG 1024×1024** master; current circular art can sit on cream square canvas |
| Check | Spelling consistency | Logo uses **CHETHI** — freeze that (not *Cheti* / *Chetti*) on Udyam & Meta |

**Asset set to produce later (optional)**

1. `logo.jpeg` — full emblem (have now)  
2. `logo-icon.png` — simplified circle for WhatsApp  
3. `logo-square-1024.png` — app / Meta  
4. `logo-mono.png` — single-colour for cheap B&W print  

None of these block Udyam or Meta — proceed with `logo.jpeg` for the website and profile photo.