#!/usr/bin/env python3
"""Overwrite non-veg prices on the AI-designed full_menu poster (720x1080 or 1024x1536 original).

Keeps the original ₹ glyph; replaces only the digits to its right.
Usage: python3 scripts/patch_poster_prices.py tmp-posters/full_menu.jpg tmp-posters/full_menu_v24.jpg
"""
import sys

from PIL import Image, ImageDraw, ImageFont

FONT = "/usr/share/fonts/truetype/noto/NotoSans-CondensedSemiBold.ttf"
INK = (44, 42, 22)
SS = 6

# Per image size: D01..D35 digit rows (y_top, y_bottom), digit x start, erase x end.
# Rows detected from the poster pixels; the ₹ glyph sits just left of x0.
LAYOUTS = {
    (720, 1080): {  # live VPS upload (full_menu.jpg / updated_menu3_vps.jpg)
        "rows": [
            (328, 335), (342, 349), (359, 366), (373, 380), (388, 395), (403, 410), (418, 425),
            (432, 441), (446, 455), (463, 470), (477, 484), (493, 500), (507, 514), (523, 530),
            (537, 544), (552, 559), (566, 573), (583, 590), (609, 616), (624, 631), (649, 656),
            (663, 670), (687, 694), (700, 707), (713, 720), (727, 734), (741, 748), (756, 764),
            (783, 790), (797, 804), (822, 829), (836, 843), (850, 857), (864, 871), (878, 885),
        ],
        "x0": 675,
        "x1": 693,
    },
    (1024, 1536): {  # original "updated menu3.png"
        "rows": [
            (466, 477), (487, 497), (511, 522), (531, 541), (552, 563), (573, 583), (595, 605),
            (615, 625), (634, 645), (659, 670), (678, 689), (701, 712), (721, 732), (743, 754),
            (764, 774), (785, 795), (805, 815), (829, 840), (866, 876), (888, 898), (923, 933),
            (943, 953), (977, 987), (995, 1006), (1014, 1024), (1033, 1044), (1053, 1063),
            (1076, 1086), (1114, 1124), (1134, 1144), (1169, 1179), (1189, 1200), (1209, 1220),
            (1229, 1239), (1249, 1259),
        ],
        "x0": 959,
        "erase_x0": 959,
        "x1": 988,
        "font": "/usr/share/fonts/truetype/noto/NotoSans-CondensedBold.ttf",
    },
}
CODES = [f"D{i:02d}" for i in range(1, 36)]

NEW_PRICES = {
    "D01": 149, "D02": 299, "D03": 159, "D04": 299, "D05": 159, "D06": 299, "D07": 299,
    "D10": 299, "D11": 549, "D12": 319, "D13": 599, "D14": 329, "D15": 599, "D16": 299,
    "D17": 549, "D18": 159, "D19": 299, "D20": 99, "D21": 179, "D22": 229, "D23": 399,
    "D24": 239, "D25": 429, "D26": 239, "D27": 429, "D32": 499, "D33": 499,
}


def erase(img, x0, y0, x1, y1):
    """Fill box with vertical interpolation between the clean rows just outside it."""
    px = img.load()
    top, bot = y0 - 2, y1 + 2
    for x in range(x0, x1 + 1):
        a, b = px[x, top], px[x, bot]
        for y in range(y0 - 1, y1 + 2):
            t = (y - top) / (bot - top)
            px[x, y] = tuple(round(a[i] * (1 - t) + b[i] * t) for i in range(3))


def draw_digits(img, text, x0, y0, y1, font_path=FONT):
    h = y1 - y0 + 1
    font_size = 10
    while True:
        f = ImageFont.truetype(font_path, font_size * SS)
        bb = f.getbbox("0")
        if bb[3] - bb[1] >= h * SS:
            break
        font_size += 0.25
    bb = f.getbbox(text)
    w, th = bb[2] - bb[0], bb[3] - bb[1]
    layer = Image.new("RGBA", (w + 2 * SS, th + 2 * SS), (0, 0, 0, 0))
    ImageDraw.Draw(layer).text((SS - bb[0], SS - bb[1]), text, font=f, fill=INK + (255,))
    small = layer.resize((max(1, round(layer.width / SS)), max(1, round(layer.height / SS))), Image.LANCZOS)
    img.paste(small, (x0 - 1, y0 - 1), small)


def main(src, dst):
    img = Image.open(src).convert("RGB")
    layout = LAYOUTS.get(img.size)
    if not layout:
        sys.exit(f"no layout for size {img.size}; supported: {list(LAYOUTS)}")
    for code, (y0, y1) in zip(CODES, layout["rows"]):
        if code not in NEW_PRICES:
            continue
        erase(img, layout.get("erase_x0", layout["x0"]), y0, layout["x1"], y1)
        draw_digits(img, str(NEW_PRICES[code]), layout["x0"], y0, y1, layout.get("font", FONT))
    img.save(dst, quality=95)
    print("wrote", dst)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
