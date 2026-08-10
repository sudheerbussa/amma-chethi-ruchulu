import { defineConfig } from 'astro/config';

// Canonical SEO domain. Preview hosts (*.vercel.app) should stay noindex via vercel.json.
export default defineConfig({
  site: 'https://ammachethiruchulu.co.in',
  base: '/',
  trailingSlash: 'always',
});
