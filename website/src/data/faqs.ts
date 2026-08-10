export type FaqItem = { question: string; answer: string };

/** Site-wide FAQs — PAA-style questions first (local-biz-dev rule) */
export const homeFaqs: FaqItem[] = [
  {
    question: 'How do I order home cooked food from Amma Chethi Ruchulu?',
    answer:
      'Message us on WhatsApp for today’s menu, pick lunch or dinner, share your Tenali delivery area, and place the order before the cutoff. We confirm, cook in limited batches, pack at our hub, and deliver in the scheduled window.',
  },
  {
    question: 'What are the lunch and dinner order cutoffs?',
    answer:
      'Lunch orders should be placed by 10:00 AM (served roughly 12–3 PM). Dinner orders should be placed by 4:00 PM (served roughly 7–10 PM). Exact windows can vary by area and batch size — we confirm on WhatsApp.',
  },
  {
    question: 'Where do you deliver?',
    answer:
      'We deliver in Tenali, including Chenchupeta. Message us your locality or landmark on WhatsApp and we will confirm if we can deliver that day.',
  },
  {
    question: 'Is the food restaurant food or home kitchen cooking?',
    answer:
      'We work with specialist home cooks known for signature dishes — not a restaurant rush kitchen. Meals are prepared in limited batches after you order ahead, then collected and packed at our hub before delivery.',
  },
  {
    question: 'Can I order only vegetarian meals?',
    answer:
      'Yes. Daily menus often include vegetarian Andhra home food. Ask on WhatsApp for today’s vegetarian options before you place the order.',
  },
  {
    question: 'How is payment handled?',
    answer:
      'We share payment instructions on WhatsApp (typically UPI or a payment link). Your order is confirmed after payment and cutoff rules are met.',
  },
];
