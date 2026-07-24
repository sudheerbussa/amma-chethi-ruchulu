# Udyam + Meta Business Verification Checklist

**Purpose:** Get ready for **WhatsApp Cloud API** (official) as a sole founder / proprietorship in India.  
**Cost:** Udyam = **₹0** (govt portal only). Meta verification = **₹0**.  
**Time:** Udyam often **same day**; Meta review usually **1–5 business days** (sometimes longer).  
**Related:** `META_WHATSAPP_OFFICIAL_AUTOMATION.md`  
**Date:** 22 Jul 2026

**Official Udyam site only:** [https://udyamregistration.gov.in](https://udyamregistration.gov.in)  
Beware of lookalike sites that charge fees — registration is free.

---

## Before you start — decide your legal name

Pick **one** trade name and use it everywhere. Example:

| Field | Example (replace with yours) |
|-------|------------------------------|
| Legal / enterprise name | `Sudhir Home Kitchen` or your personal name if prop. is in your name |
| Display name (WhatsApp) | Same or shorter brand, e.g. `DishByHome` |
| Address | Home / hub address you will use on Udyam + Meta |

**Critical rule for Meta:**  
Legal name on **Udyam certificate** = legal name in **Meta Business Manager** = name on any address proof you upload.  
Character-for-character match. Do not invent a different company name later.

---

## Part A — Documents & accounts to gather

### A1. Identity & tax

- [ ] Aadhaar (proprietor) — mobile number linked for OTP  
- [ ] PAN (your personal PAN for proprietorship)  
- [ ] Decide: will you use GST now?  
  - If you already have GSTIN → keep it ready  
  - If not → Udyam portal may still ask for PAN; GST is **not** always required for Meta, but Udyam rules evolve — complete what the official portal asks  

### A2. Business basics (write these down before opening the portal)

- [ ] Enterprise / trade name (final spelling)  
- [ ] Type of organisation: **Proprietorship**  
- [ ] Date of commencement (can be today or when you start pilot)  
- [ ] Full business address (same as you’ll use on Meta)  
- [ ] District, state, PIN  
- [ ] Bank account number + IFSC (savings OK for prop.; business account nicer later)  
- [ ] Major activity: **Services** (food delivery / catering / food service)  
- [ ] NIC code: pick closest food-service / catering / restaurant-takeaway code on the portal list (e.g. food service activities — choose the best match shown)  
- [ ] Employees: often `1`–`5` for pilot  
- [ ] Investment & turnover: self-declare honestly (micro enterprise is fine for a pilot; can be low/zero if just starting)

### A3. Online presence (Meta often expects this)

- [ ] Simple website or landing page with business name + locality + contact  
  - GitHub Pages / Google Site / Carrd is OK for pilot  
- [ ] **Privacy policy** page URL (required for many Cloud API setups)  
- [ ] Business email (Gmail OK to start; domain email better later)  
- [ ] Optional: Facebook Page with same business name  

### A4. WhatsApp-ready phone

- [ ] **Dedicated** Indian mobile number (+91)  
- [ ] Not already linked to a personal WhatsApp you want to keep (migrating is painful)  
- [ ] Can receive SMS/voice OTP  
- [ ] Spare Android phone or SIM in a phone for Business app / API onboarding  

---

## Part B — Udyam registration (MSME)

### B1. Register

- [ ] Open **only** [udyamregistration.gov.in](https://udyamregistration.gov.in)  
- [ ] Choose **For New Entrepreneurs who are not Registered yet as MSME** (wording may vary slightly)  
- [ ] Enter Aadhaar → validate → OTP on Aadhaar-linked mobile  
- [ ] Select organisation type: **Proprietorship**  
- [ ] Enter / validate **PAN**  
- [ ] Fill enterprise name, address, bank, NIC, investment, turnover, employees  
- [ ] Add GSTIN **if** you have one / if portal requires it  
- [ ] Submit  

### B2. Save proofs for Meta

- [ ] Note **Udyam Registration Number (URN)**  
- [ ] Download **Udyam Registration Certificate** (PDF)  
- [ ] Screenshot or print the certificate page (QR should be visible)  
- [ ] Store PDF in a folder: `meta-verification/`  

### B3. Name consistency check (do this before Meta)

Open the PDF and copy these exactly into a notes file:

- [ ] Enterprise name (as printed)  
- [ ] Address (as printed)  
- [ ] Proprietor name  
- [ ] URN  

You will paste these into Meta with **no creative renaming**.

**Time:** often 15–45 minutes if OTP works.  
**Cost:** ₹0.

---

## Part C — Meta Business Manager setup

### C1. Create / open Business Manager

- [ ] Go to [business.facebook.com](https://business.facebook.com)  
- [ ] Create Business Manager (or use existing)  
- [ ] Business name = **same as Udyam enterprise name** (or Meta’s “legal name” field = Udyam name)  
- [ ] Your name as admin  
- [ ] Business address = **same as Udyam**  
- [ ] Business email, phone, website URL  

### C2. Add assets (as needed)

- [ ] Create / claim a **Facebook Page** (same brand name)  
- [ ] In Meta for Developers: create an **App** (type: Business) for Cloud API later  
- [ ] Note: App + WABA setup can continue while verification is pending, but limits stay low until verified  

### C3. Start Business Verification

Path (UI labels move around; look for):

- [ ] Business Settings → **Security Centre** (or **Business info** / **Verification**)  
- [ ] **Start verification** / **Verify now**  
- [ ] Confirm legal business name, address, phone, website  

### C4. Upload documents Meta typically accepts (India)

Upload what the form asks. Common set for proprietorship:

| Document | Use |
|----------|-----|
| **Udyam certificate PDF** | Primary business registration proof |
| **PAN** (proprietor / business) | Identity / tax |
| **Address proof** | Bank statement / utility bill / rent agreement matching address — if asked |
| Optional: GST certificate | If you have it |
| Optional: Shop & Establishment | Extra strength |

- [ ] Upload Udyam PDF  
- [ ] Upload PAN if requested  
- [ ] Upload address proof if requested  
- [ ] Ensure scanned text is readable (not blurry)  
- [ ] Submit  

### C5. Wait & respond

- [ ] Watch Business Manager + email for Meta requests  
- [ ] If rejected: read reason → fix **name/address mismatch** → resubmit  
- [ ] Do **not** change legal name mid-process  
- [ ] Typical wait: **1–5 business days** (can be longer)  

### C6. Verification done when

- [ ] Security Centre shows business as **Verified**  
- [ ] You can proceed to higher WhatsApp messaging tiers over time  

---

## Part D — WhatsApp Cloud API checklist (after / parallel to verification)

Do coding on local server in parallel; finish these Meta steps before production.

### D1. WhatsApp account

- [ ] Meta Business Suite / WhatsApp Manager → add **WhatsApp account**  
- [ ] Create **WhatsApp Business Account (WABA)**  
- [ ] Add **phone number** (dedicated SIM) → verify OTP  
- [ ] Set **display name** (must reflect business; Meta reviews)  
- [ ] Complete business profile: address, description, email, websites  

### D2. Cloud API access

- [ ] In Meta Developer App → add **WhatsApp** product  
- [ ] Note **Phone number ID**, **WABA ID**, **temporary / permanent access token**  
- [ ] Set **webhook** URL to your Cloudflare Tunnel / later VPS  
- [ ] Subscribe to: `messages`, and later payment / flow-related fields as needed  
- [ ] Verify webhook with the challenge token  

### D3. Compliance pages

- [ ] Privacy policy URL live and linked  
- [ ] Terms of service (recommended)  
- [ ] Business description matches food / home-kitchen delivery  

### D4. Templates (utility first — cheap testing)

Submit only what you need; avoid marketing while developing:

- [ ] `order_confirmed` — **Utility**  
- [ ] `cook_portion_summary` — **Utility**  
- [ ] `out_for_delivery` — **Utility**  
- [ ] Skip marketing menu blast until live customers  

### D5. Payments (later)

- [ ] Razorpay account (test mode first)  
- [ ] Payment **links** in chat for MVP  
- [ ] Later: WhatsApp Manager → Payment configurations → Razorpay (Payments API India)  

---

## Part E — Consistency matrix (print this)

Fill once; check before every Meta upload:

| Field | Your value | Same on Udyam? | Same on Meta BM? | Same on website? |
|-------|------------|----------------|------------------|------------------|
| Legal name | | [ ] | [ ] | [ ] |
| Address line 1 | | [ ] | [ ] | [ ] |
| City / PIN | | [ ] | [ ] | [ ] |
| Phone | | [ ] | [ ] | [ ] |
| Email | | [ ] | [ ] | [ ] |
| Website | | [ ] | [ ] | [ ] |

---

## Part F — Common rejection reasons (and fixes)

| Problem | Fix |
|---------|-----|
| Name mismatch (`DishByHome` vs `Sudhir Kumar`) | Use Udyam legal name in Meta **legal name**; brand can be display name |
| Address doesn’t match document | Edit BM address to match Udyam / bank statement exactly |
| Blurry PDF | Re-download certificate; upload clear PDF |
| No website / privacy policy | Publish a one-page site + privacy policy before resubmit |
| Fake Udyam agent site | Only use udyamregistration.gov.in; re-register if needed |
| Phone already on WhatsApp | Use a fresh number or properly migrate via Meta tools |

---

## Part G — Suggested calendar (parallel with coding)

| Day | Verification track | Dev track (local server) |
|-----|--------------------|---------------------------|
| 1 | Decide legal name; draft privacy page | Postgres schema + hello webhook |
| 1–2 | Complete **Udyam**; download PDF | Cloudflare Tunnel + webhook verify stub |
| 2 | Create Business Manager; start verification | Button menu + cutoff logic (mock) |
| 3–7 | Wait / respond to Meta | Flows + orders + Razorpay test |
| When verified | Raise limits; submit utility templates | Point webhook to stable tunnel/VPS |

---

## Part H — Done definition

You are ready for serious Cloud API testing when:

- [ ] Udyam certificate PDF saved  
- [ ] Meta Business **Verified** (or submitted and not blocked)  
- [ ] Dedicated WhatsApp Cloud API number live  
- [ ] Display name approved  
- [ ] Webhook receiving test messages on local tunnel  
- [ ] Privacy policy URL live  
- [ ] At least one **utility** template approved (optional for pure service-window tests)  

---

## Quick answers

| Question | Answer |
|----------|--------|
| Do I need a Pvt Ltd? | **No** |
| Do I need GST for Meta? | **No** (helpful if you have it) |
| Is Udyam enough for Meta? | **Often yes** as primary business proof for proprietors; keep PAN + address proof ready |
| Is Udyam free? | **Yes** — only on the official govt portal |
| Can I code while waiting? | **Yes** — build local webhook in parallel |

---

## Official links

- Udyam: https://udyamregistration.gov.in  
- Meta Business: https://business.facebook.com  
- Meta Business verification help: https://www.facebook.com/business/help  
- WhatsApp Cloud API docs: https://developers.facebook.com/docs/whatsapp/cloud-api  
