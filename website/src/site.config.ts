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
  address: '4-115, Davuluru, Kollipara, Guntur, Andhra Pradesh — 522304',
  /** WhatsApp: country code + number, digits only */
  whatsapp: '918886128995',
  whatsappDisplay: '+91 88861 28995',
  /** Business inbox (finalized) */
  email: 'order.ammachethiruchulu@gmail.com',
  cutoffs: {
    lunch: 'Order by 7:00 AM',
    dinner: 'Order by 2:00 PM',
  },
} as const;

export function waLink(text = 'Hi'): string {
  return `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(text)}`;
}
