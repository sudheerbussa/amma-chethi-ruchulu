# Poster price list — Oct 2026 (menu v25)

Source of truth: `src/menu.js` (MENU_VERSION 25; v25 set B01 ₹200, B02 ₹180 to match the poster). Full active menu with notes: `docs/MENU_LIST.md`.

Patched posters (built by `scripts/patch_poster_prices.py`; supports 720×1080 and 1024×1536):

- `~/Downloads/acr-posters/updated menu3_v24.png` — 1024×1536 original, for print / social.
- `~/Downloads/acr-posters/updated_menu3_v24_vps.jpg` — 720×1080 resize of the above. **Live** on VPS as `data/posters/full_menu.jpg` since 2 Oct 2026 (previous file kept as `full_menu.pre-v24.bak`).
- `tmp-posters/full_menu_v24.jpg` — direct patch of the live JPEG (fallback).

Older full-menu designs (`updated menu.png`, `Main Menu.png`, their `_insta_45` / `_vps` copies) use the retired N-code dish list and are not patched; do not reuse them.

## Non-veg curries — changed prices

| Code | Dish | Old | New |
|---|---|---|---|
| D01 | Chicken Curry (1) | ₹120 | **₹149** |
| D02 | Chicken Curry (2) | ₹220 | **₹299** |
| D03 | Andhra Chicken Fry (1) | ₹130 | **₹159** |
| D04 | Andhra Chicken Fry (2) | ₹240 | **₹299** |
| D05 | Gongura Chicken (1) | ₹130 | **₹159** |
| D06 | Gongura Chicken (2) | ₹240 | **₹299** |
| D07 | Special Chicken Fry | ₹250 | **₹299** |
| D10 | Mutton Curry (1) | ₹240 | **₹299** |
| D11 | Mutton Curry (2) | ₹460 | **₹549** |
| D12 | Gongura Mutton (1) | ₹250 | **₹319** |
| D13 | Gongura Mutton (2) | ₹480 | **₹599** |
| D14 | Mutton Fry (1) | ₹260 | **₹329** |
| D15 | Mutton Fry (2) | ₹500 | **₹599** |
| D16 | Mutton Keema Curry (1) | ₹250 | **₹299** |
| D17 | Mutton Keema Curry (2) | ₹480 | **₹549** |
| D18 | Chepala Pulusu (2 pcs) | ₹140 | **₹159** |
| D19 | Chepala Pulusu (4 pcs) | ₹260 | **₹299** |
| D20 | Chepala Fry (1 pc) | ₹80 | **₹99** |
| D21 | Chepala Fry (2 pcs) | ₹150 | **₹179** |
| D22 | Royyala Iguru (1) — prawns gravy | ₹180 | **₹229** |
| D23 | Royyala Iguru (2) | ₹340 | **₹399** |
| D24 | Gongura Royyala (1) | ₹190 | **₹239** |
| D25 | Gongura Royyala (2) | ₹360 | **₹429** |
| D26 | Pacchi Royyala Fry (1) | ₹190 | **₹239** |
| D27 | Pacchi Royyala Fry (2) | ₹360 | **₹429** |
| D32 | Chicken Kura (500g) | ₹400 | **₹499** |
| D33 | Chicken Fry (500g) | ₹400 | **₹499** |

## Non-veg curries — unchanged

| Code | Dish | Price |
|---|---|---|
| D08 | Chicken Liver & Gizzard Fry (1) | ₹100 |
| D09 | Chicken Liver & Gizzard Fry (2) | ₹180 |
| D28 | Egg Curry (2 eggs) — Kodiguddu pulusu | ₹70 |
| D29 | Egg Fry / Bhurji | ₹70 |
| D30 | Double Egg Omelette | ₹40 |
| D31 | Dabba Fry (250g) | ₹200 |
| D34 | Mutton Kura (250g) | ₹400 |
| D35 | Peetalu Fry (500g) | ₹400 |

## Other sections (current prices, for a full redesign)

**Rice & meals:** Plain Rice (1 bowl) ₹40 · Jeera Rice ₹70 · Veg Meal ₹100 · Non-Veg Meal ₹130 · Special Amma Meal ₹190 · Chapathi + veg curry + pappu ₹90 · Chapathi + chicken + pappu ₹130 · Chapathi (1) ₹10

**Biryanis:** Mushroom ₹200 · Soya / Mealmaker ₹180 · Paneer ₹300 · Chicken Dum (1) ₹159 ~~₹180~~ · (2) ₹299 ~~₹340~~ · (4) ₹549 ~~₹650~~ · Spl Chicken Fry (1) ₹179 ~~₹200~~ · (2) ₹329 ~~₹380~~ · (4) ₹599 ~~₹720~~

**Veg specials:** Mushroom Curry ₹80

**Party packs:** 2 KG ₹3699 · 3 KG ₹5349 · 4 KG ₹6999 · 5 KG ₹8549

**Student menu:** curry combos and rice specials ₹80 each · add-ons ₹25 (see `MENU_LIST.md`)

## Known mismatches still on the live poster (not patched)

- Lemon Rice (A03) and Tomato Rice (A04) are still listed; both are retired (now Student S10 / S11 @ ₹80).
- Chapathi meals (A08–A10) and the Student menu are not on the poster.
