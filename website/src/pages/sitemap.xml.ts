import type { APIRoute } from 'astro';
import { areas } from '../data/areas';
import { topics } from '../data/topics';
import { absoluteUrl } from '../site.config';

const staticPaths = [
  '/',
  '/about/',
  '/contact/',
  '/privacy/',
  '/terms/',
  '/topics/',
  '/areas/',
];

function urlEntry(path: string, changefreq: string, priority: string) {
  return `  <url>
    <loc>${absoluteUrl(path)}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

export const GET: APIRoute = () => {
  const urls = [
    ...staticPaths.map((p) => urlEntry(p, p === '/' ? 'weekly' : 'monthly', p === '/' ? '1.0' : '0.8')),
    ...topics.map((t) => urlEntry(`/topics/${t.slug}/`, 'weekly', '0.7')),
    ...areas.map((a) => urlEntry(`/areas/${a.slug}/`, 'weekly', '0.7')),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
