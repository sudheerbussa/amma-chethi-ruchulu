export type Area = {
  slug: string;
  name: string;
  keyword: string;
  title: string;
  metaDescription: string;
  h1: string;
  intro: string;
  sections: { heading: string; body: string }[];
  relatedTopicSlugs: string[];
  nearbySlugs: string[];
};

/**
 * Area pages — Tenali delivery only (including Chenchupeta).
 * Do not add localities outside the live delivery radius.
 */
export const areas: Area[] = [
  {
    slug: 'tenali',
    name: 'Tenali',
    keyword: 'home cooked food delivery Tenali',
    title: 'Home Cooked Food Delivery in Tenali | Amma Chethi Ruchulu',
    metaDescription:
      'Home cooked food delivery in Tenali. Lunch & dinner via WhatsApp from Amma Chethi Ruchulu — including Chenchupeta.',
    h1: 'Delivering home cooked food in Tenali',
    intro:
      'Amma Chethi Ruchulu delivers scheduled home-cooked lunch and dinner in Tenali. Order on WhatsApp before cutoff and we confirm whether your neighbourhood is on today’s route.',
    sections: [
      {
        heading: 'Tenali-first operations',
        body:
          'Our packing hub and cook partners sit in the Tenali ecosystem. That proximity helps us keep batches tight and delivery windows realistic for local addresses.',
      },
      {
        heading: 'How to check your street',
        body:
          'Send your area, landmark, or pin code on WhatsApp. If we can deliver that slot, we confirm before you pay.',
      },
    ],
    relatedTopicSlugs: [
      'homemade-lunch-delivery-tenali',
      'home-kitchen-food-tenali',
      'whatsapp-food-order-tenali',
    ],
    nearbySlugs: ['chenchupeta'],
  },
  {
    slug: 'chenchupeta',
    name: 'Chenchupeta',
    keyword: 'food delivery Chenchupeta Tenali',
    title: 'Home Food Delivery in Chenchupeta, Tenali | Amma Chethi Ruchulu',
    metaDescription:
      'Order home cooked lunch & dinner delivery in Chenchupeta, Tenali on WhatsApp. Amma Chethi Ruchulu — order before cutoff.',
    h1: 'Home food delivery in Chenchupeta',
    intro:
      'Chenchupeta residents can order Amma Chethi Ruchulu meals on WhatsApp for lunch or dinner. We are rooted in this Tenali locality and plan routes with local drop-offs in mind.',
    sections: [
      {
        heading: 'Local landmark ordering',
        body:
          'Share a clear Chenchupeta landmark or society name when you order. Accurate pins help riders finish the scheduled window without calling repeatedly.',
      },
      {
        heading: 'Same cutoffs as the rest of Tenali',
        body:
          'Lunch by 10:00 AM and dinner by 4:00 PM still apply. Early orders keep packing calm even for nearby Chenchupeta drops.',
      },
    ],
    relatedTopicSlugs: [
      'home-kitchen-food-tenali',
      'homemade-lunch-delivery-tenali',
      'scheduled-meal-delivery-tenali',
    ],
    nearbySlugs: ['tenali'],
  },
];

export function getArea(slug: string): Area | undefined {
  return areas.find((a) => a.slug === slug);
}

export function getAreasBySlugs(slugs: string[]): Area[] {
  return slugs.map((s) => getArea(s)).filter((a): a is Area => Boolean(a));
}
