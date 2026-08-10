# SEO Launch Checklist — Amma Chethi Ruchulu

**Domain:** https://ammachethiruchulu.co.in  
**Market:** Tenali only (including town localities)  
**Site status:** pSEO pages, schema, sitemap, robots — live  
**Related:** [`SEO-KEYWORDS.md`](./SEO-KEYWORDS.md) · [`DEPLOY.md`](./DEPLOY.md)

Use this as the working checklist. Tick items as you finish them.  
**Do now:** Sections A + B (Google Search Console + Google Business Profile).

---

## Progress overview

| Phase | Focus | Status |
|-------|--------|--------|
| Done | Site + pSEO + Tenali areas | Done |
| **A** | Google Search Console | **Do next** |
| **B** | Google Business Profile | **Do next** |
| C | Bing Webmaster | After A |
| D | GA4 analytics | After A |
| E | Ongoing local SEO (reviews, posts) | This month |
| F | Content / pSEO expansion | As needed |
| G | Later / optional | Only when ready |

---

## Already done (site)

- [x] MPA Astro site on custom domain
- [x] On-page SEO (titles, meta, OG, ~600w home copy)
- [x] FAQ + `FAQPage` JSON-LD
- [x] `FoodEstablishment` / LocalBusiness-style schema
- [x] Trust pages: About, Contact, Privacy, Terms
- [x] `robots.txt` + `/sitemap.xml`
- [x] pSEO topic pages (Tenali intents)
- [x] Area pages: `/areas/tenali/` hub + Tenali town localities
- [x] Preview host `*.vercel.app` noindex
- [x] Old Guntur URLs 301 → Tenali equivalents

---

## A — Google Search Console (do next)

**Goal:** Prove you own the domain, submit the sitemap, ask Google to index money pages.

### A1. Open Search Console
- [ ] Go to [Google Search Console](https://search.google.com/search-console/about)
- [ ] Sign in with the Google account you want as owner (prefer business Gmail: `order.ammachethiruchulu@gmail.com` or your main admin)

### A2. Add a Domain property (preferred)
- [ ] Click **Add property**
- [ ] Choose **Domain** (not “URL prefix”)
- [ ] Enter exactly: `ammachethiruchulu.co.in`  
  - No `https://`  
  - No `www`  
  - No trailing slash
- [ ] Click **Continue**

### A3. Verify ownership via DNS TXT
Google will show a **TXT record** to add at your DNS host (wherever `ammachethiruchulu.co.in` nameservers point — often Cloudflare, GoDaddy, BigRock, Hostinger, or Vercel DNS).

- [ ] Copy the TXT name/host and value Google shows (often host `@` or the bare domain)
- [ ] In DNS provider → **Add record**:
  - Type: `TXT`
  - Name/Host: `@` (or as Google instructs)
  - Value: the long `google-site-verification=...` string
  - TTL: default / auto
- [ ] Save the DNS record
- [ ] Wait 1–15 minutes (sometimes up to a few hours)
- [ ] Back in Search Console → **Verify**
- [ ] If it fails: wait longer, confirm no typos, confirm you edited the DNS for the same domain that serves the site

**Tip:** Keep the TXT record forever (do not delete after verify).

### A4. Submit sitemap
- [ ] In the property → left menu **Sitemaps**
- [ ] Under “Add a new sitemap”, enter: `sitemap.xml`
- [ ] Submit
- [ ] Confirm status becomes **Success** (may take minutes–hours; “Couldn’t fetch” often self-heals — refresh later)
- [ ] Spot-check live URL: https://ammachethiruchulu.co.in/sitemap.xml
- [ ] Spot-check robots: https://ammachethiruchulu.co.in/robots.txt (must list the sitemap)

### A5. Request indexing (priority URLs)
Use **URL Inspection** (top search bar in GSC) → paste URL → **Request indexing** for:

- [ ] `https://ammachethiruchulu.co.in/`
- [ ] `https://ammachethiruchulu.co.in/topics/`
- [ ] `https://ammachethiruchulu.co.in/areas/`
- [ ] `https://ammachethiruchulu.co.in/areas/tenali/`
- [ ] `https://ammachethiruchulu.co.in/topics/home-cooked-food-delivery-tenali/`
- [ ] `https://ammachethiruchulu.co.in/topics/homemade-lunch-delivery-tenali/`
- [ ] `https://ammachethiruchulu.co.in/topics/whatsapp-food-order-tenali/`
- [ ] `https://ammachethiruchulu.co.in/contact/`

Do a few per day if Google rate-limits requests. More pages will come via the sitemap over time.

### A6. Sanity checks after 2–7 days
- [ ] **Pages** report shows discovered/indexed URLs climbing
- [ ] No major “Excluded by ‘noindex’” on the custom domain
- [ ] `*.vercel.app` stays out of index (or noindex) — expected

### A7. Expectation
- [ ] Understood: meaningful rankings often take **~4–6 months**; GSC data can lag 1–3 days

**Exit criteria for A:** Domain verified + sitemap Success + home/Tenali URLs requested.

---

## B — Google Business Profile (do next)

**Goal:** Show up on Google Maps / local pack for Tenali searches. Match website NAP (name, phone, area).

### B1. Create or claim the profile
- [ ] Go to [Google Business Profile](https://business.google.com/) (or Google Maps → “Add your business”)
- [ ] Sign in with the same Google account used for GSC if possible
- [ ] Create business: **Amma Chethi Ruchulu** (exact brand spelling)

### B2. Category & service model
Pick categories that fit home-cooked / meal delivery (examples — choose the closest accurate ones):
- [ ] Primary category set (e.g. Meal delivery, Home goods store is wrong — prefer food-related: **Meal delivery** / **Caterer** / **Restaurant** only if accurate)
- [ ] Secondary categories only if true
- [ ] Delivery / takeaway attributes set honestly (you are order-ahead WhatsApp delivery in Tenali)

### B3. Location & service area (Tenali only)
You can use a storefront address **or** service-area business. Your Udyam/site address is Chenchupeta, Tenali.

- [ ] Address entered consistently with site/Udyam where required:  
  `11-4-89, Donka Road, Chenchupeta, Tenali, Andhra Pradesh 522202`
- [ ] **Service area = Tenali** (town). Do **not** add Guntur city or other towns
- [ ] If asked for service-area-only (no storefront public map pin), choose what matches how customers find you — still keep Tenali only

### B4. Contact & links (must match website)
- [ ] Phone: `+91 98235 83498` (same as WhatsApp business number)
- [ ] Website: `https://ammachethiruchulu.co.in/`
- [ ] Optional: WhatsApp / appointment link → WhatsApp order link from site
- [ ] Email: `order.ammachethiruchulu@gmail.com`

### B5. Hours / description
- [ ] Hours reflect order/serve reality (or mark as hours you accept orders). Example intent:
  - Lunch ordering window mornings; dinner afternoon — or list kitchen/delivery windows clearly in description
- [ ] Business description: Andhra home-cooked lunch & dinner in **Tenali**, order on WhatsApp before cutoff, specialist home cooks
- [ ] Do not claim Guntur delivery

### B6. Photos
- [ ] Logo / profile photo
- [ ] Cover photo
- [ ] Food photos (real dishes)
- [ ] Packing / delivery (if available)
- [ ] Kitchen/process only if you are comfortable sharing

### B7. Verification
- [ ] Complete Google’s verification (postcard, phone, email, or video — whatever Google offers)
- [ ] Keep confirmation code/record until verified
- [ ] Profile status shows **Verified**

### B8. Post-verify setup
- [ ] Products or services listed (Lunch delivery, Dinner delivery, Vegetarian meals, etc.)
- [ ] Messaging enabled if useful (or push WhatsApp in description)
- [ ] First GBP post published (today’s menu / how to order)

**Exit criteria for B:** Verified GBP · Tenali-only area · phone + website match site.

---

## C — Bing Webmaster (after A)

- [ ] Open [Bing Webmaster Tools](https://www.bing.com/webmasters/about)
- [ ] Sign in → **Import from Google Search Console**
- [ ] Confirm `ammachethiruchulu.co.in` imported
- [ ] Submit sitemap if not auto-imported: `https://ammachethiruchulu.co.in/sitemap.xml`
- [ ] Optional: Submit URL for home + `/areas/tenali/`

---

## D — Google Analytics 4 (after A)

- [ ] Create GA4 property at [analytics.google.com](https://analytics.google.com)
- [ ] Copy Measurement ID (`G-XXXXXXXX`)
- [ ] Set `ga4Id` in [`src/site.config.ts`](./src/site.config.ts)
- [ ] Commit + deploy website
- [ ] In GA4 → Admin → Data streams → **Test** / Realtime: load the live site and confirm hits
- [ ] Link GA4 ↔ Search Console (GA Admin → Product links) for query reporting

---

## E — Ongoing local SEO (this month)

- [ ] Ask every happy Tenali customer for a **GBP review** (WhatsApp follow-up after delivery)
- [ ] Reply to every review (short, polite, brand name)
- [ ] GBP posts **1–2× per week** (menu, cutoff reminder, veg special)
- [ ] Weekly GSC check: **Performance** → top queries / pages
- [ ] Fix or deepen pages that get impressions but low clicks (title/meta/CTA)
- [ ] Keep NAP consistent everywhere (site, GBP, WhatsApp, Udyam, Meta)

---

## F — Content / pSEO expansion (as needed)

- [ ] Add new **Tenali** topic/dish pages only from [`SEO-KEYWORDS.md`](./SEO-KEYWORDS.md) backlog
- [ ] Unique copy per URL (no spun duplicates)
- [ ] Update sitemap automatically via build; redeploy
- [ ] Request indexing on new money pages in GSC
- [ ] Add new area pages **only** for localities you actually deliver

---

## G — Later / optional

- [ ] Telugu paths `/te/...` (separate URLs per language)
- [ ] Google Indexing API for new page publish pings
- [ ] Local citations (Justdial etc.) only if NAP is exact
- [ ] Expand outside Tenali **only when delivery actually expands** — then update site + GBP together

---

## Quick reference — live URLs

| Item | URL |
|------|-----|
| Home | https://ammachethiruchulu.co.in/ |
| Sitemap | https://ammachethiruchulu.co.in/sitemap.xml |
| Robots | https://ammachethiruchulu.co.in/robots.txt |
| Topics | https://ammachethiruchulu.co.in/topics/ |
| Areas hub | https://ammachethiruchulu.co.in/areas/ |
| Tenali main area | https://ammachethiruchulu.co.in/areas/tenali/ |
| Privacy | https://ammachethiruchulu.co.in/privacy/ |
| Contact | https://ammachethiruchulu.co.in/contact/ |

| Business facts for GBP / GSC |
|------|
| Name | Amma Chethi Ruchulu |
| Phone | +91 98235 83498 |
| Email | order.ammachethiruchulu@gmail.com |
| Address | 11-4-89, Donka Road, Chenchupeta, Tenali, Andhra Pradesh 522202 |
| Service area | Tenali town only |

---

## Session log

| Date | Done | Notes |
|------|------|-------|
| 2026-08-10 | Site pSEO + Tenali areas live | Ready for GSC + GBP |
| | | |
