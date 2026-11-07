# Full product scope — research → content → leads → results

This expands beyond “auto-generate carousels.” Sleeping Creators’ case studies win on **hook quality + niche fit + lead path + proof of growth**, not on black slides alone.

Reference content DNA (from your screenshots):
- [Himanshu Agrawal grid](https://instagram.com/himanshuagrawal.official) — black “tweet-card” carousels, bolded keywords, curiosity hooks
- Portfolio niches: crypto coach, fitness coach, D2C coach, marketing consultant, vastu consultant
- Bios with **DM keyword** (`TRANSFORM`), Typeform, WhatsApp course, YouTube free training
- Results they show: views, interactions, saves/shares, follower growth, profile visits

---

## 1) Why research + writing comes *before* rendering

If you skip research, Gemini will produce generic motivation that looks like Himanshu but **does not convert that client’s buyer**. First clients churn; referrals die.

### Content formula visible in the examples

| Layer | What it is | Example |
|-------|------------|---------|
| **Hook (slide 1)** | Curiosity / tension / list promise | “9 sentences that will flip a switch…” / “Gen-Z isn’t disrupting. They’re killing entire industries…” |
| **Story or list body** | Swipeable points, bold key phrases | Comfort zone, one year all-in, brand case (ITC Aashirvaad) |
| **Caption** | Longer argument that mirrors slides | Waiting → hard truth → identity shift |
| **CTA** | Save / share / comment keyword / DM | “Continue Reading >” on slide; bio/DM for offer |
| **Lead path** | Off-grid conversion | Free training, Typeform, WhatsApp course |

**Saves and shares** matter more than likes for this format (educational / “reference” content). Your research module should hunt **save-worthy angles**, not just motivational fluff.

### Research pipeline (per client, once + weekly refresh)

```text
A. ICP & offer map          ← from onboarding form
B. Competitor / peer scan   ← 5–10 accounts in same niche
C. Hook & topic bank        ← what gets saves in that niche
D. Voice kit                ← banned words, claims, proof they allow
E. 30-day pillar calendar   ← themes tied to their offer
F. Weekly topic pack        ← 7–14 post briefs (JSON)
G. Only then → carousel render + caption
```

#### A–B what “research” means in practice (automatable + light human)

| Step | Automated | Human (15–30 min once) |
|------|-----------|-------------------------|
| List 5 peer accounts | Suggest from niche keywords | Client confirms / adds |
| Pull public hooks from recent posts | Scrape or manual paste of 20 captions/hooks into Drive | Spot-check tone |
| Cluster themes | LLM clusters pains, myths, case studies, listicles | Approve “do / don’t” |
| Claim safety | Flag medical/finance/guarantee language | Client signs off on claim list |

**Do not** promise illegal scraping of private data. Prefer: client pastes competitor URLs + you fetch public pages / use Meta oEmbed where allowed / manual export for pilots.

#### Weekly refresh (keeps results improving)

- Top 3 posts last 7 days (from your results DB)
- 5 new hooks in winning clusters
- 1 “proof/case” post if client has a story asset in the form
- 1 soft CTA post toward DM keyword or lead magnet

---

## 2) Details required from the client (posting + content + leads)

Split into **access**, **brand**, **offer**, **voice**, **proof**. Collect once in the form; store as `profile.json`.

### A. Account access (required to post)

| Field | Why |
|-------|-----|
| Instagram handle | Target account |
| Account type | Must be **Professional** (Business or Creator) |
| Linked Facebook Page | Needed for Graph API / ManyChat / Business tools |
| How you connect | Preferred: Meta login / Page token into *your* VPS publisher — **never store IG password** if avoidable |
| Facebook Page admin invite | Client makes your BM/user admin (or runs OAuth once) |
| YouTube channel (optional) | If you also post YT |
| Posting windows (IST) | e.g. 8:00, 13:00, 20:00 |
| Approval mode | `auto` (recommended productized) vs `approve_48h` for nervous clients |
| Content they forbid | Politics, religion, competitors, medical claims, etc. |

**Minimum legal/ops reality:** For Graph publishing and official DM automation, Professional + Page link + proper permissions. Password-based “login as client” is fragile and risky — document as last resort only for your existing VPS method if that is how you already operate.

### B. Brand kit (required for carousel template)

| Field | Why |
|-------|-----|
| Display name | On “tweet card” |
| Profile photo | Circle avatar on every slide |
| Show verified badge? | Visual only (don’t fake Meta verification in bio) |
| Colors | bg `#000`, text `#fff` default; allow brand override |
| Logo (optional) | Corner mark |
| Language | EN / HI / Hinglish |
| Template style | `tweet_card_dark` (Himanshu style) / `full_bleed_text` / custom |

### C. Offer & lead path (required for results that matter)

Posting without this = vanity growth.

| Field | Why |
|-------|-----|
| Primary offer | What they sell + price band |
| Dream client (ICP) | Who should follow/DM |
| 3 pains / 3 outcomes | Copy fuel |
| Lead magnet type | PDF / checklist / free video / WhatsApp community / webinar / Typeform quiz |
| Lead magnet asset | File upload or URL (or “create for me” add-on) |
| CTA keyword | e.g. `TRANSFORM`, `GUIDE`, `START` |
| Booking link | Cal.com / Calendly / WhatsApp wa.me |
| Bio link destination | Single link or Linktree |
| What “success” means in 30/60/90 days | Followers vs DMs vs booked calls vs revenue |

### D. Voice & proof (required for “correct” content)

| Field | Why |
|-------|-----|
| Origin story (5–10 lines) | Unique hooks (“farmer’s son”, “6 Lakh job”) |
| Beliefs / frameworks they own | Avoid generic LinkedIn sludge |
| Proof points | Results, clients, awards (only what is true) |
| 10 sample sentences “in my voice” | Few-shot for LLM |
| Competitors they admire | Research seeds |
| Topics to avoid | Compliance + brand safety |

### E. Ops contacts

| Field | Why |
|-------|-----|
| WhatsApp for approvals/emergencies | Ops group |
| Monthly report email | Results pack |

---

## 3) Auto DM replies — what to build vs buy

Portfolio pattern (Yash): bio says **“DM the word TRANSFORM”** → automation delivers next step (Typeform / PDF / booking).

### Recommended stack for first clients

| Layer | Tool | Notes |
|-------|------|--------|
| Comment → DM / keyword DM | **ManyChat** (or similar Meta partner) | Official API; comment-to-DM is the growth lever |
| Fallback | Instagram native “Saved replies” only | Weak for funnels |
| Custom Graph messaging on VPS | Later | App review + 24h window rules; don’t block MVP |

ManyChat needs: Professional IG + Facebook Page + “Allow access to messages” ([ManyChat keyword patterns](https://manychat.com/blog/what-are-keywords-ig/), [DM automation rules](https://manychat.com/blog/instagram-dm-automation-rules/)).

### Standard funnel you productize

```text
Carousel / Reel CTA: “Comment GUIDE” or “DM GUIDE”
    → Public comment reply: “Sent ✅ check DM”
    → DM: short value + button/link to lead magnet
    → Ask 1 question (email / “what’s your biggest struggle?”)
    → Tag lead in ManyChat
    → Optional: book-a-call link after magnet consumed
```

**Your app’s job:** store keyword, magnet URL, and inject CTA into every Nth post caption/slide. ManyChat (or later your worker) executes the DM.

### Compliance constraints (design for these)

- User must trigger (comment/DM/story reply) — no cold spam DMs  
- ~24-hour messaging window for free-form automation  
- Prefer Meta-approved tools for client accounts  

---

## 4) Lead magnets — build once per client

Without a magnet, Auto DM has nothing valuable to send → weak “results.”

### Magnet types that match coaching niches (from their portfolio)

| Niche pattern | Magnet | Build method |
|---------------|--------|--------------|
| Fitness | “7-day reset” PDF / TRANSFORM quiz | Gemini draft → Google Doc → PDF |
| Marketing / business | Checklist, swipe file, free YouTube playlist | Doc + Notion public page |
| D2C | “Offer teardown” one-pager | Doc |
| Vastu / spiritual | Free mini-course via WhatsApp | PDF sequence + WA link |
| Crypto / finance | **High compliance risk** — prefer educational glossary; avoid returns promises | Strict claim filter |

### Productized “we create the magnet” (add-on or included)

1. Form answers → outline (Gemini)  
2. You/Claude Code polish → 4–8 page PDF  
3. Host on Drive link or simple landing (Carrd/Framer free)  
4. Wire URL into ManyChat + bio  

First 3 clients: **include one simple magnet** so results include “X leads” not only “X views.”

---

## 5) Recording results (this grows your client base)

Sleeping Creators sells with **circled metrics**: 1.1M views, 4.1K followers, 149K on a post, high saves. You need the same proof engine from day 1.

### Metrics to store per client per day / per post

| Metric | Source | Why |
|--------|--------|-----|
| Followers, following, media count | IG insights / Graph / manual weekly | Growth curve |
| Reach, views, profile visits | Insights | “Visible results” |
| Likes, comments, saves, shares | Per post | Saves = content-market fit |
| Posts published / failed | Your scheduler | Ops reliability |
| DM keyword triggers / leads | ManyChat export or webhook | Business result |
| Booked calls | Cal.com webhook | Revenue proxy |

### Minimum viable “proof pack”

Weekly auto-generated Notion/PDF:
- Followers Δ  
- Top 3 posts (saves + reach)  
- Leads captured  
- 1 insight (“listicles on X theme won”)  
- Next week experiment  

Screenshot archive: your publisher or a weekly job saves insight screenshots to Drive — clients and your sales page both use them.

### App modules for results

```text
results/
  snapshots/{client}/{date}.json
  posts/{post_id}.json          # metrics 24h / 7d
  leads/{client}/events.jsonl   # from ManyChat webhook
  reports/{client}/{yyyy-ww}.md
```

For pilots without Graph insights access: **manual weekly paste** into a form still beats no data.

---

## 6) Better product suggestion (scope of *your* application)

Don’t sell “AI carousels.” Sell a **Personal Brand Content + Lead System**.

### Package (recommended)

**Name (working):** Authority Engine / Content OS  

**Promise:** Daily authority carousels + CTA → Auto DM → lead magnet → you get a weekly proof report.

| Included | Not in v1 |
|----------|-----------|
| Niche research pack (once) + weekly hook refresh | Full custom SaaS like Sleeping Creators UI |
| 20–30 tweet-card carousels / month | Heavy B-roll factory |
| Captions + posting via your VPS | Guaranteed follower count |
| 1 lead magnet | Complex email nurture (optional later) |
| 1 ManyChat keyword funnel setup | Managing client sales calls |
| Weekly results report | Avatar essays (only short hooks later) |

Price band for India coaches: **₹7,999–14,999/mo** once magnet + DM included (₹5,999 is tight if you also do research + magnet).

### Application modules (build order)

| # | Module | Purpose |
|---|--------|---------|
| 1 | **Onboarding** | All fields in §2 |
| 2 | **Research workspace** | Competitors, theme clusters, voice kit |
| 3 | **Brief generator** | Weekly JSON briefs *before* slides |
| 4 | **Carousel renderer** | Tweet-card HTML → PNG |
| 5 | **Publisher queue** | VPS + Drive |
| 6 | **CTA / funnel config** | Keyword, magnet URL, caption CTAs |
| 7 | **Results collector** | Snapshots + report |
| 8 | **Ops dashboard** (thin) | Status: research ✓ / queued / posted / leads |

Modules 2–3 are what you asked about — **they are first-class**, not optional fluff before “the real” renderer.

### Content generation rule (hard)

```text
No profile research kit → no generate()
No offer + keyword + magnet URL → mark client “growth-incomplete”
  (can still post, but sales promise must be “content only”)
```

First 3 clients: refuse “content only” if you want case studies with leads.

---

## 7) First-client success playbook (so referrals happen)

| Day | Action |
|-----|--------|
| 0 | Form + access + magnet decision |
| 1–2 | Research kit + voice kit; client 20-min voice call *optional* |
| 2–3 | Magnet draft + ManyChat keyword live |
| 3–4 | Bio update: one promise + DM keyword |
| 4–5 | Batch 14 carousels from approved pillars |
| 5–18 | Post 1–2/day; track saves; kill weak themes |
| 19–30 | Report with screenshots; ask testimonial if Δ leads or saves clear |

**Visible results to aim for (realistic for small accounts):**
- Engagement rate / saves up vs their prior 30 days  
- Consistent posting streak  
- First **10–50 keyword DMs** (magnet-dependent)  
- Not “+50k followers in 30 days” unless account already large  

---

## 8) How this uses your existing tools

| Tool | Role in this expanded scope |
|------|-----------------------------|
| Gemini Pro | Research clustering, briefs, magnet outlines, carousel JSON |
| Claude Code / Cursor | Research schemas, renderer, results reports, form |
| VPS publisher | Post + later insights pull if Graph allows |
| Drive | Research dumps, magnets, screenshot proof archive |
| Higgsfield | Optional 5–12s hook *after* carousel+DM works |
| ManyChat | Auto DM (buy seat when first paying client needs it; free tier for test) |

---

## 9) Updated MVP definition

You are not done when images post. MVP =:

1. Form captures access + offer + voice  
2. Research kit produced once  
3. Briefs → carousels → VPS publish  
4. Keyword DM + magnet live  
5. Week-4 report with metrics + screenshots saved to Drive  

That is the scope that can create **referrable first clients**. Carousel automation alone cannot.
