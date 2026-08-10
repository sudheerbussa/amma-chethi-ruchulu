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
 * Area / neighbourhood pages — only localities you can realistically serve.
 * Remove or pause any area outside the live delivery radius.
 */
export const areas: Area[] = [
  {
    slug: 'tenali',
    name: 'Tenali',
    keyword: 'home cooked food delivery Tenali',
    title: 'Home Cooked Food Delivery in Tenali | Amma Chethi Ruchulu',
    metaDescription:
      'Home cooked food delivery in Tenali. Lunch & dinner via WhatsApp from Amma Chethi Ruchulu — Chenchupeta and nearby areas.',
    h1: 'Delivering home cooked food in Tenali',
    intro:
      'Amma Chethi Ruchulu serves Tenali with scheduled home-cooked lunch and dinner. Order on WhatsApp before cutoff and we confirm whether your neighbourhood is on today’s route.',
    sections: [
      {
        heading: 'Tenali-first operations',
        body:
          'Our packing hub and many cook partners sit in the Tenali ecosystem. That proximity helps us keep batches tight and delivery windows realistic for local addresses.',
      },
      {
        heading: 'How to check your street',
        body:
          'Send your area, landmark, or pin code on WhatsApp. If we can deliver that slot, we confirm before you pay. If not, we will say so clearly rather than take a bad order.',
      },
    ],
    relatedTopicSlugs: [
      'homemade-lunch-delivery-tenali',
      'home-kitchen-food-tenali',
      'whatsapp-food-order-guntur',
    ],
    nearbySlugs: ['chenchupeta', 'angalakuduru', 'kolakaluru', 'duggirala'],
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
      'scheduled-meal-delivery-guntur',
    ],
    nearbySlugs: ['tenali', 'angalakuduru', 'narakoduru'],
  },
  {
    slug: 'guntur',
    name: 'Guntur',
    keyword: 'home food delivery Guntur city',
    title: 'Home Food Delivery in Guntur City | Amma Chethi Ruchulu',
    metaDescription:
      'Home food delivery for selected Guntur city areas. Scheduled Andhra home cooking via WhatsApp — Amma Chethi Ruchulu.',
    h1: 'Home food delivery in Guntur city',
    intro:
      'We deliver to selected Guntur city areas when they fall inside the day’s rider plan. Message your exact locality on WhatsApp to confirm coverage for lunch or dinner.',
    sections: [
      {
        heading: 'Radius matters more than the city name',
        body:
          '“Guntur” is large. We only accept orders we can pack and deliver on time. If your area is outside today’s radius, we will tell you—or suggest the next workable slot.',
      },
      {
        heading: 'Popular intents we serve',
        body:
          'Customers typically want home cooked food delivery, office lunch, vegetarian meals, or Andhra home food. Browse our topic pages or just ask WhatsApp for today’s menu.',
      },
    ],
    relatedTopicSlugs: [
      'home-cooked-food-delivery-guntur',
      'office-lunch-delivery-guntur',
      'andhra-home-food-guntur',
    ],
    nearbySlugs: ['tenali', 'narakoduru', 'pedaravuru'],
  },
  {
    slug: 'angalakuduru',
    name: 'Angalakuduru',
    keyword: 'home cooked food Angalakuduru',
    title: 'Home Cooked Food Delivery in Angalakuduru | Amma Chethi Ruchulu',
    metaDescription:
      'Home cooked food delivery in Angalakuduru near Tenali. Order lunch or dinner on WhatsApp with Amma Chethi Ruchulu.',
    h1: 'Delivery in Angalakuduru',
    intro:
      'Angalakuduru sits close to our Tenali operations. When your address is on the route, you can order scheduled home-cooked lunch or dinner on WhatsApp.',
    sections: [
      {
        heading: 'Confirm before you pay',
        body:
          'Send Angalakuduru + landmark on WhatsApp. We confirm the slot against rider capacity for that meal window.',
      },
    ],
    relatedTopicSlugs: ['homemade-lunch-delivery-tenali', 'home-kitchen-food-tenali'],
    nearbySlugs: ['tenali', 'chenchupeta', 'kolakaluru'],
  },
  {
    slug: 'kolakaluru',
    name: 'Kolakaluru',
    keyword: 'food delivery Kolakaluru',
    title: 'Home Food Delivery in Kolakaluru | Amma Chethi Ruchulu',
    metaDescription:
      'Order home food delivery in Kolakaluru via WhatsApp. Scheduled lunch & dinner from Amma Chethi Ruchulu when your area is covered.',
    h1: 'Delivery in Kolakaluru',
    intro:
      'Kolakaluru customers can request Amma Chethi Ruchulu delivery when the day’s route allows. Order ahead on WhatsApp and we will confirm.',
    sections: [
      {
        heading: 'Scheduled drops only',
        body:
          'We do not promise instant delivery. Lunch and dinner cutoffs keep Kolakaluru drops aligned with packing at the hub.',
      },
    ],
    relatedTopicSlugs: ['scheduled-meal-delivery-guntur', 'tiffin-delivery-guntur'],
    nearbySlugs: ['tenali', 'duggirala', 'angalakuduru'],
  },
  {
    slug: 'duggirala',
    name: 'Duggirala',
    keyword: 'home food delivery Duggirala',
    title: 'Home Food Delivery in Duggirala | Amma Chethi Ruchulu',
    metaDescription:
      'Home food delivery in Duggirala on selected routes. WhatsApp order before cutoff — Amma Chethi Ruchulu.',
    h1: 'Delivery in Duggirala',
    intro:
      'Duggirala is in our wider Tenali–Guntur service conversation. Coverage depends on rider plans—message us to check today’s lunch or dinner route.',
    sections: [
      {
        heading: 'Honest coverage',
        body:
          'If Duggirala is not on the route for a slot, we will not take the order. Ask early so you can plan another meal option if needed.',
      },
    ],
    relatedTopicSlugs: ['homemade-lunch-delivery-tenali', 'whatsapp-food-order-guntur'],
    nearbySlugs: ['tenali', 'kolakaluru', 'pedaravuru'],
  },
  {
    slug: 'narakoduru',
    name: 'Narakoduru',
    keyword: 'food delivery Narakoduru',
    title: 'Home Food Delivery in Narakoduru | Amma Chethi Ruchulu',
    metaDescription:
      'Request home food delivery in Narakoduru on WhatsApp. Amma Chethi Ruchulu confirms route coverage for lunch or dinner.',
    h1: 'Delivery in Narakoduru',
    intro:
      'Narakoduru orders are accepted when we can deliver inside the scheduled window. Start with a WhatsApp menu request and share your landmark.',
    sections: [
      {
        heading: 'Landmarks help',
        body:
          'Include a school, temple, or society name near your Narakoduru address so riders can find you without delay.',
      },
    ],
    relatedTopicSlugs: ['home-cooked-food-delivery-guntur', 'homemade-dinner-delivery-guntur'],
    nearbySlugs: ['guntur', 'chenchupeta', 'tenali'],
  },
  {
    slug: 'pedaravuru',
    name: 'Pedaravuru',
    keyword: 'home cooked food Pedaravuru',
    title: 'Home Cooked Food Delivery in Pedaravuru | Amma Chethi Ruchulu',
    metaDescription:
      'Home cooked food delivery in Pedaravuru when on route. Order lunch or dinner via WhatsApp — Amma Chethi Ruchulu.',
    h1: 'Delivery in Pedaravuru',
    intro:
      'Pedaravuru customers can join the WhatsApp order flow for days we cover the area. We confirm before cooking so you are not left waiting.',
    sections: [
      {
        heading: 'Same quality standard',
        body:
          'Wherever we deliver—Pedaravuru or core Tenali—the model stays the same: specialist cooks, hub packing, and cutoff-based slots.',
      },
    ],
    relatedTopicSlugs: ['andhra-home-food-guntur', 'scheduled-meal-delivery-guntur'],
    nearbySlugs: ['guntur', 'duggirala', 'tenali'],
  },
];

export function getArea(slug: string): Area | undefined {
  return areas.find((a) => a.slug === slug);
}

export function getAreasBySlugs(slugs: string[]): Area[] {
  return slugs.map((s) => getArea(s)).filter((a): a is Area => Boolean(a));
}
