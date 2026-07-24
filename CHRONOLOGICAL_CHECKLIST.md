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
- [x] **1.5** Create Gmail → `order.ammachethiruchulu@gmail.com` · optional Facebook Page later  

**Exit:** Live website URL + privacy policy URL (can change later).  
**Dev docs:** `website/README.md`

---

### Phase 2 — Udyam (Day 1–2, parallel with Phase 1)

- [ ] **2.1** Gather Aadhaar (OTP mobile), PAN, address, bank IFSC  
- [ ] **2.2** Register only on [udyamregistration.gov.in](https://udyamregistration.gov.in)  
- [ ] **2.3** Organisation: Proprietorship; enterprise name = **Amma Chethi Ruchulu**  
- [ ] **2.4** Download **Udyam certificate PDF** + note URN  
- [ ] **2.5** Confirm name/address on PDF match your notes  

**Exit:** Udyam PDF saved in `meta-verification/`.  
**Detail checklist:** `UDYAM_META_VERIFICATION_CHECKLIST.md`

---

### Phase 2B — FSSAI registration (start soon; required before selling food)

**Do not block website / Meta on this** — but **must complete before Phase 6 real paid orders.**

For a small home-kitchen / tiffin-style pilot in AP (turnover typically well under ₹1.5 crore), you usually need **FSSAI Basic Registration** (petty FBO), not a full State License.

| Apply for | When | Portal |
|-----------|------|--------|
| **Basic Registration** | Before first real customer sale | [foscos.fssai.gov.in](https://foscos.fssai.gov.in) |

- [ ] **2B.1** Decide FBO address (your **hub / packing** address — or registered business address)  
- [ ] **2B.2** Gather: photo, Aadhaar/PAN, address proof, food product list (e.g. cooked meals / tiffin)  
- [ ] **2B.3** Apply online → pay fee (Basic Registration is low — often ₹100/year class; confirm on FoSCoS)  
- [ ] **2B.4** Save **14-digit FSSAI number** + certificate PDF  
- [ ] **2B.5** Plan to print FSSAI no. on packaging / labels  
- [ ] **2B.6** (Later) Guide each cook: they may need their own registration if they are separate manufacturers — confirm with FoSCoS / local Food Safety Officer for your hub + multi-cook model  

**Exit:** FSSAI registration active for Amma Chethi Ruchulu before live food sales.  
**Not required for:** building website, Udyam, Meta verification, or WhatsApp API testing with fake/test orders.

---

### Phase 3 — Meta Business verification (Day 2–7)

- [ ] **3.1** Create/open [Meta Business Manager](https://business.facebook.com)  
- [ ] **3.2** Legal name + address = **exact Udyam match**  
- [ ] **3.3** Website + privacy URLs from Phase 1  
- [ ] **3.4** Start **Business Verification** → upload Udyam (+ PAN/address if asked)  
- [ ] **3.5** Respond to Meta emails; wait 1–5+ business days  
- [ ] **3.6** Mark verified when Security Centre shows Verified  

**Exit:** Business Verified (or submitted without blockers).

---

### Phase 4 — WhatsApp channel setup (after number ready; can overlap Phase 3)

- [ ] **4.1** Buy/activate **dedicated +91 SIM** (not your personal forever-WhatsApp)  
- [ ] **4.2** Add WhatsApp product in Meta → WABA → verify phone OTP  
- [ ] **4.3** Set display name + profile photo (**logo**) + about text + website  
- [ ] **4.4** Create Developer App → Cloud API → copy Phone number ID / tokens  
- [ ] **4.5** (Later) Submit **utility** templates only for testing  

**Exit:** Cloud API number live; can send/receive in test.

---

### Phase 5 — Local server for architecture testing (parallel with Phases 2–4)

- [ ] **5.1** Postgres schema (cooks, dishes, orders, slots)  
- [ ] **5.2** Webhook app on local PC  
- [ ] **5.3** Cloudflare Tunnel (public HTTPS)  
- [ ] **5.4** Connect Meta webhook → receive test messages  
- [ ] **5.5** Buttons + lunch/dinner cutoff logic  
- [ ] **5.6** WhatsApp Flow (order form) + Flow endpoint  
- [ ] **5.7** Razorpay **test** payment links  
- [ ] **5.8** Hub packing order list export  

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
| 5 | Start FSSAI Basic Registration (parallel; before real sales) | [ ] |
| 6 | Start Meta verification | [ ] |
| 7 | Dedicated SIM | [ ] |
| 8 | Start local webhook scaffold | [ ] |

---

## Brand pack

| Item | Value |
|------|--------|
| Legal / Udyam name | Amma Chethi Ruchulu |
| Brand / display name | Amma Chethi Ruchulu |
| Telugu | అమ్మ చేతి రుచులు |
| Tagline | Authentic Home Cooked Flavors |
| Address (public site) | **Guntur, Andhra Pradesh** only |
| Address (Udyam / Meta / FSSAI) | 4-115, Davuluru, Kollipara, Guntur, Andhra Pradesh — 522304 |
| Website URL | https://amma-chethi-ruchulu.vercel.app/ |
| Privacy policy URL | https://amma-chethi-ruchulu.vercel.app/privacy |
| Logo file path | `logo.jpeg` / `website/public/logo.jpeg` |
| Primary colour | Terracotta / marigold |
| Secondary | Leaf green, deep brown, cream |
| WhatsApp | +91 88861 28995 (`918886128995`) |
| Email | **order.ammachethiruchulu@gmail.com** ✓ |
| Udyam URN | *(pending)* |

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