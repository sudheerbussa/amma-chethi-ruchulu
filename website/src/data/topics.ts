import type { FaqItem } from './faqs';

export type Topic = {
  slug: string;
  keyword: string;
  title: string;
  metaDescription: string;
  h1: string;
  intro: string;
  sections: { heading: string; body: string }[];
  relatedSlugs: string[];
  relatedAreaSlugs?: string[];
  faqs?: FaqItem[];
};

/**
 * pSEO topic pages — one primary intent per URL.
 * Expand this list monthly; keep copy unique (no spun duplicates).
 */
export const topics: Topic[] = [
  {
    slug: 'home-cooked-food-delivery-guntur',
    keyword: 'home cooked food delivery Guntur',
    title: 'Home Cooked Food Delivery in Guntur | Amma Chethi Ruchulu',
    metaDescription:
      'Order authentic home cooked food delivery in Guntur. Andhra specialist cooks, lunch & dinner cutoffs, WhatsApp ordering with Amma Chethi Ruchulu.',
    h1: 'Home cooked food delivery in Guntur',
    intro:
      'Looking for home cooked food delivery in Guntur that tastes like a family kitchen—not a hotel buffet? Amma Chethi Ruchulu connects you with specialist home cooks, packs meals with care, and delivers on a schedule you can plan around.',
    sections: [
      {
        heading: 'Why scheduled home cooking beats last-minute restaurant apps',
        body:
          'Restaurant aggregators optimise for speed. We optimise for taste and batch quality. You order ahead for lunch or dinner, cooks prepare limited portions, and we collect, pack, and deliver in a defined window. That means fewer compromises on spice balance, freshness, and portion honesty—especially for Andhra home food in Guntur.',
      },
      {
        heading: 'How ordering works',
        body:
          'Chat on WhatsApp for the day’s menu, choose lunch (order by 10:00 AM) or dinner (order by 4:00 PM), share your Guntur-area address, and pay as instructed. We confirm your slot before cooking starts so batches stay controlled.',
      },
      {
        heading: 'Who this is for',
        body:
          'Working professionals who miss home meals, families who want a break from cooking without eating greasy takeout, and anyone searching specifically for home cooked food delivery in Guntur rather than generic fast food.',
      },
    ],
    relatedSlugs: [
      'homemade-lunch-delivery-tenali',
      'homemade-dinner-delivery-guntur',
      'whatsapp-food-order-guntur',
      'andhra-home-food-guntur',
    ],
    relatedAreaSlugs: ['guntur', 'tenali', 'chenchupeta'],
    faqs: [
      {
        question: 'Do you deliver home cooked food across all of Guntur?',
        answer:
          'We serve selected areas in and around Guntur and Tenali based on rider routes that day. Share your pin code or landmark on WhatsApp and we will confirm coverage.',
      },
    ],
  },
  {
    slug: 'homemade-lunch-delivery-tenali',
    keyword: 'homemade lunch delivery Tenali',
    title: 'Homemade Lunch Delivery in Tenali | Amma Chethi Ruchulu',
    metaDescription:
      'Homemade lunch delivery in Tenali — order by 10:00 AM on WhatsApp. Fresh Andhra home cooking from Amma Chethi Ruchulu.',
    h1: 'Homemade lunch delivery in Tenali',
    intro:
      'Tenali diners who want a real homemade lunch—not a rushed hotel thali—can order ahead with Amma Chethi Ruchulu. Place your WhatsApp order by 10:00 AM for the midday delivery window.',
    sections: [
      {
        heading: 'Lunch cutoff that keeps food honest',
        body:
          'Our lunch cutoff is 10:00 AM so cooks have time to prepare properly and our hub can pack without chaos. Midday delivery is typically aimed for the 12–3 PM window, confirmed when you order.',
      },
      {
        heading: 'What a Tenali lunch order usually looks like',
        body:
          'Menus change with cook availability. Expect Andhra-style home meals such as rice combinations, vegetable curries, pachadi, and signature dishes when listed for the day. Ask for today’s vegetarian options if you need them.',
      },
      {
        heading: 'Delivery around Tenali',
        body:
          'We regularly serve Tenali neighbourhoods including Chenchupeta and nearby localities inside our radius. Message your exact area when you order so we can confirm the same-day route.',
      },
    ],
    relatedSlugs: [
      'home-cooked-food-delivery-guntur',
      'home-kitchen-food-tenali',
      'office-lunch-delivery-guntur',
      'tiffin-delivery-guntur',
    ],
    relatedAreaSlugs: ['tenali', 'chenchupeta', 'angalakuduru'],
  },
  {
    slug: 'homemade-dinner-delivery-guntur',
    keyword: 'homemade dinner delivery Guntur',
    title: 'Homemade Dinner Delivery in Guntur | Amma Chethi Ruchulu',
    metaDescription:
      'Homemade dinner delivery in Guntur. Order by 4:00 PM on WhatsApp for evening home-cooked Andhra meals from Amma Chethi Ruchulu.',
    h1: 'Homemade dinner delivery in Guntur',
    intro:
      'If you search for homemade dinner delivery in Guntur, you usually want something lighter on oil and heavier on taste. Order by 4:00 PM and we aim for the 7–10 PM evening window.',
    sections: [
      {
        heading: 'Evening batches, not midnight leftovers',
        body:
          'Dinner is cooked for that evening’s confirmed orders. We do not sit on lunch leftovers and relabel them as dinner. Cutoffs exist so every batch has a clear prep clock.',
      },
      {
        heading: 'Good for weeknights',
        body:
          'Skip the “what should we cook?” loop. Message the menu, lock dinner before 4:00 PM, and get home-style Andhra food delivered when you are ready to eat.',
      },
    ],
    relatedSlugs: [
      'home-cooked-food-delivery-guntur',
      'scheduled-meal-delivery-guntur',
      'vegetarian-home-food-delivery-guntur',
    ],
    relatedAreaSlugs: ['guntur', 'tenali'],
  },
  {
    slug: 'andhra-home-food-guntur',
    keyword: 'Andhra home food Guntur',
    title: 'Andhra Home Food in Guntur | Amma Chethi Ruchulu',
    metaDescription:
      'Taste Andhra home food in Guntur from specialist home cooks. Scheduled lunch & dinner delivery via WhatsApp — Amma Chethi Ruchulu.',
    h1: 'Andhra home food in Guntur',
    intro:
      'Andhra home food is about pickle heat, tadka aroma, and rice-meal balance that restaurants often flatten. Amma Chethi Ruchulu brings that kitchen character to Guntur through specialist home cooks.',
    sections: [
      {
        heading: 'Specialist cooks, not a generic cloud kitchen',
        body:
          'Each cook focuses on dishes they actually know well. That specialist model is the point of Amma Chethi Ruchulu: authentic home flavours with a delivery system built around cutoffs and packing.',
      },
      {
        heading: 'Order the Andhra way—ahead',
        body:
          'Great Andhra meals need prep time. Ordering ahead on WhatsApp is how we keep quality stable while still delivering to your door in Guntur and Tenali.',
      },
    ],
    relatedSlugs: [
      'home-cooked-food-delivery-guntur',
      'pulihora-delivery-guntur',
      'homemade-biryani-delivery-guntur',
    ],
    relatedAreaSlugs: ['guntur', 'tenali'],
  },
  {
    slug: 'tiffin-delivery-guntur',
    keyword: 'tiffin delivery Guntur',
    title: 'Tiffin Delivery in Guntur | Amma Chethi Ruchulu',
    metaDescription:
      'Tiffin delivery in Guntur for lunch and dinner. Homemade Andhra meals ordered on WhatsApp before cutoff — Amma Chethi Ruchulu.',
    h1: 'Tiffin delivery in Guntur',
    intro:
      'Need dependable tiffin delivery in Guntur without committing to a messy monthly mess? Start with same-day or next-slot orders on WhatsApp and see if our home-cooked batches fit your routine.',
    sections: [
      {
        heading: 'Flexible tiffin, scheduled properly',
        body:
          'We are not a lock-in hostel mess. You order when you need lunch or dinner, subject to cutoffs and area coverage. That flexibility still depends on ordering early enough for cooks to prep.',
      },
      {
        heading: 'What to expect in a tiffin-style meal',
        body:
          'Menus vary, but the intent is a complete home meal: staples plus sides that travel well after packing. Ask WhatsApp for today’s combination before you pay.',
      },
    ],
    relatedSlugs: [
      'homemade-lunch-delivery-tenali',
      'office-lunch-delivery-guntur',
      'home-cooked-food-delivery-guntur',
    ],
    relatedAreaSlugs: ['guntur', 'tenali'],
  },
  {
    slug: 'whatsapp-food-order-guntur',
    keyword: 'WhatsApp food order Guntur',
    title: 'Order Food on WhatsApp in Guntur | Amma Chethi Ruchulu',
    metaDescription:
      'Place a WhatsApp food order in Guntur for homemade lunch or dinner. Simple menu chat, cutoffs, and delivery with Amma Chethi Ruchulu.',
    h1: 'WhatsApp food ordering in Guntur',
    intro:
      'No app download required. Amma Chethi Ruchulu takes WhatsApp food orders in Guntur and Tenali—menu, confirmation, payment instructions, and delivery updates in one chat thread.',
    sections: [
      {
        heading: 'Why WhatsApp-first works for local meals',
        body:
          'Local customers already live in WhatsApp. Ordering there reduces friction, makes menu changes easy, and keeps your delivery notes in the same place as support questions.',
      },
      {
        heading: 'Steps to order',
        body:
          '1) Tap Order on WhatsApp. 2) Ask for today’s menu. 3) Choose lunch or dinner before cutoff. 4) Share name, phone, and delivery area. 5) Pay as instructed and wait for confirmation.',
      },
    ],
    relatedSlugs: [
      'home-cooked-food-delivery-guntur',
      'scheduled-meal-delivery-guntur',
      'homemade-lunch-delivery-tenali',
    ],
    relatedAreaSlugs: ['guntur', 'tenali', 'chenchupeta'],
  },
  {
    slug: 'pulihora-delivery-guntur',
    keyword: 'pulihora delivery Guntur',
    title: 'Pulihora Delivery in Guntur | Amma Chethi Ruchulu',
    metaDescription:
      'Craving pulihora delivery in Guntur? Ask Amma Chethi Ruchulu on WhatsApp when homemade pulihora is on the day’s menu and order before cutoff.',
    h1: 'Pulihora delivery in Guntur',
    intro:
      'Pulihora travels well and tastes like home when the seasoning is right. When our cooks list pulihora on the daily menu, you can order delivery in Guntur or Tenali on WhatsApp.',
    sections: [
      {
        heading: 'Availability is menu-led',
        body:
          'We do not pretend every dish is available 24/7. Pulihora appears when a specialist cook is preparing it for that slot. Message us to check today’s list.',
      },
      {
        heading: 'Pair it with a full meal',
        body:
          'Many customers add a curry or snack side when available. Ask the chat for combinations that pack cleanly for lunch or dinner delivery.',
      },
    ],
    relatedSlugs: ['andhra-home-food-guntur', 'homemade-lunch-delivery-tenali'],
    relatedAreaSlugs: ['guntur', 'tenali'],
  },
  {
    slug: 'homemade-biryani-delivery-guntur',
    keyword: 'homemade biryani delivery Guntur',
    title: 'Homemade Biryani Delivery in Guntur | Amma Chethi Ruchulu',
    metaDescription:
      'Homemade biryani delivery in Guntur when listed on the daily menu. Order ahead on WhatsApp with Amma Chethi Ruchulu.',
    h1: 'Homemade biryani delivery in Guntur',
    intro:
      'Hotel biryani and home biryani are different animals. When a specialist cook lists biryani on our menu, Amma Chethi Ruchulu offers homemade biryani delivery in Guntur on a scheduled slot.',
    sections: [
      {
        heading: 'Order early—biryani needs a real prep window',
        body:
          'Biryani is not a five-minute add-on. Respect the lunch or dinner cutoff so the cook can finish dum properly before we pack and dispatch.',
      },
      {
        heading: 'Check the day’s menu first',
        body:
          'Availability depends on the cook roster. WhatsApp us for whether biryani (or a biryani-style rice) is running for lunch or dinner today.',
      },
    ],
    relatedSlugs: ['andhra-home-food-guntur', 'homemade-dinner-delivery-guntur'],
    relatedAreaSlugs: ['guntur', 'tenali'],
  },
  {
    slug: 'vegetarian-home-food-delivery-guntur',
    keyword: 'vegetarian home food delivery Guntur',
    title: 'Vegetarian Home Food Delivery in Guntur | Amma Chethi Ruchulu',
    metaDescription:
      'Vegetarian home food delivery in Guntur & Tenali. Ask for today’s veg menu on WhatsApp and order before lunch or dinner cutoff.',
    h1: 'Vegetarian home food delivery in Guntur',
    intro:
      'Searching for vegetarian home food delivery in Guntur usually means you want clean veg meals without mystery gravy. Tell us you need vegetarian only and we will guide you to today’s veg options.',
    sections: [
      {
        heading: 'Veg-first ordering',
        body:
          'Mention dietary preference in the first WhatsApp message. We confirm which items are fully vegetarian for that slot before you pay.',
      },
      {
        heading: 'Home-style veg that still feels complete',
        body:
          'Think rice meals, vegetable curries, dals, and Andhra sides when listed—not only a token sabzi. Exact dishes rotate with the cooks.',
      },
    ],
    relatedSlugs: ['tiffin-delivery-guntur', 'andhra-home-food-guntur'],
    relatedAreaSlugs: ['guntur', 'tenali'],
  },
  {
    slug: 'office-lunch-delivery-guntur',
    keyword: 'office lunch delivery Guntur',
    title: 'Office Lunch Delivery in Guntur | Amma Chethi Ruchulu',
    metaDescription:
      'Office lunch delivery in Guntur from home cooks. Order by 10:00 AM on WhatsApp for scheduled midday delivery — Amma Chethi Ruchulu.',
    h1: 'Office lunch delivery in Guntur',
    intro:
      'Office lunch delivery in Guntur should arrive when your break starts—not two hours late with cold oil. Order by 10:00 AM and we schedule packing and dispatch for the midday window.',
    sections: [
      {
        heading: 'One chat for the desk team',
        body:
          'Individuals can order on WhatsApp. If a few colleagues want the same slot, mention shared delivery notes early so we can plan the drop.',
      },
      {
        heading: 'Better than random cloud-kitchen roulette',
        body:
          'You get home-cooked batches with clear cutoffs instead of mystery kitchens you will never reorder from. Try a week of lunches and keep what works.',
      },
    ],
    relatedSlugs: [
      'homemade-lunch-delivery-tenali',
      'tiffin-delivery-guntur',
      'whatsapp-food-order-guntur',
    ],
    relatedAreaSlugs: ['guntur', 'tenali'],
  },
  {
    slug: 'home-kitchen-food-tenali',
    keyword: 'home kitchen food Tenali',
    title: 'Home Kitchen Food in Tenali | Amma Chethi Ruchulu',
    metaDescription:
      'Home kitchen food in Tenali from Amma Chethi Ruchulu — specialist cooks, hub packing, WhatsApp ordering for lunch and dinner.',
    h1: 'Home kitchen food in Tenali',
    intro:
      'Amma Chethi Ruchulu is based around Tenali and serves home kitchen food with a simple promise: specialist cooks, order-ahead batches, and delivery you can trust for lunch or dinner.',
    sections: [
      {
        heading: 'From home kitchen to hub to door',
        body:
          'Cooks prepare confirmed orders. We collect and pack at our hub, then riders deliver in the scheduled window. That hub step keeps quality consistent across Tenali routes.',
      },
      {
        heading: 'Local by design',
        body:
          'We are not trying to be pan-India. Tenali and nearby Guntur coverage lets us stay personal on WhatsApp while still running a real delivery operation.',
      },
    ],
    relatedSlugs: [
      'homemade-lunch-delivery-tenali',
      'home-cooked-food-delivery-guntur',
      'scheduled-meal-delivery-guntur',
    ],
    relatedAreaSlugs: ['tenali', 'chenchupeta', 'kolakaluru'],
  },
  {
    slug: 'scheduled-meal-delivery-guntur',
    keyword: 'scheduled meal delivery Guntur',
    title: 'Scheduled Meal Delivery in Guntur | Amma Chethi Ruchulu',
    metaDescription:
      'Scheduled meal delivery in Guntur & Tenali. Lunch and dinner cutoffs, WhatsApp ordering, home-cooked batches — Amma Chethi Ruchulu.',
    h1: 'Scheduled meal delivery in Guntur',
    intro:
      'Scheduled meal delivery means you pick a lunch or dinner slot and we cook to that plan. Amma Chethi Ruchulu runs cutoffs so Guntur and Tenali customers get intentional batches—not chaotic on-demand chaos.',
    sections: [
      {
        heading: 'Cutoffs are a feature',
        body:
          'Lunch by 10:00 AM and dinner by 4:00 PM exist so cooks, packing, and riders share one timeline. If you miss a cutoff, ask WhatsApp about the next available slot.',
      },
      {
        heading: 'Plan your week without an app maze',
        body:
          'Use WhatsApp when you need a meal. Over time you will learn which slots fit your office or family routine for Guntur-area delivery.',
      },
    ],
    relatedSlugs: [
      'homemade-dinner-delivery-guntur',
      'whatsapp-food-order-guntur',
      'office-lunch-delivery-guntur',
    ],
    relatedAreaSlugs: ['guntur', 'tenali'],
  },
];

export function getTopic(slug: string): Topic | undefined {
  return topics.find((t) => t.slug === slug);
}

export function getTopicsBySlugs(slugs: string[]): Topic[] {
  return slugs.map((s) => getTopic(s)).filter((t): t is Topic => Boolean(t));
}
