/** Site content — edit these before Meta / go-live / SEO batches */
export const site = {
  nameEn: 'Amma Chethi Ruchulu',
  nameTe: 'అమ్మ చేతి రుచులు',
  tagline: 'Authentic Home Cooked Flavors',
  blurb:
    'Signature dishes from specialist home cooks in Tenali — ordered ahead, packed with care, delivered fresh.',
  /** Canonical public domain (use for sitemap, OG, JSON-LD) */
  domain: 'https://ammachethiruchulu.co.in',
  /** Shown on website (public) — delivery city only */
  locality: 'Tenali, Andhra Pradesh',
  region: 'AP',
  country: 'IN',
  /** Full postal address — Udyam / Meta / FSSAI / GBP; district name is administrative only */
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
  defaultTitle: 'Amma Chethi Ruchulu — Home Cooked Food Delivery in Tenali',
  defaultDescription:
    'Order authentic Andhra home-cooked lunch and dinner in Tenali. Specialist home cooks, scheduled delivery via WhatsApp. Order before cutoff.',
  ogImage: '/logo.jpeg',
  /** Optional GA4 measurement ID — leave empty until property is ready */
  ga4Id: '',
} as const;

/** Sister produce service — same business as {site.nameEn} (Udyam verified) */
export const acrFresh = {
  brand: 'ACR Fresh',
  tagline: 'Fresh vegetables by Amma Chethi Ruchulu',
  blurb:
    'South Indian vegetables in quarter-kg to 1 kg packs, plus milk, staples, and kitchen essentials — delivered in hourly slots across Tenali.',
  whatsapp: '919392044833',
  whatsappDisplay: '+91 93920 44833',
  minOrder: '₹100',
  delivery: 'Hourly delivery slots (8 AM–8 PM IST)',
  path: '/acr-fresh/',
} as const;

export function waLink(text = 'Hi'): string {
  return `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(text)}`;
}

export function acrFreshWaLink(text = 'Hi'): string {
  return `https://wa.me/${acrFresh.whatsapp}?text=${encodeURIComponent(text)}`;
}

export function absoluteUrl(path = '/'): string {
  const base = site.domain.replace(/\/$/, '');
  if (!path || path === '/') return `${base}/`;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
