# Amma Chethi Ruchulu — website

Astro 4 site for brand landing + privacy policy (Meta / WhatsApp readiness).

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

## Deploy

**Full guide:** [DEPLOY.md](./DEPLOY.md)

- **Vercel (recommended):** import GitHub repo → Root Directory = `website` → Deploy  
- **GitHub Pages:** set `base` in `astro.config.mjs` if needed → use `.github/workflows/deploy-pages.yml`

## Customize

Edit `src/site.config.ts` (WhatsApp, email, locality).
