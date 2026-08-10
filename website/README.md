# Amma Chethi Ruchulu — website

Astro 4 MPA for brand + **pSEO** (topics/areas), trust pages, schema, sitemap — aligned with `local-biz-dev` SEO rules.

Canonical domain: `https://ammachethiruchulu.co.in`

## Develop

```bash
cd website
npm install
npm run dev
```

Open http://localhost:4321

## Build

```bash
npm run build
npm run preview
```

Build emits `/sitemap.xml` (from `src/pages/sitemap.xml.ts`) + `public/robots.txt`.

## SEO / pSEO

| Piece | Where |
|-------|--------|
| Keyword sheet | [`SEO-KEYWORDS.md`](./SEO-KEYWORDS.md) |
| **SEO launch checklist (GSC, GBP, Bing, GA4…)** | [`SEO-LAUNCH-CHECKLIST.md`](./SEO-LAUNCH-CHECKLIST.md) |
| Topic pages | `src/data/topics.ts` → `/topics/[slug]/` |
| Area pages | `src/data/areas.ts` → `/areas/[slug]/` |
| FAQs | `src/data/faqs.ts` |
| Schema helpers | `src/lib/schema.ts` |
| Sitemap | `src/pages/sitemap.xml.ts` |
| Site + GA4 id | `src/site.config.ts` |

After deploy: follow [`SEO-LAUNCH-CHECKLIST.md`](./SEO-LAUNCH-CHECKLIST.md) — Google Search Console domain property → submit sitemap → Request indexing + Google Business Profile.

## Deploy

**Full guide:** [DEPLOY.md](./DEPLOY.md)

- **Vercel (recommended):** Root Directory = `website` · custom domain `ammachethiruchulu.co.in`
- Preview host `*.vercel.app` is **noindex** via `vercel.json`

## Customize

Edit `src/site.config.ts` (WhatsApp, email, locality, optional `ga4Id`).  
Add keywords as new rows in `topics.ts` / `areas.ts` with unique copy — do not duplicate fluff.