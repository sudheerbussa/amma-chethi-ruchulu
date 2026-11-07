# 2–3 day Cursor sprint — where to start

**Test brand:** your food Instagram (ACR / Amma Chethi Ruchulu).  
**Dev:** local machine + Cursor.  
**Publish:** VPS cron → your existing IG post-now.  
**Ads:** create creative + audience brief in this sprint; **do not** automate Meta Ads API yet.

---

## Brutal scope (so 2–3 days is possible)

| In scope | Out of scope (later) |
|----------|----------------------|
| `profile.json` for your food account | Multi-tenant SaaS UI |
| Lite profile “audit” from form + public notes | Deep scraping competitors at scale |
| HTML tweet-card → PNG carousel (Playwright) | Canva / avatar video |
| Queue folder → rsync/scp to VPS → cron publish | Meta Ads campaign creation API |
| 3–7 scheduled food carousels live | ManyChat (day 4+) |
| Ads **brief + creative export** for manual Ads Manager | Auto-optimize ads |

**Ads promise for your campaign:** “I run IG posts + Meta ads” = system posts organically + you launch ads in Ads Manager using exported creatives/audience notes. Full ads API = week 2+.

---

## Where to build

```text
productized-content-engine/
  docs/           ← strategy (already exists)
  mvp/            ← OPEN THIS FOLDER IN CURSOR ← start here
    clients/acr/
      profile.json
    templates/tweet-card/
    scripts/        ← generate, render, pack-for-vps
    queue/          ← local output before upload
    prompts/
```

Open **`mvp/`** as the Cursor workspace (or add it as a folder), not the whole monorepo, so the agent stays focused.

---

## Day-by-day

### Day 1 — Render + one live post (must finish)

**Goal:** One carousel PNG set + caption lands on your food IG via VPS.

1. Fill `clients/acr/profile.json` (niche = home food / Tenali, offer, CTA, colors, face/logo path).
2. Finish HTML template `templates/tweet-card/slide.html`.
3. `npm i` + Playwright; `node scripts/render-carousel.mjs` with sample JSON → `queue/acr/<date>/`.
4. Document your VPS contract in `mvp/VPS_PUBLISH.md` (exact path + command your publisher already uses).
5. `scp`/`rsync` one pack to VPS; trigger **post now** once (manual or cron).

**Done when:** post is visible on IG. If this fails, do not start Day 2 features.

### Day 2 — Generate batch + schedule + lite audit

**Goal:** 5–7 carousels queued with `publish_at`; simple audit markdown.

1. Prompt pack: food hooks (lunch cutoff, Amma story, monthly pack, FSSAI-safe claims).
2. `scripts/generate-briefs.mjs` — call Gemini/Claude API **or** paste Gemini Pro output into `briefs/*.json` (API optional if credits are web UI).
3. Loop render for 5–7 days; set `meta.json` with IST `publish_at`.
4. VPS cron: every minute, publish due packs (reuse your existing poster).
5. `scripts/audit-lite.mjs` — from `profile.json` + optional pasted competitor hooks → `clients/acr/audit.md` (gaps, pillars, CTA). Enough for “analyze profile” in ads copy.

**Done when:** tomorrow’s post publishes without you clicking IG.

### Day 3 — Ads-ready pack (manual Meta Ads) + your offer landing notes

**Goal:** Something you can run an ad campaign *about* and *with*.

1. Export best 3 carousels as ad creatives (same PNGs; 1:1 works for IG feed/boost).
2. Write `clients/acr/ads-brief.md`:
   - Objective (messages / WhatsApp / traffic to order bot)
   - Geo (Tenali / Guntur radius)
   - Interests / lookalike notes (home food, tiffin, working professionals)
   - Primary text + CTA from winning caption
   - Budget test (e.g. ₹300–500/day)
3. Create campaign **by hand** in Meta Ads Manager (Boost or Traffic/Messages).  
4. Optional: one-pager offer text for “I run your IG + Meta ads” using ACR as case study once 3 days of posts exist.
5. Freeze: list bugs; do **not** start Ads API.

**Done when:** organic schedule running + one paid test live OR ready to launch with brief filled.

---

## Cursor prompts (copy-paste)

**Session 1 (Day 1):**
```text
Open mvp/. Implement tweet-card HTML template + render-carousel.mjs with Playwright.
Input: clients/acr/sample-carousel.json
Output: queue/acr/YYYY-MM-DD/carousel/01.png… + caption.txt + meta.json
Match docs/05 folder contract. No Canva. No ads yet.
```

**Session 2 (Day 2):**
```text
Add generate flow from clients/acr/profile.json → 7 food-niche carousel JSONs.
Then batch-render into queue with publish_at IST.
Add audit-lite.md generator from profile + competitors list.
```

**Session 3 (Day 3):**
```text
From queue, pick top creative; generate clients/acr/ads-brief.md for Meta Ads Manager
(manual launch). Document scp + cron steps in VPS_PUBLISH.md for my existing poster.
```

---

## Local vs VPS split

| Machine | Responsibility |
|---------|----------------|
| **Laptop + Cursor** | profile, prompts, HTML, Playwright render, queue packing, ads brief |
| **VPS** | store packs, cron, IG/FB publish-now, failure log |

Do **not** run Playwright on VPS on Day 1 unless local render is painful — render local, upload PNGs (food carousels are small).

---

## Ad campaign honesty

Your public offer “IG posts + Meta ads” in week 1 means:

1. Automated **organic** carousels (this MVP)  
2. **Human-launched** Meta ads using system creatives + geo/audience brief  

Say that clearly in ads so you do not overpromise full autopilot ads.

---

## Start command (right now)

```bash
cd productized-content-engine/mvp
# In Cursor: File → Open Folder → mvp
# Then paste Session 1 prompt above
```

Next file to edit after opening: `clients/acr/profile.json`.
