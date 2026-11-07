# Minimum investment & tool stack

All figures are **indicative INR (Sep 2026)**. Prefer free/trial until first paying client.

## Cash you actually need

| Stage | Purpose | Low | Realistic | Notes |
|-------|---------|-----|-----------|--------|
| **A. Validate** | Tools + domain + test ads/credits | ₹0–5,000 | **₹5,000–15,000** | Mostly free tiers |
| **B. Soft productize** | Paid seats that save hours | ₹8,000–20,000 | **₹15,000–40,000 / first 2 months** | Once 2–5 clients |
| **C. Custom Content Engine** | Hosting + APIs + 3–6 mo build time | ₹50,000+ | **₹2–8L+** (cash + opportunity) | Optional; after revenue |

**Minimum to start testing: ~₹5,000** (or ₹0 if you already have ChatGPT/Canva and skip paid ads).

---

## Tool map (free → paid)

### 1. Client intake & ops

| Need | Free start | Paid later |
|------------------|------------|
| Onboarding form | Tally / Google Form | Typeform |
| Client CRM + calendar | Notion / Airtable free | Airtable Team |
| Files | Google Drive | — |
| Client chat | WhatsApp | WhatsApp Business API only if volume needs it |

### 2. AI writing / strategy

| Need | Free start | Paid later |
|------|------------|------------|
| Hooks, captions, carousel outlines | ChatGPT / Gemini free, Claude free limits | Claude Pro / ChatGPT Plus (~₹1.5–2k/mo) |
| Batch generation API | Skip at first | OpenAI / Anthropic API pay-as-you-go |

Budget when live: **₹500–3,000/mo** API+subscription until scale.

### 3. Design (carousels) — prefer code, not Canva

| Need | Free start (recommended) | Paid later |
|------|--------------------------|------------|
| Automated slides | **HTML/CSS + Playwright on VPS** | Creatomate / Bannerbear only if render ops hurt |
| One-time visual exploration | Figma free / Canva Free / Photopea | — |
| Brand kit per client | `profile.json` colors + logo path | — |
| Canva Pro | **Skip** for automated system | Only if you keep a human design lane |

**Canva Pro is not useful in the hot path** if slides are rendered by code. Details: [05-AUTOMATED-SYSTEM-PLAN.md](05-AUTOMATED-SYSTEM-PLAN.md) §8.

### 4. Video / “avatar” / B-roll

| Need | Free start | Paid later |
|------|------------|------------|
| Edit reels | CapCut free | CapCut Pro if needed |
| Stock B-roll | Pexels / Pixabay | Envato if required |
| AI avatar / lip-sync | HeyGen / Synthesia / similar **trials** | ₹2,000–15,000+/mo — **defer until a client pays for avatar package** |
| Voiceover | Edge TTS / ElevenLabs free tier | ElevenLabs paid |

**Recommendation:** Do not subscribe to avatar video on day 1. Offer “faceless B-roll + captions” first; upsell avatar as add-on.

### 5. Publishing & automation

| Need | Free start | Paid later |
|------|------------|------------|
| Schedule IG posts/reels | Meta native scheduling (limited) | Late / Buffer / Metricool (~₹1–4k/mo) |
| Multi-client publish API | — | Scheduler API or Meta Graph (free API, costly time) |
| Workflow glue | n8n self-host free / Make free tier | Make/n8n cloud |
| DM → lead capture | ManyChat free tier limits | ManyChat Pro |

Instagram Graph API itself has **no per-call fee**, but App Review + client Page linking is the real cost ([Meta publishing limits](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/content_publishing_limit/)).

### 6. Lead gen & booking

| Need | Free start | Paid later |
|------|------------|------------|
| Booking | Cal.com / Google Calendar | Calendly paid |
| Landing / lead magnet host | Carrd free / Notion public | Carrd Pro / Framer |
| Email (optional) | Brevo free | Paid when list grows |

### 7. Analytics / reporting

| Need | Free start | Paid later |
|------|------------|------------|
| Monthly report | IG Insights + Google Slides template | Bundle.social / native Graph insights later |

Their UI literally says metrics “from Bundle” — using a vendor beats rebuilding analytics early.

### 8. Payments (India)

| Need | Approx |
|------|--------|
| Razorpay / UPI links | ₹0 setup; payment gateway fees on success |
| GST / invoices | Use existing firm process if you have Udyam etc. |

---

## Unit economics (sanity check)

Assume package **₹5,999/mo** (video price).

| Cost per client / month (early, semi-manual) | Rough |
|-----------------------------------------------|--------|
| AI + Canva share | ₹200–600 |
| Scheduler seat share | ₹100–400 |
| Video/API (if any) | ₹0–1,000 |
| Your time (biggest) | 8–20 hrs early → aim ≤6 hrs with templates |

Gross margin on software costs can look **80%+**; **labor** decides if ₹5,999 is viable. Raise to **₹9,999–14,999** for coaches with assets, or cut deliverables (12 carousels + 4 reels) until systems exist.

Break-even time (solo, part-time): often **2–5 paying clients** cover tool stack.

---

## Investment scenarios

### Scenario 1 — Solo validation (recommended minimum)

- Cash: **₹0–5,000** if you already have Cursor / Claude / Gemini / VPS / Drive (your case)  
- Tools: HTML+Playwright carousels, ffmpeg optional, existing VPS publisher, rclone → Drive  
- Goal: 7 auto-published carousels on one account with no Canva in the loop  

### Scenario 2 — Serious productized ops (still no custom SaaS UI)

- Cash: **₹15,000–40,000** over 3 months (domain, optional ManyChat, small API overage)  
- Goal: multi-client folders + form + reliable cron  

### Scenario 3 — Full ops dashboard (“Content Engine” UI)

- Only after Scenario 2 posts reliably for multiple clients  

---

## What not to buy yet

- Canva Pro (automated path doesn’t need it)  
- Annual HeyGen / Synthesia seats before revenue  
- Expensive “all-in-one AI agency OS” courses  
- Custom mobile apps  
- Scraping APIs for competitor stalking (fragile + ToS risk)

---

## First 30-day shopping list (your stack)

1. Nothing required beyond what you have  
2. Optional: Tally/Google Form for onboarding  
3. Confirm rclone on VPS ↔ Drive  
4. Use Gemini credits for 14-day carousel JSON batches  
5. Use ≤50% Higgsfield credits for short hook tests only  
6. Build renderer with Cursor / Claude Code on VPS  

**Hard floor with your resources: ₹0.**  
**Sensible optional buffer: ₹5,000.**
