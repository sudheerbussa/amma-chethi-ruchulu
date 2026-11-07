# Newspaper website — internal quote, effort & hosting

**Audience:** Internal only (do not send this file as-is)  
**Date:** 15 Aug 2026  
**Status:** Draft for your questions — prices are tentative until discovery is locked  
**Reference sites reviewed:** [swarnasagaram.com](https://swarnasagaram.com/) (news portal) · [epaper.swarnasagaram.com](https://epaper.swarnasagaram.com/index.php?date=2026-08-15) (ePaper)

This is a **first newspaper / news-channel website** for you. The stack recommendation below is chosen so the paper can publish several times a day **without calling you**, and so you do not drown building a custom CMS from scratch.

---

## 1. What the reference actually is

Swarna Sagaram is a **mandal-level Telugu print + digital paper** (Vakadu / Kota / Gudur belt, Tirupati district), not Eenadu or TV9. Editor: Dama Vijay Kumar. Two properties, two codebases, one brand.

| Property | URL | What it is | Tech found (15 Aug 2026) |
|----------|-----|------------|---------------------------|
| **News portal** | swarnasagaram.com | Category news site, articles, ads, push, SEO | **WordPress 7.0.4** + **tagDiv Newspaper 12.7.3** (Composer / Cloud Library). Hostinger (`hcdn`). PHP 8.3 |
| **ePaper** | epaper.swarnasagaram.com | Date-wise scanned/PDF paper, page turn, clip, share | **Custom PHP** by Veda Software. **PDF.js** + **Cropper.js**. Main + Tabloid editions |

### Scale (live, not marketing)

| Signal | Number | What it means for the quote |
|--------|--------|-----------------------------|
| Published articles | **390** | Small archive. Homepage + 12 real categories is enough. Do not price like a metro daily. |
| Categories in WP | 32 (most empty) | Theme defaults left unused. Client only uses ~8–10 (Kota, AP, editorial, district, crime, politics). |
| Authors / reporters | **8** WP users | They already work as a small newsroom. New site **must** have reporter logins. |
| ePaper PDF (15 Aug 2026) | **~2.9 MB** | Typical daily upload. Conversion + images are the storage/CPU load, not traffic. |
| Lifetime visitor counter on ePaper | **22,934** | Tiny traffic. A 4 GB VPS is about hardware headroom (PDF convert), not “scale”. |
| Publish cadence (Aug 2026) | ~1 story every few days on the portal | They *say* they may update many times a day. Build for that; do not staff it yourself. |
| Monetization already on | Google AdSense + OneSignal + Site Kit + AIOSEO | Ads and push are expected, not exotic. |
| Breaking-news ticker | Shows “Loading News…” | Reference is imperfect. You can beat it without copying bugs. |

**Footer on both sites:** designed by Veda Software. The ePaper is their product class (PHP viewer + PDF upload). The portal is a standard premium WordPress news theme.

**Commercial context:** SaaS vendors already sell this exact product cheap:

- [Veda Software](https://m.vedasoftware.in/) ePaper plans roughly **₹4,999–₹39,999 / year**
- [Vedanta Software](https://vedantasoftware.com/product/epaper-software) ePaper **₹7,450–₹55,450 / year + GST**; news portal **₹15,450–₹59,450 / year**; combo from **~₹19,450 / year**

If the client only wants “same as that site, cheapest,” they can buy SaaS. **Your quote must sell ownership, local Telugu support, reporter training, and a site they keep if they stop paying a SaaS vendor** — not a 10× clone of a ₹20k/year subscription.

---

## 2. Complexity verdict

**Visual complexity:** Medium. Newspaper homepage (ticker, grids, popular posts, category rows, language switcher, ads). Looks heavy; most of it is a **theme**, not custom code.

**Functional complexity:** Medium-low, with **one sharp piece** (ePaper).

| Piece | Effort | Notes |
|-------|--------|--------|
| News portal | Medium | WordPress + news theme + Telugu + roles. Solved problem. |
| ePaper viewer + date archive | Medium | PDF upload → pages → mobile viewer. Doable; do not rewrite PDF.js. |
| Clip / crop a story from the page | Medium-high | Reference uses Cropper.js. Put in Growth, not Starter. |
| Multi-language (6 languages in footer) | Low if fake, high if real | Reference is almost certainly a **translate widget**, not six newsrooms. Quote native Telugu (+ optional English) only. |
| Live TV / news channel studio | High | Only if they truly want a **channel**, not a paper. Separate add-on. |
| Custom CMS from scratch | Very high | Do **not** do this on a first newspaper job. |

**Bottom line:** Recreating *this* reference is a **WordPress news portal + an ePaper module**, not a product company. First-time hours are high because *you* are learning the genre; the product itself is standard.

---

## 3. How they update without depending on you

This is the load-bearing decision. Give them an **admin**, not a WhatsApp-to-you pipeline.

### Recommended stack (first newspaper site)

| Layer | Choice | Why |
|-------|--------|-----|
| CMS | **WordPress** | They already know this pattern (reference *is* WP). Reporters get logins. You are not the bottleneck. |
| Look | Premium news theme (tagDiv **Newspaper**, JNews, or similar) | 70% of the Swarna Sagaram look is the theme. Buy the license (~$60–80), do not fake it in custom CSS for weeks. |
| ePaper | Small **custom plugin** (or tightly scoped PHP app) on the same WP | Custom post type `Edition`: date, PDF, optional tabloid PDF. On Publish → convert pages. Front = page images + PDF.js. |
| PDF → images | **ImageMagick + Ghostscript** on the VPS | Needed for fast mobile pages and WhatsApp-quality clips. 2 GB RAM is tight during convert; **4 GB is the real minimum**. |
| Cache | Redis object cache + Nginx page cache | Keeps a 4 GB box snappy when a story is shared on WhatsApp. |
| You | Super-admin only | Plugins, theme, server, backups. Not daily copy-paste. |

Do **not** build a custom Next.js + headless CMS unless they pay Package D+ and you want a second product. Headless still needs an admin; you would be rebuilding WordPress.

### Roles (create these on day one)

| Role | Who | What they can do | What they cannot do |
|------|-----|------------------|---------------------|
| **Administrator** | You (and maybe owner, later) | Plugins, theme, users, ePaper settings, server | — |
| **Editor / Publisher** | Owner or chief reporter | Publish, edit anyone’s copy, homepage featured, breaking ticker, ads text | Server / plugins |
| **Author / Reporter** | Field reporters | Write, add photos, submit or publish *their* stories | Change homepage layout, delete others’ work |
| **ePaper operator** | Page-make-up / office staff | Upload today’s PDF, set date, hit Publish | Theme / users |

Same WordPress login screen. Telugu admin is available (WP locale). Train in person once; leave a 1-page SOP + 5-minute screen recording.

### Daily workflows (their job, not yours)

**A. News story (5–15 min, many times a day)**  
WP Admin → Posts → Add New → Telugu title → category (Kota / AP / Crime…) → featured photo → body → **Publish** (or Submit for Review if Editor wants to gate).  
Optional: tick **Breaking** (shows in ticker) and **Featured** (homepage hero).

**B. ePaper edition (5–10 min, once or twice a day)**  
WP Admin → ePaper → Add Edition → pick date → upload Main PDF (and Tabloid if they have it) → Publish.  
Server converts pages in the background (1–3 min for a ~3 MB PDF). They refresh the public URL `epaper.client.com/?date=YYYY-MM-DD`.

**C. Correction**  
Open the post → edit → Update. ePaper: upload a replacement PDF for the same date.

**D. What they still call you for (paid maintenance, not panic)**  
Site down, SSL, hacked plugin, “change the homepage design”, new category *structure*, AdSense policy, new reporter laptop issues that are actually Gmail — not “please upload today’s paper”.

### Explicitly refuse in the SOW

- You will **not** type or publish daily news.  
- You will **not** convert WhatsApp forwards into posts unless they buy a **content retainer**.  
- Unlimited design tweaks after go-live = change request.

If they currently send stories as WhatsApp images, teach: “photo + 4 lines in WordPress”, not “forward to developer”.

---

## 4. Packages (what to offer)

Four packages. **Open with C** unless they only pointed at the ePaper URL and refuse a portal.

### Feature matrix (A vs B vs C vs D)

| Feature | A ePaper | B Portal | C Both | D Growth |
|---------|:--------:|:--------:|:------:|:--------:|
| Public news website (articles, categories, homepage) | — | Yes | Yes | Yes |
| Reporter / editor logins (publish without you) | ePaper login only | Yes | Yes | Yes |
| Telugu UI + ~10 categories | — | Yes | Yes | Yes |
| Search, WhatsApp/FB share, SEO, Analytics | Basic date SEO | Yes | Yes | Yes |
| Ad slots (AdSense / banners) | Optional banner | Yes | Yes | Yes + documented ad cards |
| Daily ePaper: upload PDF → pages → date archive | Yes (Main) | — | Yes | Yes |
| Second edition (Tabloid or district) | — | — | One extra | One extra |
| Portal ↔ ePaper cross-links | — | — | Yes | Yes |
| Clip / crop a story from the page | — | — | — | Yes |
| Push notifications (OneSignal) | — | — | — | Yes |
| Google News / fast mobile (AMP-class) | — | — | — | Yes |
| Video / YouTube section | — | — | — | Yes |
| Editor homepage layout training | — | — | — | Yes |
| Trainings / hypercare | 1 / 7 days | 1 / 14 days | 2 / 21 days | 3 / 30 days + style guide |
| **Open price** | ₹45,000 | ₹70,000 | **₹1,05,000** | ₹1,65,000 |

A and B are **different products** (flipbook vs article site). C is A+B wired together. D is C plus monetization and newsroom extras. Nothing in D is required to match the *job* of the reference; clip/push/Google News are how the reference *also* earns/reaches.

Hours below are **your first newspaper site, padded**. A specialist would be ~40% faster. Price for the **Andhra local-paper market**, not your worst-case hours (or you will quote ₹2 L and lose to Veda). After this build, the next paper should be quoted lower or done faster at the same price.

GST: add **18%** if you are registered. Domain is client-owned. Hosting is extra unless bundled in maintenance.

### Package A — ePaper only

**When:** They only want the flipbook / date archive (the URL they sent).  
**One-time:** **₹40,000 – ₹50,000** (open **₹45,000**)  
**Your hours:** ~55–70  
**Calendar:** 2.5–3.5 weeks  

Includes:

- Branded ePaper on `epaper.theirdomain.com`
- Admin: upload PDF, pick date, publish (Main edition)
- Auto page images + mobile viewer (pinch/zoom, page list, previous/next date)
- Share link for the day’s paper
- SSL, basic SEO title per date, 1 training session, 7-day hypercare
- Privacy / contact pages

Out:

- News portal, reporter logins for articles, clip/crop tool, Tabloid edition, AdSense on portal

### Package B — News portal only

**When:** They want articles/categories like swarnasagaram.com, and will keep ePaper with Veda or skip it.  
**One-time:** **₹60,000 – ₹80,000** (open **₹70,000**)  
**Your hours:** ~75–95  
**Calendar:** 3–4.5 weeks  

Includes:

- WordPress + licensed news theme, Telugu UI
- Homepage: ticker, hero, category rows, popular, footer
- ~10 categories (not 32 empty theme leftovers)
- 5 reporter accounts + Editor + you as admin
- Search, article share (WhatsApp / Facebook), sitemap, AIOSEO-class SEO, Google Analytics / Site Kit
- Ad placeholders (header / in-article / sidebar) — they paste AdSense code
- Contact, About, Privacy
- Mobile-first QA, 1 training (reporters + editor), 14-day hypercare

Out:

- ePaper, crop-clips, AMP / Google News, custom live TV, native 6 languages

### Package C — Portal + ePaper (**recommend this**)

**When:** They said “like that newspaper site” — that site is **both**.  
**One-time:** **₹90,000 – ₹1,20,000** (open **₹1,05,000**; floor **₹85,000** if 50% advance + 6 months maintenance)  
**Your hours:** ~120–150  
**Calendar:** 5–7 weeks  

Everything in A + B, plus:

- Same branding, logo, colours on both
- Homepage button / menu → today’s ePaper
- ePaper sidebar “more news” pulling latest portal posts (as in the reference)
- Main + **one** extra edition (Tabloid *or* district) if they actually produce it
- 2 training sessions (portal + ePaper)
- 21-day hypercare
- Written SOP (Telugu + English): publish story, breaking, ePaper upload, correction

Out of C (sell as add-ons): story clip/crop from page, OneSignal, Google News / AMP, classifieds, video section, WhatsApp-to-CMS.

### Package D — Growth / digital newsroom

**When:** They talk ads revenue, YouTube, “news channel”, many reporters, Google News.  
**One-time:** **₹1,50,000 – ₹1,90,000** (open **₹1,65,000**)  
**Your hours:** ~170–210  
**Calendar:** 8–10 weeks  

Everything in C, plus:

- Clip/crop a rectangle from the ePaper page → download/share image (the reference “Generated Clip”)
- OneSignal (or equivalent) push
- Google News / News sitemap + basic AMP or fast mobile templates
- Ad slots documented + optional local “print ad card” pages
- Video / YouTube embed section
- Homepage drag-layout training for Editor (theme composer)
- Reporter style guide + 3 training sessions
- 30-day hypercare

Still out: custom mobile app, OTT live streaming, full classifieds marketplace, AI auto-writing.

### Add-ons (do not bury inside a cheap package)

| Add-on | Tentative | Notes |
|--------|-----------|--------|
| Extra ePaper edition (2nd/3rd) | ₹8,000 each | Tabloid + district, etc. |
| Clip / crop tool (if not in D) | ₹18,000 – ₹25,000 | Cropper.js class feature |
| Content migration from old WP | ₹8,000 – ₹20,000 | 390 posts is small; messy categories cost more |
| WhatsApp → draft post (manual ops) | ₹12,000 setup + retainer | Dangerous scope; prefer teaching WP |
| Native English edition (not translate widget) | ₹25,000+ | Second newsroom |
| Live YouTube / “channel” homepage | ₹15,000 – ₹30,000 | Player + schedule page, not a studio |
| Custom logo / masthead design | ₹5,000 – ₹12,000 | If they have none |

### What a customer quote should show (not hours)

1. Package name + one-time fee  
2. What they can do themselves (bullet list of admin tasks)  
3. Timeline  
4. Monthly care (pick one)  
5. Hosting as a **line item** or “included in care”  
6. Payment: **40% advance / 40% staging / 20% go-live**  
7. “Daily news is published by your staff in the admin panel. We do not type the paper.”

Do **not** put VPS vCPU maths on the customer PDF unless they ask.

---

## 5. Monthly maintenance

Without a retainer you will still get “site slow / AdSense / reporter forgot password” calls. Price the retainer as **the product after week 6**.

| Plan | Monthly | Your time | Includes | Does not include |
|------|---------|-----------|----------|------------------|
| **Care** | **₹2,499** | ~2 h | WP + plugin + PHP updates, SSL, uptime check, weekly backup, restore if needed | Design changes, new features, writing news |
| **Standard** (**default**) | **₹4,999** | ~4–5 h | Care + 2 small tickets (banner, new reporter, category, AdSense slot paste) | Homepage redesign, new modules |
| **Newsroom** | **₹8,999** | ~8–10 h | Standard + SEO hygiene, monthly report (visits, top stories), plugin conflict, 1 short training refresh / quarter | Daily publishing, unlimited redesign |
| **Content desk** | **₹15,000 – ₹25,000** | 20 h+ | They send WhatsApp; you or a hired editor publish | Avoid unless you want a staffing business |

**Hosting:** either

- Client pays VPS/domain (cleaner), **or**
- You bundle: Standard becomes **₹5,999 / mo** including a 4 GB VPS you operate.

**Contract:** 3-month minimum, then monthly. Pause publishing ≠ pause Care (server still needs patches).

**Change requests** after hypercare: ₹1,500 / hour or a fixed mini-SOW (e.g. “new district edition ₹8,000”).

Year-1 client cash (Package C + Standard + they pay VPS):

| Item | Amount |
|------|--------|
| Build (open) | ₹1,05,000 |
| Maintenance × 12 | ₹59,988 |
| VPS × 12 (their bill, ~₹700) | ~₹8,400 |
| Domain / email | ~₹1,500 |
| **Year 1 total (approx)** | **~₹1.75 lakh** |
| Year 2 (no rebuild) | ~₹70k |

Vs SaaS ₹20–35k/year: you are more expensive. Say it plainly: **they own the WordPress, the domain, the archive, the reporter logins; you are the local engineer, not a locked dashboard.**

---

## 6. VPS — minimum that will not embarrass you

Traffic is not the problem. **PDF conversion + WordPress + MySQL + image cache on one box** is.

### Do not sell

- 1 vCPU / 1 GB “cheap VPS” — WordPress + convert will OOM.  
- Shared ₹79/mo hosting if ePaper conversion runs there (timeouts, no ImageMagick, noisy neighbours).  
- Portal-only *can* live on Hostinger Business WordPress; **portal + ePaper should be a VPS**.

### Minimum (ePaper in scope) — **this is the floor**

| Resource | Minimum | Why |
|----------|---------|-----|
| vCPU | **2** | Ghostscript/ImageMagick while readers browse |
| RAM | **4 GB** | PHP-FPM + MariaDB + Redis + one PDF convert. 2 GB is a crash waiting for the first 8-page PDF. |
| Disk | **80 GB NVMe** | OS + WP + ~1 GB/month of editions (PDF + page JPEGs). 80 GB ≈ years of a small daily. |
| Transfer | **2 TB** | WhatsApp-shared images spike; still fine at this scale |
| OS | Ubuntu 24.04 LTS | |
| Location | **India** (Mumbai/Bangalore) | Telugu readers; Hostinger / DigitalOcean BLR / AWS Mumbai |

**Software on the box:** Nginx, PHP 8.2/8.3-FPM, MariaDB 10.11, Redis, ImageMagick, Ghostscript, Certbot, fail2ban, unattended-upgrades. Daily off-box backup (rclone to Drive/S3/B2). Swap 2 GB as safety, not as a plan.

**Comfortable (recommended to actually buy):** **2 vCPU / 8 GB / 100 GB** — Hostinger KVM 2 class, often **~₹499–799 / month**. Extra RAM means WP admin + convert + backup dump do not fight.

**If they add video files on the server or become a real channel:** 4 vCPU / 8 GB / 160 GB, and put video on YouTube anyway.

### Portal-only (Package B) exception

Hostinger Cloud / Business WordPress (~2–3 GB RAM) can work if there is **no** PDF conversion. Still prefer 2 vCPU / 4 GB so the premium news theme + page builder does not swap.

### Your cost vs their cost

| | You pay (approx) | Charge them |
|--|------------------|-------------|
| 2 vCPU / 4–8 GB India VPS | ₹400–800 / mo | ₹700–1,200 / mo if resold, or pass-through |
| Domain .com | ₹800–1,400 / yr | At cost |
| Theme license | $59–79 one-time | Inside build fee |
| Backups (B2/S3) | ₹50–150 / mo | Inside Care |

Do not hide a loss-making ₹99 hosting inside a ₹2,499 Care plan.

---

## 7. Effort plan (your calendar, Package C)

| Week | Work |
|------|------|
| 0 | Discovery call (questions in §10). Collect logo, colours, 10 categories, reporter list, sample PDF, domain DNS access. 40% invoice. |
| 1 | VPS + WP + theme + Telugu + staging URL. |
| 2 | Homepage layout, menus, ads slots, SEO plugin, sample 8–10 posts. |
| 3 | ePaper plugin: upload, convert, date URL, archive calendar. |
| 4 | Cross-links, mobile QA, reporter roles, Telugu SOP. |
| 5 | Training (office or Meet), fixes, 40% staging invoice. |
| 6 | DNS cutover, SSL, 20% go-live, hypercare starts. |

First-time slip risk: **theme Composer learning** and **PDF DPI / Telugu sharpness**. Pad week 3–4; do not promise 10 days.

---

## 8. What good looks like vs the reference

Copy the **job**, not the bugs.

| Keep / match | Improve |
|--------------|---------|
| Telugu-first masthead, date, district flavour | Empty categories, “Sign in / Join” clutter |
| ePaper date in the URL | Broken breaking-news “Loading News…” |
| Reporter bylines | Google-translate 6-language footer (unless they insist) |
| Ad slots + WhatsApp share | WhatsApp-compressed photos as featured images (teach them to upload originals) |
| Main + tabloid if they print both | Lifetime hit-counter as “analytics” |
| Mobile page view of the paper | Forcing desktop flipbook on phones |

---

## 9. Risks (first newspaper job)

1. **Scope = “make it like Eenadu”** after seeing a theme demo. Freeze homepage sections in writing.  
2. **They expect you to publish.** Put it in the SOW twice.  
3. **PDF quality.** Press PDFs can be 50–150 MB. Cap upload (e.g. 25 MB) and agree they export a web PDF (~3–8 MB, like the reference’s 2.9 MB).  
4. **Theme lock-in.** tagDiv Newspaper is powerful and heavy. Budget updates in Care.  
5. **Price war with Veda.** If they only want SaaS price, do not take the job — or sell Package A at ₹45k once, no custom art.  
6. **Legal.** You host their political copy; they are the publisher (RNI / editor of record). Your contract: they own content and liability; you own custom code license as specified (recommend: they get a WP site they own; you can reuse the ePaper plugin).

---

## 10. Questions to lock the quote (ask next)

Do not send a final PDF until these are answered. Short list:

1. Is this a **new paper** or a **rebuild / replacement** of an existing site? Any content to migrate?  
2. Do they need **portal + ePaper**, or only the ePaper they linked?  
3. How many **print pages** per day? Main only, or tabloid / district editions? Typical PDF size?  
4. How many **reporters** need logins? Does the editor want to **approve** before publish?  
5. Telugu only, or real English (not a translate widget)?  
6. Will they use **Google AdSense**, local banners, or both?  
7. Domain already in their name? Who has GoDaddy/Hostinger/DNS?  
8. Do they want the **clip/crop** tool from the reference?  
9. Video / YouTube / “news channel” live?  
10. Who will upload the ePaper at 5 a.m. — office staff or the editor?  
11. Budget band: under ₹50k / ₹50–80k / ₹80k–1.2L / 1.5L+ ?  
12. Can they pay **monthly care**, or do they want “build and forget”? (Forget still needs Care.)

---

## 11. Recommended open (until they answer §10)

Assume they want “a site like Swarna Sagaram” (both properties), local AP paper, first-time you:

| Line | Number |
|------|--------|
| **Package C** one-time | **₹1,05,000** |
| Discount floor | ₹85,000 |
| **Standard** maintenance | **₹4,999 / mo** (3-month min) |
| VPS they should buy | **2 vCPU / 4 GB min, 8 GB preferred, 80 GB NVMe, India** |
| Timeline | **6 weeks** staging, week 7 live |
| Payment | 40 / 40 / 20 |

If they only talk about the ePaper URL and freeze at price: **Package A ₹45,000** + Care ₹2,499 + upsell portal in 90 days.

If they say “news channel” and mean YouTube + ticker + live: start at **Package D**, do not gift it inside C.

---

## 12. FAQ (from first review)

### What is a CMS? (often heard as “CSM”)

**CMS = Content Management System.** It is the **admin panel** where staff log in and publish — not the public website visitors see.

Without a CMS, every story means you edit code and redeploy. With a CMS, a reporter pastes Telugu text, uploads a photo, clicks Publish. WordPress is a CMS. Sanity, Strapi, Payload, Wagtail are also CMSs. The public site can be WordPress PHP pages *or* a Next.js site that *talks to* a CMS.

The quote said CMS throughout. If you saw “CSM”, that is this.

### Why buy a news theme? Can’t Cursor build the site?

Cursor **can** build every pixel. A theme is not a capability limit; it is a **time and risk** choice.

A newspaper homepage is many templates: ticker, hero, category rows, article page, author page, search, 404, mobile menu, ads slots, pagination, related posts, breadcrumbs. tagDiv Newspaper (what Swarna Sagaram uses) already has those. License is about **$60–80**. You still use Cursor to:

- restyle colours/logo/Telugu fonts
- write the **ePaper plugin** (that part is custom either way)
- strip unused sections, set roles, wire ads

Building the same UI from zero in Cursor is roughly **Package B hours becoming Package D hours** before ePaper exists — and you must still invent an admin (see below). For a ~₹1 lakh local-paper job, buy the layout, customize in Cursor. If you later productize “newspaper SaaS for 10 papers”, then invest in a custom design system.

### Why WordPress? Are there modern frameworks?

Yes. Common modern options:

| Stack | Public site | Admin (CMS) | Fit for this client |
|-------|-------------|-------------|---------------------|
| **WordPress + news theme** | PHP templates | Built-in (roles, Telugu, media) | **Best for first local paper** |
| Next.js + **Payload** / Strapi | React/Node | You host the admin | Good if you want a reusable product; quote like D |
| Next.js + **Sanity** | React | Hosted CMS (monthly $) | Clean; extra SaaS bill for the client |
| **Wagtail** (Django) | Python | Excellent CMS | Strong, but you would be learning Django + newsroom |
| **Ghost** | Node | Built-in | Blog-shaped, weak for Indian category news + ePaper |
| **Laravel** + Filament | PHP, more “app-like” | You build the news UI | Modern PHP; still more work than WP |

WordPress is suggested because **the non-negotiable feature is “8 Telugu reporters publish without you.”** WP ships that on day one. A “modern” Next.js site **still needs a CMS**. Skipping WordPress does not skip the admin; it means you **build or pay for one**.

Use Next.js/Payload if: you want this as *your* product, the client pays D-level money, and you accept a longer first build. Do not pick Next.js only because it feels more impressive on a quote.

### Is another language better than PHP?

**Not for this job.** Language is your comfort; the paper cares about Telugu publish + uptime.

- The reference already runs **PHP 8.3**. PHP is not obsolete here.
- WordPress **is** PHP. Choosing WP means PHP (plus JS in the browser for the ePaper viewer).
- If you go **custom**, **TypeScript / Node (Next.js)** is the better language *for you* — you already live in Cursor, and the ePaper viewer (PDF.js, Cropper) is JavaScript anyway. Python is not “better”; it only wins if you specifically want Wagtail.
- Mixing “Next.js frontend + WordPress as CMS” is possible and usually **worse** (two systems to host and debug) unless you have a clear reason.

**Rule:** pick the stack that includes a reporter admin you will not have to babysit. For a first Andhra newspaper at Package C money, that is WordPress. For a product you will resell, that is Next.js + Payload, priced as D.

---

## 13. File map

```
newspaper-site/
  INTERNAL_QUOTE_PACKAGES.md    ← this file (internal)
```

Customer one-pager / GST quote: create **after** §10 answers, not from this draft.

---

## 14. Changelog

| Date | Change |
|------|--------|
| 2026-08-15 | First draft from live review of swarnasagaram.com + epaper.swarnasagaram.com: WP Newspaper theme, Veda PHP ePaper, 390 posts, 8 authors, ~2.9 MB PDF, ~23k lifetime ePaper counter. Four packages, admin model, maintenance, VPS floor 2 vCPU / 4 GB. |
| 2026-08-15 | FAQ: CMS vs “CSM”, why a paid news theme vs Cursor-from-scratch, A–D feature matrix, WordPress vs Next.js/Payload/Wagtail, PHP vs TypeScript. |
