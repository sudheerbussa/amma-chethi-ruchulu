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
 * pSEO topic pages — Tenali delivery only.
 * One primary intent per URL; expand only when you actually serve that intent/area.
 */
export const topics: Topic[] = [
  {
    slug: 'home-cooked-food-delivery-tenali',
    keyword: 'home cooked food delivery Tenali',
    title: 'Home Cooked Food Delivery in Tenali | Amma Chethi Ruchulu',
    metaDescription:
      'Order authentic home cooked food delivery in Tenali. Andhra specialist cooks, lunch & dinner cutoffs, WhatsApp ordering with Amma Chethi Ruchulu.',
    h1: 'Home cooked food delivery in Tenali',
    intro:
      'Looking for home cooked food delivery in Tenali that tastes like a family kitchen—not a hotel buffet? Amma Chethi Ruchulu connects you with specialist home cooks, packs meals with care, and delivers on a schedule you can plan around.',
    sections: [
      {
        heading: 'Why scheduled home cooking beats last-minute restaurant apps',
        body:
          'Restaurant aggregators optimise for speed. We optimise for taste and batch quality. You order ahead for lunch or dinner, cooks prepare limited portions, and we collect, pack, and deliver in a defined window—especially for Andhra home food in Tenali.',
      },
      {
        heading: 'How ordering works',
        body:
          'Chat on WhatsApp for the day’s menu, choose lunch (order by 10:00 AM) or dinner (order by 4:00 PM), share your Tenali address, and pay as instructed. We confirm your slot before cooking starts so batches stay controlled.',
      },
      {
        heading: 'Who this is for',
        body:
          'Working professionals who miss home meals, families who want a break from cooking without greasy takeout, and anyone searching specifically for home cooked food delivery in Tenali.',
      },
    ],
    relatedSlugs: [
      'homemade-lunch-delivery-tenali',
      'homemade-dinner-delivery-tenali',
      'whatsapp-food-order-tenali',
      'andhra-home-food-tenali',
    ],
    relatedAreaSlugs: ['tenali', 'chenchupeta'],
    faqs: [
      {
        question: 'Do you deliver across all of Tenali?',
        answer:
          'We deliver in Tenali, including Chenchupeta, based on rider routes that day. Share your landmark or pin code on WhatsApp and we will confirm coverage.',
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
        heading: 'Delivery in Tenali',
        body:
          'We serve Tenali neighbourhoods including Chenchupeta. Message your exact area when you order so we can confirm the same-day route.',
      },
    ],
    relatedSlugs: [
      'home-cooked-food-delivery-tenali',
      'home-kitchen-food-tenali',
      'office-lunch-delivery-tenali',
      'tiffin-delivery-tenali',
    ],
    relatedAreaSlugs: ['tenali', 'chenchupeta'],
  },
  {
    slug: 'homemade-dinner-delivery-tenali',
    keyword: 'homemade dinner delivery Tenali',
    title: 'Homemade Dinner Delivery in Tenali | Amma Chethi Ruchulu',
    metaDescription:
      'Homemade dinner delivery in Tenali. Order by 4:00 PM on WhatsApp for evening home-cooked Andhra meals from Amma Chethi Ruchulu.',
    h1: 'Homemade dinner delivery in Tenali',
    intro:
      'If you want homemade dinner delivery in Tenali, order by 4:00 PM and we aim for the 7–10 PM evening window—home taste without restaurant rush.',
    sections: [
      {
        heading: 'Evening batches, not midday leftovers',
        body:
          'Dinner is cooked for that evening’s confirmed orders. Cutoffs exist so every batch has a clear prep clock.',
      },
      {
        heading: 'Good for Tenali weeknights',
        body:
          'Skip the “what should we cook?” loop. Message the menu, lock dinner before 4:00 PM, and get home-style Andhra food delivered when you are ready to eat.',
      },
    ],
    relatedSlugs: [
      'home-cooked-food-delivery-tenali',
      'scheduled-meal-delivery-tenali',
      'vegetarian-home-food-delivery-tenali',
    ],
    relatedAreaSlugs: ['tenali', 'chenchupeta'],
  },
  {
    slug: 'andhra-home-food-tenali',
    keyword: 'Andhra home food Tenali',
    title: 'Andhra Home Food in Tenali | Amma Chethi Ruchulu',
    metaDescription:
      'Taste Andhra home food in Tenali from specialist home cooks. Scheduled lunch & dinner delivery via WhatsApp — Amma Chethi Ruchulu.',
    h1: 'Andhra home food in Tenali',
    intro:
      'Andhra home food is about pickle heat, tadka aroma, and rice-meal balance that restaurants often flatten. Amma Chethi Ruchulu brings that kitchen character to Tenali through specialist home cooks.',
    sections: [
      {
        heading: 'Specialist cooks, not a generic cloud kitchen',
        body:
          'Each cook focuses on dishes they actually know well. That specialist model is the point: authentic home flavours with cutoffs and packing built for Tenali delivery.',
      },
      {
        heading: 'Order the Andhra way—ahead',
        body:
          'Great Andhra meals need prep time. Ordering ahead on WhatsApp is how we keep quality stable while still delivering to your door in Tenali.',
      },
    ],
    relatedSlugs: [
      'home-cooked-food-delivery-tenali',
      'pulihora-delivery-tenali',
      'homemade-biryani-delivery-tenali',
    ],
    relatedAreaSlugs: ['tenali', 'chenchupeta'],
  },
  {
    slug: 'tiffin-delivery-tenali',
    keyword: 'tiffin delivery Tenali',
    title: 'Tiffin Delivery in Tenali | Amma Chethi Ruchulu',
    metaDescription:
      'Tiffin delivery in Tenali for lunch and dinner. Homemade Andhra meals ordered on WhatsApp before cutoff — Amma Chethi Ruchulu.',
    h1: 'Tiffin delivery in Tenali',
    intro:
      'Need dependable tiffin delivery in Tenali without a messy monthly mess lock-in? Start with same-day or next-slot orders on WhatsApp and see if our home-cooked batches fit your routine.',
    sections: [
      {
        heading: 'Flexible tiffin, scheduled properly',
        body:
          'You order when you need lunch or dinner, subject to cutoffs and Tenali coverage. That flexibility still depends on ordering early enough for cooks to prep.',
      },
      {
        heading: 'What to expect in a tiffin-style meal',
        body:
          'Menus vary, but the intent is a complete home meal: staples plus sides that travel well after packing. Ask WhatsApp for today’s combination before you pay.',
      },
    ],
    relatedSlugs: [
      'homemade-lunch-delivery-tenali',
      'office-lunch-delivery-tenali',
      'home-cooked-food-delivery-tenali',
    ],
    relatedAreaSlugs: ['tenali', 'chenchupeta'],
  },
  {
    slug: 'whatsapp-food-order-tenali',
    keyword: 'WhatsApp food order Tenali',
    title: 'Order Food on WhatsApp in Tenali | Amma Chethi Ruchulu',
    metaDescription:
      'Place a WhatsApp food order in Tenali for homemade lunch or dinner. Simple menu chat, cutoffs, and delivery with Amma Chethi Ruchulu.',
    h1: 'WhatsApp food ordering in Tenali',
    intro:
      'No app download required. Amma Chethi Ruchulu takes WhatsApp food orders in Tenali—menu, confirmation, payment instructions, and delivery updates in one chat thread.',
    sections: [
      {
        heading: 'Why WhatsApp-first works for local meals',
        body:
          'Local customers already live in WhatsApp. Ordering there reduces friction, makes menu changes easy, and keeps your delivery notes in the same place as support questions.',
      },
      {
        heading: 'Steps to order',
        body:
          '1) Tap Order on WhatsApp. 2) Ask for today’s menu. 3) Choose lunch or dinner before cutoff. 4) Share name, phone, and Tenali delivery area. 5) Pay as instructed and wait for confirmation.',
      },
    ],
    relatedSlugs: [
      'home-cooked-food-delivery-tenali',
      'scheduled-meal-delivery-tenali',
      'homemade-lunch-delivery-tenali',
    ],
    relatedAreaSlugs: ['tenali', 'chenchupeta'],
  },
  {
    slug: 'pulihora-delivery-tenali',
    keyword: 'pulihora delivery Tenali',
    title: 'Pulihora Delivery in Tenali | Amma Chethi Ruchulu',
    metaDescription:
      'Craving pulihora delivery in Tenali? Ask Amma Chethi Ruchulu on WhatsApp when homemade pulihora is on the day’s menu and order before cutoff.',
    h1: 'Pulihora delivery in Tenali',
    intro:
      'Pulihora travels well and tastes like home when the seasoning is right. When our cooks list pulihora on the daily menu, you can order delivery in Tenali on WhatsApp.',
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
    relatedSlugs: ['andhra-home-food-tenali', 'homemade-lunch-delivery-tenali'],
    relatedAreaSlugs: ['tenali', 'chenchupeta'],
  },
  {
    slug: 'homemade-biryani-delivery-tenali',
    keyword: 'homemade biryani delivery Tenali',
    title: 'Homemade Biryani Delivery in Tenali | Amma Chethi Ruchulu',
    metaDescription:
      'Homemade biryani delivery in Tenali when listed on the daily menu. Order ahead on WhatsApp with Amma Chethi Ruchulu.',
    h1: 'Homemade biryani delivery in Tenali',
    intro:
      'Hotel biryani and home biryani are different. When a specialist cook lists biryani on our menu, Amma Chethi Ruchulu offers homemade biryani delivery in Tenali on a scheduled slot.',
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
    relatedSlugs: ['andhra-home-food-tenali', 'homemade-dinner-delivery-tenali'],
    relatedAreaSlugs: ['tenali', 'chenchupeta'],
  },
  {
    slug: 'vegetarian-home-food-delivery-tenali',
    keyword: 'vegetarian home food delivery Tenali',
    title: 'Vegetarian Home Food Delivery in Tenali | Amma Chethi Ruchulu',
    metaDescription:
      'Vegetarian home food delivery in Tenali. Ask for today’s veg menu on WhatsApp and order before lunch or dinner cutoff.',
    h1: 'Vegetarian home food delivery in Tenali',
    intro:
      'Want clean vegetarian home food delivery in Tenali without mystery gravy? Tell us you need vegetarian only and we will guide you to today’s veg options.',
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
    relatedSlugs: ['tiffin-delivery-tenali', 'andhra-home-food-tenali'],
    relatedAreaSlugs: ['tenali', 'chenchupeta'],
  },
  {
    slug: 'office-lunch-delivery-tenali',
    keyword: 'office lunch delivery Tenali',
    title: 'Office Lunch Delivery in Tenali | Amma Chethi Ruchulu',
    metaDescription:
      'Office lunch delivery in Tenali from home cooks. Order by 10:00 AM on WhatsApp for scheduled midday delivery — Amma Chethi Ruchulu.',
    h1: 'Office lunch delivery in Tenali',
    intro:
      'Office lunch delivery in Tenali should arrive when your break starts. Order by 10:00 AM and we schedule packing and dispatch for the midday window.',
    sections: [
      {
        heading: 'One chat for the desk team',
        body:
          'Individuals can order on WhatsApp. If a few colleagues want the same slot, mention shared delivery notes early so we can plan the Tenali drop.',
      },
      {
        heading: 'Better than random takeout roulette',
        body:
          'You get home-cooked batches with clear cutoffs instead of mystery kitchens. Try a week of lunches and keep what works.',
      },
    ],
    relatedSlugs: [
      'homemade-lunch-delivery-tenali',
      'tiffin-delivery-tenali',
      'whatsapp-food-order-tenali',
    ],
    relatedAreaSlugs: ['tenali', 'chenchupeta'],
  },
  {
    slug: 'home-kitchen-food-tenali',
    keyword: 'home kitchen food Tenali',
    title: 'Home Kitchen Food in Tenali | Amma Chethi Ruchulu',
    metaDescription:
      'Home kitchen food in Tenali from Amma Chethi Ruchulu — specialist cooks, hub packing, WhatsApp ordering for lunch and dinner.',
    h1: 'Home kitchen food in Tenali',
    intro:
      'Amma Chethi Ruchulu is based in Tenali and serves home kitchen food with a simple promise: specialist cooks, order-ahead batches, and delivery you can trust for lunch or dinner.',
    sections: [
      {
        heading: 'From home kitchen to hub to door',
        body:
          'Cooks prepare confirmed orders. We collect and pack at our hub, then riders deliver in the scheduled window across Tenali routes.',
      },
      {
        heading: 'Local by design',
        body:
          'We deliver in Tenali only. That focus lets us stay personal on WhatsApp while still running a real packing and delivery operation.',
      },
    ],
    relatedSlugs: [
      'homemade-lunch-delivery-tenali',
      'home-cooked-food-delivery-tenali',
      'scheduled-meal-delivery-tenali',
    ],
    relatedAreaSlugs: ['tenali', 'chenchupeta'],
  },
  {
    slug: 'scheduled-meal-delivery-tenali',
    keyword: 'scheduled meal delivery Tenali',
    title: 'Scheduled Meal Delivery in Tenali | Amma Chethi Ruchulu',
    metaDescription:
      'Scheduled meal delivery in Tenali. Lunch and dinner cutoffs, WhatsApp ordering, home-cooked batches — Amma Chethi Ruchulu.',
    h1: 'Scheduled meal delivery in Tenali',
    intro:
      'Scheduled meal delivery means you pick a lunch or dinner slot and we cook to that plan. Amma Chethi Ruchulu runs cutoffs so Tenali customers get intentional batches—not chaotic on-demand chaos.',
    sections: [
      {
        heading: 'Cutoffs are a feature',
        body:
          'Lunch by 10:00 AM and dinner by 4:00 PM exist so cooks, packing, and riders share one timeline. If you miss a cutoff, ask WhatsApp about the next available slot.',
      },
      {
        heading: 'Plan your week without an app maze',
        body:
          'Use WhatsApp when you need a meal. Over time you will learn which slots fit your office or family routine in Tenali.',
      },
    ],
    relatedSlugs: [
      'homemade-dinner-delivery-tenali',
      'whatsapp-food-order-tenali',
      'office-lunch-delivery-tenali',
    ],
    relatedAreaSlugs: ['tenali', 'chenchupeta'],
  },
];

export function getTopic(slug: string): Topic | undefined {
  return topics.find((t) => t.slug === slug);
}

export function getTopicsBySlugs(slugs: string[]): Topic[] {
  return slugs.map((s) => getTopic(s)).filter((t): t is Topic => Boolean(t));
}
