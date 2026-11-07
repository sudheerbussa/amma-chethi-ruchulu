# Amma Chethi Ruchulu — Menu poster pack

**Source:** `order-bot/src/menu.js` (MENU_VERSION 7) · active items only  
**Order:** WhatsApp → **Hi** or **MENU** → Lunch / Dinner → pick category  
**Bot URL:** https://order.ammachethiruchulu.co.in  
**Support:** +91 98235 83498 (9823583498)  

---

## Poster inventory (7 images)

| # | File name | Category | Upload slot (admin) |
|---|-----------|----------|---------------------|
| 0 | `ACR_POSTER_00_Master.png` | Overview + how to order | Share on status / groups |
| 1 | `ACR_POSTER_01_Veg.png` | Veg curries | Weekday or specials |
| 2 | `ACR_POSTER_02_Nonveg_EggsChicken.png` | Non-veg (everyday) | Weekday |
| 3 | `ACR_POSTER_03_Nonveg_Premium.png` | Non-veg (fish / mutton / bulk) | Weekday |
| 4 | `ACR_POSTER_04_RiceMeals.png` | Rice, meals & family packs | Weekday |
| 5 | `ACR_POSTER_05_PartyPacks_KG.png` | KG party packs (P01–P04) | **Specials** slot |
| 6 | `ACR_POSTER_06_OrderCTA.png` | Order steps + QR | Share anywhere |

**Generate all PNGs:**  
```bash
cd order-bot
python3 scripts/build_acr_menu_posters.py
# Output → order-bot/assets/posters/generated/
```

---

## Design system (all posters)

| Element | Spec |
|---------|------|
| Size | **1080 × 1350 px** (portrait, WhatsApp-friendly) |
| Safe margin | 48 px all sides |
| Background | Cream `#FFF8F0` |
| Header band | Maroon `#8B1A1A` + gold line `#E8A317` |
| Veg accent | Green `#2D6A4F` |
| Non-veg accent | Red `#C1121F` |
| Body text | Dark brown `#2C1810` |
| Muted | `#6B5344` |
| Price | Bold maroon, prefix `₹` |
| Fonts | Noto Sans Telugu + DejaVu Sans (script falls back on server) |
| Footer (every poster) | `Order on WhatsApp · Tenali delivery · Amma chethi ruchulu` |
| Logo | ACR wordmark or kitchen photo strip (top-left chip) |

**Telugu tagline (header sub):**  
`అమ్మ చేతి రుచులు · Tenali homely Andhra food`

---

## Poster 0 — Master menu overview

**Headline:**  
`AMMA CHETHI RUCHULU`  
`Today's homely Andhra kitchen`

**Sub:**  
Fresh lunch & dinner · Tenali delivery · Cooked by our Ammalu

**Category tiles (4 boxes):**

| Tile | Title | Hook |
|------|-------|------|
| 🟢 | Veg curries | Pappu · fry · curry from ₹30 |
| 🔴 | Non-veg | Egg · chicken · fish · mutton |
| 🍚 | Rice & meals | Meals from ₹100 · family packs |
| 🍱 | Party packs | 2–5 KG · 15–48 guests |

**How to order (5 steps):**  
1. Save **9823583498** (WhatsApp business)  
2. Send **Hi** or **MENU**  
3. Tap **Lunch** or **Dinner**  
4. Pick category → dish → qty → address  
5. Pay online · track on WhatsApp  

**Footer strip:**  
`order.ammachethiruchulu.co.in` · QR to WhatsApp  

**WhatsApp caption script:**  
```
🍛 Amma Chethi Ruchulu — Tenali homely Andhra food

Veg · Non-veg · Meals · Party packs
Fresh lunch & dinner · local delivery

📲 Order: WhatsApp Hi to 9823583498
🌐 order.ammachethiruchulu.co.in

#Tenali #AndhraFood #HomelyFood #AmmaChethiRuchulu
```

---

## Poster 1 — Veg curries 🟢

**Headline:** `VEG CURRIES`  
**Sub:** `Homely Andhra · one portion · lunch & dinner`

| Item | Price | Cook |
|------|-------|------|
| Tomato Pappu | ₹30 | Lakshmi |
| Dosakaya Pappu | ₹30 | Lakshmi |
| Thotakura Pappu | ₹30 | Lakshmi |
| Bendakaya Fry | ₹30 | Padma |
| Aloo Fry | ₹30 | Padma |
| Beans-Carrot Curry | ₹30 | Padma |
| Mixed Veg Curry | ₹30 | Saroja |
| Gutti Vankaya | ₹40 | Padma |

**Footnote:** Portions for 1 person · pair with rice or meals  
**Telugu line:** `ఇంటి వంటకం · తాజా · రోజూ`

**WhatsApp caption:**  
```
🟢 Veg curries — Amma Chethi Ruchulu

Pappu, fry & curry from ₹30
Fresh homely Andhra · Tenali delivery

📲 WhatsApp Hi → Lunch/Dinner → Veg
9823583498
```

---

## Poster 2 — Non-veg: Eggs & chicken 🔴

**Headline:** `NON-VEG — EVERYDAY`  
**Sub:** `Eggs & chicken · homely spice`

| Item | Price |
|------|-------|
| Egg Omlet | ₹25 |
| Egg Fry | ₹40 |
| Egg Bhurji | ₹40 |
| Double Egg Omlet | ₹40 |
| Egg Curry (2 eggs) | ₹60 |
| Chicken Curry (Andhra) | ₹90 |
| Gongura Chicken | ₹90 |
| Chicken Fry | ₹120 |

**Highlight box:** `Most ordered: Chicken Curry · Gongura Chicken`

**WhatsApp caption:**  
```
🔴 Non-veg everyday — eggs & chicken

From ₹25 · Andhra homely taste
Order lunch or dinner on WhatsApp

📲 Hi → Non-veg · 9823583498
```

---

## Poster 3 — Non-veg: Fish, mutton & bulk 🔴

**Headline:** `NON-VEG — PREMIUM`  
**Sub:** `Fish · mutton · party-size portions`

| Item | Price |
|------|-------|
| Chepala Pulusu (2 pcs) | ₹100 |
| Chepala Kura (2 pcs) | ₹100 |
| Royyala Kura (250g) | ₹200 |
| Boti Kura (250g) | ₹250 |
| Boti Fry (250g) | ₹250 |
| Mutton Fry (250g) | ₹200 |
| Dabba Fry (250g) | ₹200 |
| Chicken Kura (500g) | ₹400 |
| Chicken Fry (500g) | ₹400 |
| Mutton Kura (250g) | ₹400 |
| Talakaya Kura (250g) | ₹400 |
| Peetalu Fry (500g) | ₹400 |

**Footnote:** Premium items — limited portions daily · order early

**WhatsApp caption:**  
```
🐟🍖 Premium non-veg — fish, mutton & bulk chicken

Chepala to mutton · 250g–500g packs
Amma Chethi Ruchulu · Tenali

📲 Hi → Non-veg (page 2) · 9823583498
```

---

## Poster 4 — Rice, meals & family packs 🍚

**Headline:** `RICE & MEALS`  
**Sub:** `Complete plates · rice bowls · family packs (4)`

**Rice**

| Item | Price |
|------|-------|
| Plain Rice (1 bowl) | ₹40 |
| Curd Rice | ₹60 |
| Lemon Rice | ₹70 |
| Tomato Rice | ₹70 |

**Meals (single)**

| Item | Price | Includes |
|------|-------|----------|
| Veg Meal | ₹100 | Rice + 2 curries + pappu + pickle + papad |
| Non-Veg Meal | ₹130 | Rice + chicken + pappu + pickle |
| Special Amma Meal | ₹190 | Rice + veg + nonveg + pappu + curd + pickle |

**Family packs (serves 4)** — under Meals in bot

| Item | Price |
|------|-------|
| Veg Party Pack (4) | ₹549 |
| Non-Veg Party Pack (4) | ₹649 |
| Special Amma Pack (4) | ₹749 |
| Mutton Party Pack (4) | ₹899 |

**WhatsApp caption:**  
```
🍚 Rice & meals — from ₹40

Veg meal ₹100 · Non-veg ₹130 · Amma special ₹190
Family packs for 4 — up to ₹899

📲 Hi → Rice & meals · 9823583498
```

---

## Poster 5 — KG party packs 🍱

**Headline:** `PARTY PACKS`  
**Sub:** `Chicken KG packs · functions · Sunday party orders`

**Includes (all sizes):**  
Chicken Curry + Chicken Fry + Biryani Rice + Onion & Lemon Salad + Raitha + Kaliya

| Pack | Price | Serves | Contents |
|------|-------|--------|----------|
| 2 KG Party Pack | ₹3,699 | 15–20 | 2KG curry + 2KG fry + 4KG rice |
| 3 KG Party Pack | ₹5,349 | 22–28 | 3KG curry + 3KG fry + 6KG rice |
| 4 KG Party Pack | ₹6,999 | 30–38 | 4KG curry + 4KG fry + 8KG rice |
| 5 KG Jumbo | ₹8,549 | 38–48 | 5KG curry + 5KG fry + 10KG rice |

**Telugu note (from menu):**  
`15–48 మందికి · పార్టీ · సంబరాలు · Sunday dinner party orders`

**Admin:** Upload as **Specials** poster in Admin → Posters.

**WhatsApp caption:**  
```
🍱 PARTY PACKS — 2 to 5 KG

₹3,699 – ₹8,549 · 15 to 48 guests
Full chicken spread + biryani rice

📲 Order: Hi → Party Packs
Sunday party orders welcome · 9823583498
```

---

## Poster 6 — Order CTA

**Headline:** `ORDER IN 30 SECONDS`  
**Sub:** `No app · WhatsApp only`

**Steps (large numbers):**  
1. **Save** 9823583498  
2. Send **Hi**  
3. **Lunch** or **Dinner**  
4. **Pick items** — category → dishes · add more  
5. Share location · **Pay**  
6. **Track** on WhatsApp  

**Trust lines:**  
✓ Homely Andhra · Amma kitchen  
✓ Tenali delivery (0–3 / 3–6 / 6+ km)  
✓ Online pay · status updates  

**Website (footer):** `ammachethiruchulu.co.in` — brand / menu info (ordering is WhatsApp only)  
**QR:** Link to `https://wa.me/919823583498?text=Hi`

**WhatsApp caption:**  
```
📲 Order Amma Chethi Ruchulu on WhatsApp

1. Save 9823583498
2. Send Hi
3. Lunch or Dinner
4. Pick items (add more before checkout)
5. Share location · pay

Tenali homely food · no app needed
```

---

## Delivery & offers (small print — all posters)

Use one line at bottom (update when offers change):

```
Delivery Tenali: 0–3 km ₹30 · 3–6 km ₹45 · 6+ km ₹60
Free delivery on food above ₹300 (when offer active)
Lunch order by 11 AM · Dinner by 5 PM IST
Sunday: party packs dinner only · Saturday dinner open
```

---

## Weekday poster rotation (optional)

If you use **Admin → Posters → daily weekday** slots instead of category posters:

| Day | Suggested focus |
|-----|-----------------|
| Monday | Veg + Rice poster crop |
| Tuesday | Non-veg everyday |
| Wednesday | Meals highlight |
| Thursday | Non-veg premium |
| Friday | Party packs teaser |
| Saturday | Full master overview |
| Sunday | Party packs only (party-order day) |

Category posters (this doc) are better for **status, groups, and printing**; weekday slots stay for **today's menu photo** if you shoot fresh food daily.

---

## Script reference

| Script | Purpose |
|--------|---------|
| `scripts/build_acr_menu_posters.py` | Auto-build all 7 PNGs from menu data |
| `src/posters.js` | WhatsApp bot sends weekday + specials images |

After generating, compress JPEG ≤ 5 MB for admin upload:
```bash
# Example compress one file (optional)
convert assets/posters/generated/ACR_POSTER_01_Veg.png -quality 88 assets/posters/veg.jpg
```

---

*Generated from live menu v7 · update this doc when MENU_VERSION bumps.*
