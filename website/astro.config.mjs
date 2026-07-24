import { defineConfig } from 'astro/config';

// Vercel (recommended): keep base: '/'
// GitHub Pages project site: set site + base, e.g.
//   site: 'https://YOUR_USERNAME.github.io',
//   base: '/YOUR_REPO_NAME/',
// See website/DEPLOY.md
export default defineConfig({
  site: 'https://amma-chethi-ruchulu.vercel.app',
  base: '/',
  trailingSlash: 'ignore',
});
