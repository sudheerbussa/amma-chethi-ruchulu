# Automated system plan (VPS + your stack)

Revised plan for an **automated content generator + publisher**, matching your constraints (not a manual Canva agency).

## Goals

1. One onboarding form → enough brand/voice data that the **creator is not needed again** for footage or copy reviews (optional QA gate later).
2. **Carousels first** (Sleeping Creators’ real volume lever) — fully automated render + schedule.
3. **Short AI-avatar clips only** (5–15s hook / CTA), not full talking-head videos.
4. Reuse what you already have: **VPS publisher**, **Google Drive 5TB**, **Claude Code / Cursor / Gemini Pro / Higgsfield trial**.
5. Skip Canva Pro while testing; generate slides programmatically.

---

## 1) Target architecture

```text
[Onboarding Form]
      │  niche, offer, ICP, tone, CTAs, IG/FB/YT handles, brand colors, face photo (optional)
      ▼
[Client Profile DB]  ← JSON/Postgres on VPS
      │
      ▼
[Content Planner]  ← daily/weekly cron
      │  pillars → hooks → post types (carousel | short_reel | story)
      ▼
[Generators]
      ├─ Copy: Gemini Pro / Claude (via API or batch jobs you run from Cursor/Claude Code)
      ├─ Carousel renderer: HTML/CSS templates → PNG/JPEG slides (Playwright/Puppeteer on VPS)
      └─ Short reel (optional): Higgsfield avatar clip + CapCut-style compose OR skip until credits used
      ▼
[Asset Store]
      ├─ Small carousels → local VPS disk (`/data/clients/{id}/YYYY-MM-DD/`)
      └─ Larger / archive → Google Drive 5TB (rclone sync)
      ▼
[Scheduler DB]  ← publish_at, platform, status, media_paths, caption
      ▼
[Publisher workers on VPS]  ← your existing IG/FB/YT poster
      ├─ FB / YT: keep current path
      └─ IG: at publish_at, pull assets from VPS or Drive → post now
            (Graph API if approved; else your existing “post now” path —
             do not rely on Meta’s native schedule)
```

### Why Drive + VPS together

| Asset | Store where | Why |
|-------|-------------|-----|
| Carousel slides (usually &lt; 5–15 MB set) | **VPS** | Fast for cron publish; no Drive latency |
| Reel masters, avatar exports, archives | **Drive via rclone** | 5TB buffer; VPS disk stays small |
| Manifest `post.json` | VPS DB or next to assets | Publisher reads one file: caption + slide list + time |

Suggested layout:

```text
/data/clients/{client_id}/
  profile.json
  2026-09-10/
    carousel/
      01.png … 08.png
      caption.txt
      meta.json          # platform, hashtags, cta
    reel_hook/           # optional short clip
      hook.mp4
      caption.txt
```

rclone: sync `reel_hook/` and monthly archives to Drive; keep last 14 days of carousels on VPS.

---

## 2) Instagram scheduling (Meta blocked)

You do **not** need Meta’s “schedule” feature.

| Approach | How it works |
|----------|----------------|
| **Recommended** | VPS cron every minute: `WHERE publish_at <= now() AND status=queued` → call your **publish-now** for IG |
| Assets | Carousel already on VPS **or** rclone copy from Drive → temp → publish → delete temp |
| FB/YT | Keep existing scheduler if it already works |

If Graph API Content Publishing is unavailable for some accounts, keep using whatever post-now method your VPS already uses for those accounts. The productized system’s job is: **generate early, store, fire at time**.

Publishing limit reminder: IG API accounts typically allow on the order of **~50 containers / 24h** — query `content_publishing_limit` when Graph works. One carousel = one post.

---

## 3) Carousel automation (main product)

Sleeping Creators’ visible output is mostly **text-authority carousels** (black slide, profile chip, bold claim, “Continue reading”). That pattern is ideal for code.

### Pipeline

1. **Planner** picks pillar + hook template  
2. **LLM** outputs structured JSON:

```json
{
  "slide_count": 7,
  "slides": [
    { "role": "hook", "text": "…" },
    { "role": "point", "text": "…" },
    { "role": "cta", "text": "DM START" }
  ],
  "caption": "…",
  "hashtags": []
}
```

3. **Renderer** fills an HTML template (brand colors, optional face crop from onboarding) → Playwright screenshot each slide at 1080×1080  
4. **QA rules** (automated): max chars/slide, banned words, CTA present, contrast check  
5. Queue for publish  

### Free render stack (no Canva)

| Tool | Role |
|------|------|
| HTML/CSS templates you own | Design system |
| Playwright / Puppeteer on VPS | PNG export |
| **Sharp** / ImageMagick | Resize, compress |
| Optional: Figma free (manual template design once) | Design source → export CSS/HTML |
| Photopea (browser, free) | Rare manual fix while testing |
| Canva Free | Only if you want a human to tweak 1 pilot — **not** in the automated path |

Gemini Pro + Claude Code: use during testing to **generate templates and the renderer script**, not as the forever runtime UI.

---

## 4) AI avatar — small clip only

| Use | Length | When |
|-----|--------|------|
| Hook face clip for Reel cover / first 3–8s | 5–12s | After carousel system works |
| Full 30–60s avatar essay | Skip | Sleeping Creators demos this more than you need |

**This month:** burn **Higgsfield ~200 credits** on 5–10 test hooks for **your own** or one pilot brand (same face still from form photo). Pipeline:

```text
LLM script (1–2 sentences)
  → Higgsfield avatar render
  → store mp4 on Drive
  → optional: ffmpeg + B-roll underlay later
  → publish as Reel OR keep carousel-only until quality is OK
```

Do not block MVP on avatar.

---

## 5) One-time creator form (fields that make “no footage” work)

Collect once; regenerate for months.

**Required**
- Name, handle, niche, one-line authority
- Offer + price / CTA (DM keyword, link, WhatsApp)
- ICP (who they help) + 3 pains + 3 promises
- Tone (formal / spicy / spiritual / corporate) + language (EN / HI / mixed)
- Brand: primary/bg colors, logo, optional face photo
- Topics they **won’t** touch
- Platforms + credentials handoff (how your VPS already connects)

**Optional**
- 10 sample lines “in their voice”
- Competitor handles (for research job, not daily input)
- Lead magnet PDF or link

Store as `profile.json`. Every generation job reads only this + calendar rules.

---

## 6) B-roll reels — plain explanation

**Carousel** = several still images you swipe.  
**Reel** = short vertical video.

**B-roll** = footage that is *not* the person talking to camera. Examples:
- Hands typing, city traffic, gym weights, food plating, whiteboard, stock “thinking” shots  
- Used **under** or **between** voice/avatar so the video isn’t a static talking head  

**A-roll** = main speaker (real or AI avatar).  
**B-roll reel** (productized sense) ≈ short video built from stock/AI clips + captions + optional tiny avatar intro — **no client filming**.

### For you (minimal viable “reel” without deep B-roll skill)

| Level | What to ship | Tools |
|-------|----------------|-------|
| L0 | **Carousel only** | HTML renderer |
| L1 | Caption-on-gradient video (Ken Burns on slides) | ffmpeg |
| L2 | Stock B-roll + voiceover/captions | Pexels + ffmpeg |
| L3 | 5–12s Higgsfield avatar + cut to B-roll | Higgsfield + ffmpeg |

Start **L0 → L1**. Treat L2/L3 as add-ons after carousels auto-post reliably.

---

## 7) Use your existing subscriptions (testing phase)

| Asset | How to use | Do not |
|-------|------------|--------|
| **Cursor + Claude Code** | Build form → planner → renderer → queue → publisher glue on VPS | Burn tokens redesigning UI endlessly |
| **Gemini Pro (1000 credits/mo)** | Batch copy JSON for 30 days of carousels; competitor teardown drafts | Put Gemini in the hot path until prompts are stable — export winning prompts to API later |
| **Higgsfield 200 credits** | 5–10 hook clips max; document settings that look acceptable | Full-length avatar videos |
| **VPS** | Cron, Playwright, ffmpeg, queue worker, rclone | Host huge media forever — offload to Drive |
| **Drive 5TB** | Archive + large mp4 | Source of truth for *active* day’s carousels (prefer VPS for speed) |

### Suggested test burn (2–3 weeks)

1. Week 1 — Claude Code/Cursor: HTML carousel template + Playwright export + folder contract matching your publisher  
2. Week 1 — Gemini: generate 14 days of JSON carousels for **one fictional or own brand**  
3. Week 2 — Wire VPS cron “publish_at → post now”; prove IG posts without Meta schedule  
4. Week 2 — rclone archive path  
5. Week 2–3 — Spend ≤ half Higgsfield credits on hook experiments; keep rest for a real pilot  

Cash need beyond what you have: **≈ ₹0** for this test phase (domain/form optional).

---

## 8) Is Canva Pro useful if the system is automated?

**In the automated path: almost no.**

| Canva Pro helps when… | Automated system instead… |
|------------------------|----------------------------|
| Human designer tweaks layouts | Code-owned HTML templates |
| Brand kit + magic resize for freelancers | CSS variables from `profile.json` |
| Background remover / magic studio | Separate free tools only if needed once |
| Team shared folders | Drive + VPS paths |

**When Canva (even Free) is still OK**
- Designing the **first** visual system by hand, then recreating it in HTML  
- Emergency fix for one VIP client  

**Do not** subscribe to Canva Pro to run Sleeping Creators–style volume. Their scale implies template/code or a design ops team — not clicking Canva per slide.

### Free alternatives while testing

| Need | Free option |
|------|-------------|
| Slide design exploration | **Figma** free, **Canva Free**, **Photopea** |
| Automated export | **Playwright** screenshot HTML |
| Image edit CLI | **ImageMagick**, **Sharp** |
| Icons | Lucide / Heroicons SVGs in HTML |
| Fonts | Google Fonts (self-host on VPS for Playwright) |
| Background remove (rare) | remove.bg free tier / local tools — only ad hoc |

---

## 9) Revised MVP scope (what to build)

### Must have (MVP)
- [ ] Onboarding form → `profile.json`
- [ ] Prompt pack → carousel JSON (Gemini/Claude)
- [ ] HTML templates (2–3 styles: dark authority, light clean, niche variant)
- [ ] Playwright render → VPS paths
- [ ] Schedule rows + cron publish via existing VPS poster (IG post-now + FB/YT)
- [ ] rclone archive to Drive

### Nice soon
- [ ] ffmpeg “carousel → simple Reel” (L1)
- [ ] Higgsfield hook insert (L3) using remaining credits
- [ ] Simple ops UI (even a table): queued / posted / failed

### Explicitly later
- Full Sleeping Creators SaaS UI  
- Canva Pro  
- Heavy B-roll research factory  
- ManyChat (add when lead-gen package is sold)

---

## 10) Solo timeline with *your* resources

| Week | Focus | Uses |
|------|--------|------|
| 1 | Folder contract + HTML template + Playwright on VPS | Cursor / Claude Code |
| 2 | Gemini batch 14-day content + queue → render | Gemini Pro |
| 3 | Scheduler glue to existing publisher; 7 live posts on one account | VPS |
| 4 | Form + multi-client folders; Drive rclone; optional 3–5 Higgsfield hooks | Form + Higgsfield |

**Two-person split (if you add someone):** Person A = prompts + client form/sales; Person B = renderer/publisher reliability. Until Week 3 works solo, do not split.

---

## 11) Success criteria for “automated”

You are done with MVP when **without opening Canva**:

1. Fill form once  
2. Run `generate --client X --days 7`  
3. Files land on VPS  
4. Cron publishes IG/FB at `publish_at`  
5. Failures land in a log you can retry  

B-roll and avatar are **optional modules** on top of that spine.
