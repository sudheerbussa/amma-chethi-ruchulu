#!/usr/bin/env python3
"""
Generate Amma Chethi Ruchulu category menu posters (1080×1350 PNG).
Content mirrors order-bot/docs/MENU_POSTERS.md and src/menu.js v7.

Usage:
  python3 scripts/build_acr_menu_posters.py
  python3 scripts/build_acr_menu_posters.py --out assets/posters/generated
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / "assets" / "posters" / "generated"
PUBLIC_WEBSITE = "ammachethiruchulu.co.in"
ORDER_BOT_HOST = "order.ammachethiruchulu.co.in"

# Brand
CREAM = (255, 248, 240)
MAROON = (139, 26, 26)
GOLD = (232, 163, 23)
INK = (44, 24, 16)
MUTED = (107, 83, 68)
GREEN = (45, 106, 79)
RED = (193, 18, 31)
WHITE = (255, 255, 255)

W, H = 1080, 1350
MARGIN = 48

PACK_CONTENTS = (
    "Chicken Curry + Chicken Fry + Biryani Rice + "
    "Onion & Lemon Salad + Raitha + Kaliya"
)

# Active menu snapshot (menu.js v7)
MENU = {
    "veg": [
        ("Tomato Pappu", 30, "Lakshmi"),
        ("Dosakaya Pappu", 30, "Lakshmi"),
        ("Thotakura Pappu", 30, "Lakshmi"),
        ("Bendakaya Fry", 30, "Padma"),
        ("Aloo Fry", 30, "Padma"),
        ("Beans-Carrot Curry", 30, "Padma"),
        ("Mixed Veg Curry", 30, "Saroja"),
        ("Gutti Vankaya", 40, "Padma"),
        ("Mushroom Curry", 80, "Saroja"),
        ("Mushroom Biryani", 160, "Sujatha"),
        ("Soya / Mealmaker Biryani", 120, "Sujatha"),
    ],
    "nonveg_everyday": [
        ("Egg Omlet", 25),
        ("Egg Fry", 40),
        ("Egg Bhurji", 40),
        ("Double Egg Omlet", 40),
        ("Egg Curry (2 eggs)", 60),
        ("Chicken Curry (Andhra)", 90),
        ("Gongura Chicken", 90),
        ("Chicken Fry", 120),
    ],
    "nonveg_premium": [
        ("Chepala Pulusu (2 pcs)", 100),
        ("Chepala Kura (2 pcs)", 100),
        ("Royyala Kura (250g)", 200),
        ("Mutton Fry (250g)", 200),
        ("Dabba Fry (250g)", 200),
        ("Chicken Kura (500g)", 400),
        ("Chicken Fry (500g)", 400),
        ("Mutton Kura (250g)", 400),
        ("Peetalu Fry (500g)", 400),
    ],
    "rice": [
        ("Plain Rice (1 bowl)", 40),
        ("Jeera Rice", 70),
        ("Lemon Rice", 70),
        ("Tomato Rice", 70),
    ],
    "meals": [
        ("Veg Meal", 100, "Rice + 2 curries + pappu + pickle + papad"),
        ("Non-Veg Meal", 130, "Rice + chicken + pappu + pickle"),
        ("Special Amma Meal", 190, "Rice + veg + nonveg + pappu + curd + pickle"),
    ],
    "family": [
        ("Veg Party Pack (4)", 549),
        ("Non-Veg Party Pack (4)", 649),
        ("Special Amma Pack (4)", 749),
        ("Mutton Party Pack (4)", 899),
    ],
    "party_kg": [
        ("2 KG Party Pack", 3699, "15–20 guests · 2KG+2KG+4KG rice"),
        ("3 KG Party Pack", 5349, "22–28 guests · 3KG+3KG+6KG rice"),
        ("4 KG Party Pack", 6999, "30–38 guests · 4KG+4KG+8KG rice"),
        ("5 KG Jumbo Party Pack", 8549, "38–48 guests · 5KG+5KG+10KG rice"),
    ],
}


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    paths = [
        "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for p in paths:
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def rupees(n: int) -> str:
    return f"₹{n:,}" if n >= 1000 else f"₹{n}"


def new_canvas() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new("RGB", (W, H), CREAM)
    return img, ImageDraw.Draw(img)


def header(draw: ImageDraw.ImageDraw, title: str, subtitle: str, accent: tuple[int, int, int]) -> int:
    draw.rectangle((0, 0, W, 200), fill=MAROON)
    draw.rectangle((0, 200, W, 208), fill=GOLD)
    draw.text((MARGIN, 36), "AMMA CHETHI RUCHULU", font=font(22, True), fill=GOLD)
    draw.text((MARGIN, 68), title, font=font(44, True), fill=WHITE)
    draw.text((MARGIN, 128), subtitle, font=font(20), fill=(220, 200, 190))
    # accent dot
    draw.ellipse((W - MARGIN - 24, 48, W - MARGIN, 72), fill=accent)
    return 230


def footer(draw: ImageDraw.ImageDraw, y: int = 1260, website: str = ORDER_BOT_HOST) -> None:
    draw.rectangle((0, y, W, H), fill=MAROON)
    draw.text((MARGIN, y + 24), "Order on WhatsApp · Tenali delivery", font=font(20, True), fill=WHITE)
    draw.text((MARGIN, y + 58), f"9823583498  ·  {website}", font=font(18), fill=GOLD)


def menu_rows(
    draw: ImageDraw.ImageDraw,
    items: list,
    y: int,
    *,
    show_cook: bool = False,
    cols: int = 1,
    row_h: int = 52,
) -> int:
    col_w = (W - 2 * MARGIN) // cols
    for i, row in enumerate(items):
        col = i % cols
        row_idx = i // cols
        x = MARGIN + col * col_w
        yy = y + row_idx * row_h
        if show_cook:
            name, price, cook = row
            draw.text((x, yy), name, font=font(22), fill=INK)
            draw.text((x + col_w - 10, yy), rupees(price), font=font(22, True), fill=MAROON, anchor="ra")
            draw.text((x, yy + 26), f"· {cook}", font=font(14), fill=MUTED)
        elif len(row) == 3:
            name, price, note = row
            draw.text((x, yy), name, font=font(21, True), fill=INK)
            draw.text((x + col_w - 10, yy), rupees(price), font=font(21, True), fill=MAROON, anchor="ra")
            draw.text((x, yy + 28), note, font=font(13), fill=MUTED)
        else:
            name, price = row
            draw.text((x, yy), name, font=font(22), fill=INK)
            draw.text((x + col_w - 10, yy), rupees(price), font=font(22, True), fill=MAROON, anchor="ra")
    rows = (len(items) + cols - 1) // cols
    return y + rows * row_h + 16


def section_title(draw: ImageDraw.ImageDraw, y: int, text: str) -> int:
    draw.text((MARGIN, y), text, font=font(18, True), fill=MAROON)
    draw.line((MARGIN, y + 28, W - MARGIN, y + 28), fill=GOLD, width=2)
    return y + 40


def poster_master(out: Path) -> None:
    img, draw = new_canvas()
    y = header(draw, "TODAY'S MENU", "Tenali homely Andhra · lunch & dinner", GOLD)
    tiles = [
        ("🟢 VEG", "Pappu · fry · curry\nfrom ₹30", GREEN),
        ("🔴 NON-VEG", "Egg · chicken · fish\n· mutton", RED),
        ("🍚 MEALS", "Meals from ₹100\nfamily packs", MAROON),
        ("🍱 PARTY", "2–5 KG packs\n15–48 guests", GOLD),
    ]
    tw, th = 480, 200
    for i, (t, b, c) in enumerate(tiles):
        x = MARGIN + (i % 2) * (tw + 24)
        yy = y + (i // 2) * (th + 20)
        draw.rounded_rectangle((x, yy, x + tw, yy + th), radius=16, fill=WHITE, outline=c, width=3)
        draw.text((x + 20, yy + 20), t, font=font(26, True), fill=c)
        draw.text((x + 20, yy + 70), b, font=font(18), fill=INK)
    y2 = y + 460
    draw.text((MARGIN, y2), "HOW TO ORDER", font=font(22, True), fill=MAROON)
    steps = [
        "1  Save 9823583498 on WhatsApp",
        "2  Send Hi or MENU",
        "3  Tap Lunch or Dinner",
        "4  Pick category → dish → pay",
        "5  Track status on chat",
    ]
    for i, s in enumerate(steps):
        draw.text((MARGIN, y2 + 40 + i * 36), s, font=font(20), fill=INK)
    footer(draw)
    img.save(out, "PNG", optimize=True)
    print("Wrote", out)


def poster_veg(out: Path) -> None:
    img, draw = new_canvas()
    y = header(draw, "VEG CURRIES", "Homely Andhra · one portion · lunch & dinner", GREEN)
    y = menu_rows(draw, MENU["veg"], y, show_cook=True)
    draw.text((MARGIN, y + 8), "ఇంటి వంటకం · తాజా · రోజూ", font=font(18), fill=MUTED)
    draw.text((MARGIN, y + 40), "Pair with rice or meals · portions for 1 person", font=font(16), fill=MUTED)
    footer(draw)
    img.save(out, "PNG", optimize=True)
    print("Wrote", out)


def poster_nonveg_everyday(out: Path) -> None:
    img, draw = new_canvas()
    y = header(draw, "NON-VEG — EVERYDAY", "Eggs & chicken · homely spice", RED)
    y = menu_rows(draw, MENU["nonveg_everyday"], y)
    draw.rounded_rectangle((MARGIN, y + 8, W - MARGIN, y + 72), radius=12, fill=(255, 240, 235))
    draw.text((MARGIN + 16, y + 24), "⭐ Most ordered: Chicken Curry · Gongura Chicken", font=font(18, True), fill=RED)
    footer(draw)
    img.save(out, "PNG", optimize=True)
    print("Wrote", out)


def poster_nonveg_premium(out: Path) -> None:
    img, draw = new_canvas()
    y = header(draw, "NON-VEG — PREMIUM", "Fish · mutton · bulk portions", RED)
    y = menu_rows(draw, MENU["nonveg_premium"], y, cols=1, row_h=48)
    draw.text((MARGIN, y), "Limited portions daily · order early", font=font(16), fill=MUTED)
    footer(draw)
    img.save(out, "PNG", optimize=True)
    print("Wrote", out)


def poster_meals(out: Path) -> None:
    img, draw = new_canvas()
    y = header(draw, "RICE & MEALS", "Bowls · complete plates · family packs (4)", MAROON)
    y = section_title(draw, y, "RICE")
    y = menu_rows(draw, MENU["rice"], y)
    y = section_title(draw, y + 12, "MEALS (single)")
    y = menu_rows(draw, MENU["meals"], y)
    y = section_title(draw, y + 8, "FAMILY PACKS — serves 4")
    y = menu_rows(draw, MENU["family"], y, row_h=44)
    footer(draw)
    img.save(out, "PNG", optimize=True)
    print("Wrote", out)


def poster_party(out: Path) -> None:
    img, draw = new_canvas()
    y = header(draw, "PARTY PACKS", "Chicken KG · functions · Sunday party orders", GOLD)
    draw.text((MARGIN, y), "Includes:", font=font(16, True), fill=MAROON)
    draw.text((MARGIN, y + 24), PACK_CONTENTS, font=font(14), fill=MUTED)
    y += 72
    y = menu_rows(draw, MENU["party_kg"], y, row_h=72)
    draw.text((MARGIN, y + 8), "Sunday dinner: party orders only · order on WhatsApp", font=font(16), fill=RED)
    footer(draw)
    img.save(out, "PNG", optimize=True)
    print("Wrote", out)


def poster_cta(out: Path) -> None:
    img, draw = new_canvas()
    y = header(draw, "ORDER IN 30 SECONDS", "No app · WhatsApp only", GOLD)
    steps = [
        ("1", "SAVE", "9823583498"),
        ("2", "SEND", "Hi or MENU"),
        ("3", "PICK", "Lunch or Dinner"),
        ("4", "ITEMS", "Category → dishes · add more"),
        ("5", "PAY", "Location · pay online"),
        ("6", "TRACK", "Status on WhatsApp"),
    ]
    row_h = 92
    for i, (n, verb, detail) in enumerate(steps):
        yy = y + i * row_h
        draw.ellipse((MARGIN, yy, MARGIN + 50, yy + 50), fill=MAROON)
        draw.text((MARGIN + 25, yy + 25), n, font=font(22, True), fill=WHITE, anchor="mm")
        draw.text((MARGIN + 66, yy + 6), verb, font=font(24, True), fill=INK)
        draw.text((MARGIN + 66, yy + 38), detail, font=font(18), fill=MUTED)
    y2 = y + len(steps) * row_h + 12
    for line in [
        "✓  Homely Andhra · Amma kitchen",
        "✓  Tenali delivery (0–3 / 3–6 / 6+ km)",
        "✓  Online pay · live status updates",
    ]:
        draw.text((MARGIN, y2), line, font=font(20), fill=INK)
        y2 += 36
    footer(draw, website=PUBLIC_WEBSITE)
    img.save(out, "PNG", optimize=True)
    print("Wrote", out)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build ACR category menu posters")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    out_dir: Path = args.out
    out_dir.mkdir(parents=True, exist_ok=True)

    poster_master(out_dir / "ACR_POSTER_00_Master.png")
    poster_veg(out_dir / "ACR_POSTER_01_Veg.png")
    poster_nonveg_everyday(out_dir / "ACR_POSTER_02_Nonveg_EggsChicken.png")
    poster_nonveg_premium(out_dir / "ACR_POSTER_03_Nonveg_Premium.png")
    poster_meals(out_dir / "ACR_POSTER_04_RiceMeals.png")
    poster_party(out_dir / "ACR_POSTER_05_PartyPacks_KG.png")
    poster_cta(out_dir / "ACR_POSTER_06_OrderCTA.png")
    print(f"\nDone — 7 posters in {out_dir}")
    print("See docs/MENU_POSTERS.md for captions and upload guide.")


if __name__ == "__main__":
    main()
