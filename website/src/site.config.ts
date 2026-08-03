/** Site content — edit these before Meta / go-live */
export const site = {
  nameEn: 'Amma Chethi Ruchulu',
  nameTe: 'అమ్మ చేతి రుచులు',
  tagline: 'Authentic Home Cooked Flavors',
  blurb:
    'Signature dishes from specialist home cooks in your town — ordered ahead, packed with care, delivered fresh.',
  /** Shown on website (public) — city / district level only */
  locality: 'Guntur, Andhra Pradesh',
  /** Full postal address — Udyam / Meta / FSSAI only; not shown on site */
  address: '11-4-89, Donka Road, Chenchupeta, Tenali, Guntur, Andhra Pradesh — 522202',
  /** WhatsApp Cloud API business number */
  whatsapp: '919823583498',
  whatsappDisplay: '+91 98235 83498',
  /** Business inbox (finalized) */
  email: 'order.ammachethiruchulu@gmail.com',
  cutoffs: {
    lunch: 'Order by 10:00 AM (serve 12–3 PM)',
    dinner: 'Order by 4:00 PM (serve 7–10 PM)',
  },
} as const;

export function waLink(text = 'Hi'): string {
  return `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(text)}`;
}
