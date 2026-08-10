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

const TENALI_TOPICS = [
  'homemade-lunch-delivery-tenali',
  'home-kitchen-food-tenali',
  'whatsapp-food-order-tenali',
] as const;

/** Internal Tenali localities (excluding the town overview page). */
const LOCALITY_SLUGS = [
  'chenchupeta',
  'bosebomma-centre',
  'morampudi-road',
  'kothapet',
  'ramalingeswara-pet',
  'chinaravuru',
  'angalakuduru-road',
  'gandhi-chowk',
  'railway-station',
  'burripalem-road',
  'katevaram',
  'sri-ram-nagar',
  'vidya-nagar',
  'housing-board-colony',
  'nazarapet',
  'donka-road',
] as const;

function nearbyFor(slug: string): string[] {
  return ['tenali', ...LOCALITY_SLUGS.filter((s) => s !== slug)].slice(0, 6);
}

function localityPage(opts: {
  slug: (typeof LOCALITY_SLUGS)[number];
  name: string;
  keyword: string;
  title: string;
  metaDescription: string;
  h1: string;
  intro: string;
  landmarkHint: string;
}): Area {
  return {
    slug: opts.slug,
    name: opts.name,
    keyword: opts.keyword,
    title: opts.title,
    metaDescription: opts.metaDescription,
    h1: opts.h1,
    intro: opts.intro,
    sections: [
      {
        heading: 'How to order for this area',
        body: `Message Amma Chethi Ruchulu on WhatsApp for today’s menu, mention ${opts.name}, and share a clear landmark. We confirm the Tenali lunch or dinner route before you pay.`,
      },
      {
        heading: 'Landmarks help riders',
        body: opts.landmarkHint,
      },
      {
        heading: 'Same Tenali cutoffs',
        body: 'Lunch: order by 10:00 AM (serve ~12–3 PM). Dinner: order by 4:00 PM (serve ~7–10 PM). Early orders keep packing and Tenali drops on schedule.',
      },
    ],
    relatedTopicSlugs: [...TENALI_TOPICS],
    nearbySlugs: nearbyFor(opts.slug),
  };
}

/**
 * Area pages — Tenali town only.
 * `/areas/tenali/` is the main town overview; other entries are internal localities.
 */
export const areas: Area[] = [
  {
    slug: 'tenali',
    name: 'Tenali',
    keyword: 'home cooked food delivery Tenali',
    title: 'Home Cooked Food Delivery in Tenali | Amma Chethi Ruchulu',
    metaDescription:
      'Home cooked food delivery across Tenali town. Lunch & dinner via WhatsApp from Amma Chethi Ruchulu — Chenchupeta, Kothapet, Bosebomma and more.',
    h1: 'Delivering home cooked food in Tenali',
    intro:
      'Amma Chethi Ruchulu delivers scheduled home-cooked lunch and dinner across Tenali town. Order on WhatsApp before cutoff and we confirm whether your neighbourhood is on today’s route.',
    sections: [
      {
        heading: 'Tenali town coverage',
        body:
          'We serve internal Tenali localities such as Chenchupeta, Bosebomma Centre, Morampudi Road, Kothapet, Ramalingeswara Pet, Chinaravuru, Gandhi Chowk, Railway Station area, Burripalem Road, Katevaram side, Sri Ram Nagar, Vidya Nagar, Housing Board Colony, Nazarapet, Donka Road, and the Angalakuduru Road stretch inside Tenali. Open a locality page below or just tell us your landmark on WhatsApp.',
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
      'home-cooked-food-delivery-tenali',
    ],
    nearbySlugs: [...LOCALITY_SLUGS],
  },
  localityPage({
    slug: 'chenchupeta',
    name: 'Chenchupeta',
    keyword: 'food delivery Chenchupeta Tenali',
    title: 'Home Food Delivery in Chenchupeta, Tenali | Amma Chethi Ruchulu',
    metaDescription:
      'Order home cooked lunch & dinner delivery in Chenchupeta, Tenali on WhatsApp. Amma Chethi Ruchulu — order before cutoff.',
    h1: 'Home food delivery in Chenchupeta',
    intro:
      'Chenchupeta is part of our Tenali delivery map. Order Amma Chethi Ruchulu lunch or dinner on WhatsApp and we confirm your drop for that slot.',
    landmarkHint:
      'Share a Chenchupeta landmark—Donka Road pin, society name, or nearby shop—so riders can find you without delay.',
  }),
  localityPage({
    slug: 'bosebomma-centre',
    name: 'Bosebomma Centre',
    keyword: 'food delivery Bosebomma Centre Tenali',
    title: 'Home Food Delivery in Bosebomma Centre, Tenali | Amma Chethi Ruchulu',
    metaDescription:
      'Home cooked food delivery near Bosebomma Centre / Bose Road, Tenali. Order lunch or dinner on WhatsApp.',
    h1: 'Delivery near Bosebomma Centre',
    intro:
      'Ordering near Bose Road / Bosebomma Centre in Tenali? Message us on WhatsApp for today’s menu and confirm your lunch or dinner slot.',
    landmarkHint:
      'Mention Bosebomma Centre, Bose Road, or a shop/temple next to your building when you order.',
  }),
  localityPage({
    slug: 'morampudi-road',
    name: 'Morampudi Road',
    keyword: 'food delivery Morampudi Road Tenali',
    title: 'Home Food Delivery on Morampudi Road, Tenali | Amma Chethi Ruchulu',
    metaDescription:
      'Home cooked lunch & dinner delivery on Morampudi Road, Tenali via WhatsApp — Amma Chethi Ruchulu.',
    h1: 'Delivery on Morampudi Road',
    intro:
      'Morampudi Road addresses in Tenali can order scheduled home-cooked meals on WhatsApp. We confirm coverage for that day’s lunch or dinner route.',
    landmarkHint:
      'Add a Morampudi Road kilometre marker, junction, or known business name with your address.',
  }),
  localityPage({
    slug: 'kothapet',
    name: 'Kothapet',
    keyword: 'food delivery Kothapet Tenali',
    title: 'Home Food Delivery in Kothapet, Tenali | Amma Chethi Ruchulu',
    metaDescription:
      'Order home cooked food delivery in Kothapet, Tenali. WhatsApp lunch & dinner cutoffs — Amma Chethi Ruchulu.',
    h1: 'Delivery in Kothapet',
    intro:
      'Kothapet is inside our Tenali service area. Ask for today’s menu on WhatsApp and place your order before the lunch or dinner cutoff.',
    landmarkHint:
      'Share your Kothapet street, cross-road, or apartment name so the rider can navigate quickly.',
  }),
  localityPage({
    slug: 'ramalingeswara-pet',
    name: 'Ramalingeswara Pet',
    keyword: 'food delivery Ramalingeswara Pet Tenali',
    title: 'Home Food Delivery in Ramalingeswara Pet, Tenali | Amma Chethi Ruchulu',
    metaDescription:
      'Home cooked meal delivery in Ramalingeswara Pet, Tenali. Order ahead on WhatsApp with Amma Chethi Ruchulu.',
    h1: 'Delivery in Ramalingeswara Pet',
    intro:
      'Ramalingeswara Pet customers in Tenali can order home-cooked lunch or dinner on WhatsApp. We confirm the slot before cooking starts.',
    landmarkHint:
      'Include a temple, school, or society name near your Ramalingeswara Pet address.',
  }),
  localityPage({
    slug: 'chinaravuru',
    name: 'Chinaravuru',
    keyword: 'food delivery Chinaravuru Tenali',
    title: 'Home Food Delivery in Chinaravuru, Tenali | Amma Chethi Ruchulu',
    metaDescription:
      'Home food delivery in Chinaravuru, Tenali. Scheduled WhatsApp orders for lunch and dinner — Amma Chethi Ruchulu.',
    h1: 'Delivery in Chinaravuru',
    intro:
      'Chinaravuru is on our Tenali locality list. Message WhatsApp for the menu and confirm whether your pin is on today’s delivery route.',
    landmarkHint:
      'Tell us a Chinaravuru landmark or main road reference with your house or flat details.',
  }),
  localityPage({
    slug: 'angalakuduru-road',
    name: 'Angalakuduru Road',
    keyword: 'food delivery Angalakuduru Road Tenali',
    title: 'Home Food Delivery on Angalakuduru Road, Tenali | Amma Chethi Ruchulu',
    metaDescription:
      'Delivery along the Angalakuduru Road stretch inside Tenali. Order home-cooked lunch or dinner on WhatsApp.',
    h1: 'Delivery on Angalakuduru Road (Tenali)',
    intro:
      'We cover the Angalakuduru Road stretch that falls inside Tenali town. Share your exact landmark on WhatsApp so we can confirm the drop.',
    landmarkHint:
      'Say “Angalakuduru Road, Tenali” plus a shop, bus stop, or gate name—not only the road name.',
  }),
  localityPage({
    slug: 'gandhi-chowk',
    name: 'Gandhi Chowk',
    keyword: 'food delivery Gandhi Chowk Tenali',
    title: 'Home Food Delivery near Gandhi Chowk, Tenali | Amma Chethi Ruchulu',
    metaDescription:
      'Home cooked food delivery near Gandhi Chowk / Municipal Office area, Tenali. WhatsApp order before cutoff.',
    h1: 'Delivery near Gandhi Chowk',
    intro:
      'Near Municipal Office / Gandhi Chowk in Tenali? Order Amma Chethi Ruchulu meals on WhatsApp for the lunch or dinner window.',
    landmarkHint:
      'Mention Gandhi Chowk, Municipal Office, or a facing shop/road when you send the address.',
  }),
  localityPage({
    slug: 'railway-station',
    name: 'Railway Station area',
    keyword: 'food delivery Tenali Railway Station',
    title: 'Home Food Delivery near Tenali Railway Station | Amma Chethi Ruchulu',
    metaDescription:
      'Home cooked lunch & dinner delivery near Tenali Railway Station area via WhatsApp — Amma Chethi Ruchulu.',
    h1: 'Delivery near Tenali Railway Station',
    intro:
      'Addresses around Tenali Railway Station can join the WhatsApp order flow for scheduled home-cooked meals. Confirm your landmark when you chat.',
    landmarkHint:
      'Use station-side road names, lodges, or known junctions so riders do not circle the station complex.',
  }),
  localityPage({
    slug: 'burripalem-road',
    name: 'Burripalem Road',
    keyword: 'food delivery Burripalem Road Tenali',
    title: 'Home Food Delivery on Burripalem Road, Tenali | Amma Chethi Ruchulu',
    metaDescription:
      'Order home cooked food on Burripalem Road, Tenali. Lunch and dinner WhatsApp ordering — Amma Chethi Ruchulu.',
    h1: 'Delivery on Burripalem Road',
    intro:
      'Burripalem Road in Tenali is part of our town delivery map. Ask for today’s menu and lock lunch or dinner before cutoff.',
    landmarkHint:
      'Add a Burripalem Road milestone, apartment, or business name with your phone number for the rider.',
  }),
  localityPage({
    slug: 'katevaram',
    name: 'Katevaram',
    keyword: 'food delivery Katevaram Tenali',
    title: 'Home Food Delivery in Katevaram, Tenali | Amma Chethi Ruchulu',
    metaDescription:
      'Home food delivery for Katevaram / Catwalk side within Tenali. Order on WhatsApp before lunch or dinner cutoff.',
    h1: 'Delivery in Katevaram',
    intro:
      'Katevaram (Catwalk side) orders are taken as Tenali-town deliveries when your pin is on the route. Message WhatsApp to confirm the slot.',
    landmarkHint:
      'Share Katevaram / Catwalk landmark details—colony name or main junction—with your address.',
  }),
  localityPage({
    slug: 'sri-ram-nagar',
    name: 'Sri Ram Nagar',
    keyword: 'food delivery Sri Ram Nagar Tenali',
    title: 'Home Food Delivery in Sri Ram Nagar, Tenali | Amma Chethi Ruchulu',
    metaDescription:
      'Home cooked meal delivery in Sri Ram Nagar, Tenali via WhatsApp — Amma Chethi Ruchulu.',
    h1: 'Delivery in Sri Ram Nagar',
    intro:
      'Sri Ram Nagar residents in Tenali can order scheduled lunch or dinner on WhatsApp. We confirm before the batch is cooked.',
    landmarkHint:
      'Mention plot/flat number plus a Sri Ram Nagar park, temple, or main road reference.',
  }),
  localityPage({
    slug: 'vidya-nagar',
    name: 'Vidya Nagar',
    keyword: 'food delivery Vidya Nagar Tenali',
    title: 'Home Food Delivery in Vidya Nagar, Tenali | Amma Chethi Ruchulu',
    metaDescription:
      'Order home cooked lunch & dinner in Vidya Nagar, Tenali on WhatsApp. Amma Chethi Ruchulu.',
    h1: 'Delivery in Vidya Nagar',
    intro:
      'Vidya Nagar is inside Tenali town coverage. Chat on WhatsApp for the menu and place your order before cutoff.',
    landmarkHint:
      'Include your Vidya Nagar street or school/college landmark with the delivery phone number.',
  }),
  localityPage({
    slug: 'housing-board-colony',
    name: 'Housing Board Colony',
    keyword: 'food delivery Housing Board Colony Tenali',
    title: 'Home Food Delivery in Housing Board Colony, Tenali | Amma Chethi Ruchulu',
    metaDescription:
      'Home cooked food delivery in Housing Board Colony, Tenali. WhatsApp lunch & dinner orders — Amma Chethi Ruchulu.',
    h1: 'Delivery in Housing Board Colony',
    intro:
      'Housing Board Colony addresses in Tenali can order Amma Chethi Ruchulu meals on WhatsApp for lunch or dinner slots.',
    landmarkHint:
      'Share house/flat number and a Housing Board Colony sector, park, or gate name.',
  }),
  localityPage({
    slug: 'nazarapet',
    name: 'Nazarapet',
    keyword: 'food delivery Nazarapet Tenali',
    title: 'Home Food Delivery in Nazarapet, Tenali | Amma Chethi Ruchulu',
    metaDescription:
      'Home food delivery in Nazarapet, Tenali. Order ahead on WhatsApp with Amma Chethi Ruchulu.',
    h1: 'Delivery in Nazarapet',
    intro:
      'Nazarapet is on our Tenali locality list. Message us for today’s menu and confirm your lunch or dinner delivery.',
    landmarkHint:
      'Add a Nazarapet road name, mosque/temple, or shop landmark with your address.',
  }),
  localityPage({
    slug: 'donka-road',
    name: 'Donka Road',
    keyword: 'food delivery Donka Road Tenali',
    title: 'Home Food Delivery on Donka Road, Tenali | Amma Chethi Ruchulu',
    metaDescription:
      'Home cooked lunch & dinner delivery on Donka Road, Tenali (including beyond Chenchupeta). Order on WhatsApp.',
    h1: 'Delivery on Donka Road',
    intro:
      'Donka Road addresses in Tenali—including stretches beyond the Chenchupeta pin—can order scheduled home meals on WhatsApp.',
    landmarkHint:
      'Say Donka Road plus a clear gate, house number, or neighbouring shop so riders do not miss the turn.',
  }),
];

export function getArea(slug: string): Area | undefined {
  return areas.find((a) => a.slug === slug);
}

export function getAreasBySlugs(slugs: string[]): Area[] {
  return slugs.map((s) => getArea(s)).filter((a): a is Area => Boolean(a));
}
