#!/usr/bin/env python3
"""Two creative Korvia-themed posters for WhatsApp Order & Booking System.
Does NOT overwrite PRICE_POSTER_*.png
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

ROOT = Path(__file__).resolve().parents[2]
PITCH = Path(__file__).resolve().parents[1] / "pitch"
OUT = PITCH / "meta-ads"
LOGO = ROOT / "korvia-logo.jpeg"
OFFICIAL = PITCH / "storyset-assets" / "official"
QR = PITCH / "wa-discovery-qr.png"

NAVY = (10, 25, 47)
NAVY2 = (15, 35, 64)
ORANGE = (255, 102, 0)
ORANGE2 = (255, 140, 50)
WHITE = (255, 255, 255)
LIGHT = (245, 247, 250)
MUTED = (110, 120, 135)
INK = (20, 30, 45)
TEAL = (14, 122, 110)


def fnt(size, bold=False):
    paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for p in paths:
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def rr(draw, box, r, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


def load_logo(max_w=160):
    im = Image.open(LOGO).convert("RGB")
    # crop near-white margins a bit
    w, h = im.size
    ratio = max_w / w
    return im.resize((max_w, int(h * ratio)), Image.Resampling.LANCZOS)


def fit_cover(path, tw, th):
    im = Image.open(path).convert("RGB")
    # cover crop
    scale = max(tw / im.width, th / im.height)
    nw, nh = int(im.width * scale), int(im.height * scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - tw) // 2
    top = (nh - th) // 2
    return im.crop((left, top, left + tw, top + th))


def fit_contain(path, tw, th, bg=WHITE):
    im = Image.open(path).convert("RGBA")
    scale = min(tw / im.width, th / im.height)
    nw, nh = max(1, int(im.width * scale)), max(1, int(im.height * scale))
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (tw, th), bg)
    canvas.paste(im.convert("RGB"), ((tw - nw) // 2, (th - nh) // 2))
    return canvas


def paste(base, piece, xy):
    base.paste(piece, xy)


def header_bar(img, draw, title_line1, title_line2, subtitle):
    W = img.width
    draw.rectangle((0, 0, W, 168), fill=NAVY)
    draw.rectangle((0, 168, W, 176), fill=ORANGE)
    logo = load_logo(130)
    chip = Image.new("RGB", (logo.width + 16, logo.height + 16), WHITE)
    chip.paste(logo, (8, 8))
    paste(img, chip, (36, 20))
    x = 36 + chip.width + 24
    draw.text((x, 32), title_line1, font=fnt(34, True), fill=WHITE)
    draw.text((x, 74), title_line2, font=fnt(34, True), fill=ORANGE2)
    draw.text((x, 122), subtitle, font=fnt(16), fill=(180, 195, 210))


def footer_cta(img, draw, y):
    W, H = img.size
    draw.rectangle((0, y, W, H), fill=NAVY)
    # subtle dots
    for i in range(0, W, 18):
        for j in range(y, H, 18):
            if (i // 18 + j // 18) % 3 == 0:
                draw.point((i, j), fill=(25, 45, 75))
    draw.text((48, y + 28), "Let’s put your business on WhatsApp — the smart way.", font=fnt(22, True), fill=WHITE)
    rr(draw, (48, y + 78, 430, y + 138), 28, ORANGE)
    draw.text((239, y + 108), "BOOK A FREE DEMO", font=fnt(20, True), fill=WHITE, anchor="mm")
    draw.text((460, y + 88), "WhatsApp  +91 80552 92935", font=fnt(18, True), fill=WHITE)
    draw.text((460, y + 118), "korviapartners@gmail.com", font=fnt(16), fill=(190, 200, 210))
    if QR.exists():
        qr = Image.open(QR).convert("RGB").resize((110, 110), Image.Resampling.LANCZOS)
        paste(img, qr, (W - 150, y + 40))


# ─── POSTER 1: System story ─────────────────────────────────────


def poster_system():
    W, H = 1080, 1350
    img = Image.new("RGB", (W, H), LIGHT)
    draw = ImageDraw.Draw(img)
    header_bar(
        img,
        draw,
        "WhatsApp Order",
        "& Booking System",
        "Your Problem. Our Solution.  ·  Korvia Partners",
    )

    # headline
    draw.text((48, 200), "YOUR CUSTOMERS ARE", font=fnt(28, True), fill=INK)
    draw.text((48, 240), "ALREADY ON WHATSAPP.", font=fnt(36, True), fill=ORANGE)
    draw.text((48, 295), "Turn chat chaos into orders, bookings,\npayments & live status updates.", font=fnt(20), fill=MUTED)

    # left storyset
    art = fit_contain(OFFICIAL / "01-hero-mobile-marketing.png", 480, 380, LIGHT)
    paste(img, art, (40, 370))

    # right: 5 steps
    steps = [
        ("01", "Customer opens WhatsApp"),
        ("02", "Picks item or time slot"),
        ("03", "Confirms & pays"),
        ("04", "You get a clear ops board"),
        ("05", "Status updates on chat"),
    ]
    sx, sy = 540, 370
    rr(draw, (520, 360, 1040, 760), 24, WHITE)
    draw.text((545, 380), "HOW IT WORKS", font=fnt(16, True), fill=ORANGE)
    for i, (n, t) in enumerate(steps):
        y = 420 + i * 62
        draw.ellipse((545, y, 585, y + 40), fill=NAVY if i % 2 == 0 else ORANGE)
        draw.text((565, y + 20), n, font=fnt(14, True), fill=WHITE, anchor="mm")
        draw.text((605, y + 10), t, font=fnt(18, True), fill=INK)

    # three benefit tiles
    tiles = [
        ("Official Meta WhatsApp", "Safe, business-ready API — not unofficial bots"),
        ("Orders + Bookings", "Food, clinics, salons, laundry, local shops"),
        ("Payments & Tracking", "UPI / checkout + status back to the customer"),
    ]
    for i, (h, b) in enumerate(tiles):
        x = 40 + i * 340
        rr(draw, (x, 790, x + 320, 980), 20, NAVY if i != 1 else ORANGE)
        draw.text((x + 24, 820), h, font=fnt(18, True), fill=WHITE)
        draw.text((x + 24, 870), b, font=fnt(15), fill=(220, 225, 230) if i != 1 else (255, 235, 220))

    # proof strip
    draw.text((48, 1010), "LIVE CASE STUDY", font=fnt(14, True), fill=ORANGE)
    draw.text((48, 1035), "Already running for Amma Chethi Ruchulu — real WhatsApp ordering.", font=fnt(18, True), fill=INK)

    footer_cta(img, draw, 1120)
    out = OUT / "WA_SYSTEM_POSTER_01_HowItWorks.png"
    img.save(out, "PNG", optimize=True)
    print("Wrote", out)


# ─── POSTER 2: Who it's for + why ───────────────────────────────


def poster_audience():
    W, H = 1080, 1350
    img = Image.new("RGB", (W, H), WHITE)
    draw = ImageDraw.Draw(img)

    # full-bleed navy top hero
    draw.rectangle((0, 0, W, 420), fill=NAVY)
    for i in range(0, W, 16):
        for j in range(0, 420, 16):
            if (i + j) % 48 == 0:
                draw.point((i, j), fill=(20, 40, 70))
    logo = load_logo(120)
    chip = Image.new("RGB", (logo.width + 14, logo.height + 14), WHITE)
    chip.paste(logo, (7, 7))
    paste(img, chip, (40, 28))
    draw.text((40, 170), "WHATEVER YOUR BUSINESS,", font=fnt(22, True), fill=(180, 195, 210))
    draw.text((40, 210), "WHATSAPP CAN RUN IT.", font=fnt(38, True), fill=WHITE)
    draw.text((40, 270), "Orders  ·  Appointments  ·  Repeat services", font=fnt(20), fill=ORANGE2)
    draw.text((40, 320), "One partner. One system. Your number.", font=fnt(18), fill=(170, 185, 200))
    draw.rectangle((0, 420, W, 428), fill=ORANGE)

    # three audience cards with storyset art
    audiences = [
        (OFFICIAL / "10-chef.png", "SELL & DELIVER", "Restaurants · bakery · tiffin\nmeat · flowers · local shops"),
        (OFFICIAL / "09-online-doctor.png", "BOOK & APPOINT", "Clinics · dental · salons\ncoaching · service bays"),
        (OFFICIAL / "04c-groceries.png", "REPEAT SERVICE", "Laundry · water can\nhome service · tailor"),
    ]
    for i, (path, title, body) in enumerate(audiences):
        x = 36 + i * 348
        y = 460
        rr(draw, (x, y, x + 328, y + 420), 22, LIGHT)
        art = fit_contain(path, 300, 220, LIGHT)
        paste(img, art, (x + 14, y + 16))
        draw.text((x + 20, y + 250), title, font=fnt(18, True), fill=ORANGE)
        draw.text((x + 20, y + 285), body, font=fnt(16), fill=INK)

    # why choose row
    draw.text((48, 910), "WHY BUSINESSES CHOOSE THIS", font=fnt(16, True), fill=ORANGE)
    reasons = [
        ("No new app", "Customers stay on WhatsApp"),
        ("Clear ops", "Staff see every order / slot"),
        ("Your brand", "Your number, your customers"),
        ("Fast start", "Go live in days, not months"),
    ]
    for i, (h, b) in enumerate(reasons):
        x = 36 + (i % 4) * 255
        y = 950
        rr(draw, (x, y, x + 240, y + 110), 16, NAVY)
        draw.text((x + 16, y + 22), "✓  " + h, font=fnt(16, True), fill=ORANGE2)
        draw.text((x + 16, y + 58), b, font=fnt(14), fill=(210, 218, 225))

    # bottom strip CTA (compact)
    draw.rectangle((0, 1090, W, H), fill=NAVY2)
    draw.text((48, 1125), "You focus on your business.", font=fnt(24, True), fill=WHITE)
    draw.text((48, 1165), "We handle the WhatsApp system.", font=fnt(24, True), fill=ORANGE2)
    rr(draw, (48, 1225, 400, 1285), 28, ORANGE)
    draw.text((224, 1255), "WHATSAPP FOR A DEMO", font=fnt(16, True), fill=WHITE, anchor="mm")
    draw.text((430, 1240), "+91 80552 92935", font=fnt(20, True), fill=WHITE)
    draw.text((430, 1275), "korviapartners@gmail.com", font=fnt(14), fill=(180, 190, 200))
    if QR.exists():
        qr = Image.open(QR).convert("RGB").resize((100, 100), Image.Resampling.LANCZOS)
        paste(img, qr, (W - 140, 1185))

    out = OUT / "WA_SYSTEM_POSTER_02_WhoItsFor.png"
    img.save(out, "PNG", optimize=True)
    print("Wrote", out)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    poster_system()
    poster_audience()
    # confirm price posters untouched
    for name in ["PRICE_POSTER_WhatsApp_Order_Booking.png", "PRICE_POSTER_WhatsApp_Order_Booking_SQUARE.png"]:
        p = OUT / name
        print("price poster present:" if p.exists() else "MISSING", p.name)
