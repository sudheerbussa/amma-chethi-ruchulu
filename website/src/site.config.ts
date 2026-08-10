/** Site content — edit these before Meta / go-live / SEO batches */
export const site = {
  nameEn: 'Amma Chethi Ruchulu',
  nameTe: 'అమ్మ చేతి రుచులు',
  tagline: 'Authentic Home Cooked Flavors',
  blurb:
    'Signature dishes from specialist home cooks in your town — ordered ahead, packed with care, delivered fresh.',
  /** Canonical public domain (use for sitemap, OG, JSON-LD) */
  domain: 'https://ammachethiruchulu.co.in',
  /** Shown on website (public) — city / district level only */
  locality: 'Guntur, Andhra Pradesh',
  region: 'AP',
  country: 'IN',
  /** Full postal address — Udyam / Meta / FSSAI / GBP; keep off marketing hero if preferred */
  address: '11-4-89, Donka Road, Chenchupeta, Tenali, Guntur, Andhra Pradesh — 522202',
  streetAddress: '11-4-89, Donka Road, Chenchupeta',
  addressLocality: 'Tenali',
  addressRegion: 'Andhra Pradesh',
  postalCode: '522202',
  /** WhatsApp Cloud API business number */
  whatsapp: '919823583498',
  whatsappDisplay: '+91 98235 83498',
  /** Business inbox (finalized) */
  email: 'order.ammachethiruchulu@gmail.com',
  cutoffs: {
    lunch: 'Order by 10:00 AM (serve 12–3 PM)',
    dinner: 'Order by 4:00 PM (serve 7–10 PM)',
  },
  /** Default SEO strings */
  defaultTitle: 'Amma Chethi Ruchulu — Home Cooked Food Delivery in Guntur & Tenali',
  defaultDescription:
    'Order authentic Andhra home-cooked lunch and dinner in Guntur and Tenali. Specialist home cooks, scheduled delivery via WhatsApp. Order before cutoff.',
  ogImage: '/logo.jpeg',
  /** Optional GA4 measurement ID — leave empty until property is ready */
  ga4Id: '',
} as const;

export function waLink(text = 'Hi'): string {
  return `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(text)}`;
}

export function absoluteUrl(path = '/'): string {
  const base = site.domain.replace(/\/$/, '');
  if (!path || path === '/') return `${base}/`;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
