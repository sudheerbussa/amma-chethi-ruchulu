# Meta verification — waiting + what to do next

**Status:** Verification **submitted** with Udyam certificate.  
**Business portfolio:** Amma Chethi Ruchulu  
**Proprietor:** Lakshmi Penumaka  
**URN:** UDYAM-AP-04-0142646

---

## While Meta reviews (1–5+ business days)

### Must watch
- [ ] Check **Settings → Security Centre** every 1–2 days  
- [ ] Check email: **order.ammachethiruchulu@gmail.com** (and Lakshmi’s Facebook email)  
- [ ] If Meta asks for more docs → reply quickly (PAN / address proof / clearer PDF scan)

### Good parallel work (does not need Meta approval)

| Priority | Task | Why |
|----------|------|-----|
| High | Create **Facebook Page** “Amma Chethi Ruchulu” + logo | ✓ Done — https://www.facebook.com/profile.php?id=61592543611685 |
| High | Start **FSSAI Basic Registration** (Phase 2B) | See `FSSAI_FILL_SHEET.md` |
| Medium | Local order bot | ✓ Scaffold in `order-bot/` — test with simulate |
| Medium | Confirm WhatsApp Business number plan for `8886128995` | Phase 4 phone |
| Medium | Razorpay signup (test mode) under proprietor | Payments later |
| Low | Start local webhook / Postgres scaffold (Phase 5) | Architecture while waiting |
| Ops | Talk to 3–5 possible cooks in Davuluru / nearby | Soft pilot prep |

### Do **not** wait to start
- FSSAI (before selling food)  
- Cook recruitment conversations  
- Facebook Page setup  

### Wait for “Verified” before
- Full production limits + real business number polish  
- Heavy template / broadcast setup  

### Do **now** (verification still pending — 48h+ is normal)
- [ ] **WhatsApp Cloud API sandbox test** — see `WHATSAPP_API_TEST_NOW.md`  
  Meta test number + 5 allowed recipients + your `order-bot` webhook  
- Keep checking Security Centre / email in parallel

---

## When Security Centre shows Verified

1. Tick Phase **3.6** on checklist  
2. **Phase 4 — WhatsApp Cloud API**
   - Meta Developer App → add WhatsApp  
   - Connect phone `+91 8886128995` (or dedicated SIM if you decide later)  
   - Display name, logo, website, about  
3. Then **Phase 5** — local server + webhook for order bot  

---

## If verification is rejected

Common fixes:
- Name/address must match Udyam PDF exactly  
- Re-upload clearer Udyam PDF  
- Add PAN of Lakshmi Penumaka if asked  
- Website must open (your Vercel URLs already do)

Paste Meta’s rejection reason here and we’ll fix it step by step.

---

## Suggested “this week” order

1. Watch Meta verification status / email  
2. ~~Create Facebook Page + upload logo~~ ✓  
3. Apply **FSSAI Basic** on [foscos.fssai.gov.in](https://foscos.fssai.gov.in)  
4. When Verified → WhatsApp Cloud API setup  
5. Optional: link Page to Business portfolio in Meta Settings → Accounts → Pages