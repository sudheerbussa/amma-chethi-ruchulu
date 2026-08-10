import { absoluteUrl, site, waLink } from '../site.config';
import type { FaqItem } from '../data/faqs';

export function localBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FoodEstablishment',
    '@id': `${absoluteUrl('/')}#business`,
    name: site.nameEn,
    alternateName: site.nameTe,
    description: site.defaultDescription,
    url: absoluteUrl('/'),
    image: absoluteUrl(site.ogImage),
    telephone: site.whatsappDisplay,
    email: site.email,
    servesCuisine: ['Andhra', 'South Indian', 'Home cooking'],
    priceRange: '₹₹',
    address: {
      '@type': 'PostalAddress',
      streetAddress: site.streetAddress,
      addressLocality: site.addressLocality,
      addressRegion: site.addressRegion,
      postalCode: site.postalCode,
      addressCountry: site.country,
    },
    areaServed: [{ '@type': 'City', name: 'Tenali' }],
    sameAs: [waLink('Hi')],
    potentialAction: {
      '@type': 'OrderAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: waLink("Hi, I want today's menu"),
        actionPlatform: [
          'http://schema.org/DesktopWebPlatform',
          'http://schema.org/MobileWebPlatform',
        ],
      },
      deliveryMethod: 'http://purl.org/goodrelations/v1#DeliveryModeOwnFleet',
    },
  };
}

export function faqPageSchema(faqs: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer,
      },
    })),
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function webPageServiceSchema(opts: {
  name: string;
  description: string;
  path: string;
  areaName?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: opts.name,
    description: opts.description,
    url: absoluteUrl(opts.path),
    provider: { '@id': `${absoluteUrl('/')}#business` },
    areaServed: {
      '@type': 'Place',
      name: opts.areaName ?? 'Tenali',
    },
    offers: {
      '@type': 'Offer',
      availability: 'https://schema.org/InStock',
      url: waLink('Menu please'),
    },
  };
}
