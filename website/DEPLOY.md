# Deploy Amma Chethi Ruchulu website

**Recommendation for you:** use **Vercel** first (simplest HTTPS URL for Meta).  
GitHub Pages works too; needs a GitHub repo and a small config tweak.

Your site lives in the `website/` folder. There is **no git repo yet** in `business_proposal` — you’ll create one (or push only `website/`) as part of deploy.

---

## Option A — Vercel (recommended)

### A1. Put the code on GitHub

1. Create a new GitHub repo (e.g. `amma-chethi-ruchulu` or `business_proposal`).
2. From your machine:

```bash
cd ~/SudhirLaptop_Backup/business_proposal
git init
# optional: add a .gitignore at repo root that ignores website/node_modules and website/dist
git add .
git commit -m "Add Amma Chethi Ruchulu Astro site and business plans"
```

3. Create the empty repo on GitHub, then:

```bash
git remote add origin https://github.com/<YOUR_USERNAME>/<REPO_NAME>.git
git branch -M main
git push -u origin main
```

### A2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → Sign up with **GitHub**.
2. **Add New Project** → import your repo.
3. Settings:
   - **Root Directory:** `website` (Important — click Edit)
   - **Framework Preset:** Astro
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Click **Deploy**.
5. Copy the URL, e.g. `https://amma-chethi-ruchulu.vercel.app`

### A3. Use for Meta

| Field | URL |
|-------|-----|
| Website | `https://….vercel.app` |
| Privacy | `https://….vercel.app/privacy` |

Later you can add a custom domain (e.g. `ammachethiruchulu.in`) in Vercel → Domains.

---

## Option B — GitHub Pages

### B1. Decide the URL shape

| Style | URL | `base` in Astro |
|-------|-----|-----------------|
| **Project site** (common) | `https://USERNAME.github.io/REPO/` | `base: '/REPO/'` |
| **User site** | `https://USERNAME.github.io/` | `base: '/'` (repo must be named `USERNAME.github.io`) |

### B2. Configure Astro for a project site

Edit `website/astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://YOUR_USERNAME.github.io',
  base: '/YOUR_REPO_NAME/',  // e.g. '/business_proposal/'
});
```

Keep `base: '/'` if you use Vercel **or** a `USERNAME.github.io` user site.

### B3. Enable Pages with Actions

1. Push the repo (same as A1).
2. Workflow file is ready at: `.github/workflows/deploy-pages.yml`
3. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**
4. Push to `main` → Actions runs → site goes live in a few minutes.

### B4. Meta URLs (project site example)

| Field | URL |
|-------|-----|
| Website | `https://USERNAME.github.io/REPO/` |
| Privacy | `https://USERNAME.github.io/REPO/privacy/` |

---

## Quick compare

| | Vercel | GitHub Pages |
|--|--------|--------------|
| Setup | Easiest | Needs `base` for project sites |
| HTTPS | Automatic | Automatic |
| Custom domain | Easy | Easy |
| Best for Meta now | **Yes** | Yes, after config |

---

## After deploy — checklist

- [ ] Open live home + `/privacy/` in a phone browser  
- [ ] Test WhatsApp button  
- [ ] Put both URLs in `CHRONOLOGICAL_CHECKLIST.md` Brand pack  
- [ ] Use same URLs in Meta Business Manager  
- [ ] Point custom domain **ammachethiruchulu.co.in** (and www → apex or vice versa)  
- [ ] Confirm `robots.txt` lists sitemap; open `/sitemap.xml`  
- [ ] Google Search Console: Domain property → submit sitemap → Request indexing  
- [ ] Bing Webmaster: import from GSC  
- [ ] Set `ga4Id` in `src/site.config.ts` once GA4 is ready  
- [ ] Google Business Profile linked to the same domain + phone  

---

## Local check before deploy

```bash
cd website
npm run build
npm run preview
```
