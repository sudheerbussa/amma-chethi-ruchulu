#!/usr/bin/env python3
"""Price poster for WhatsApp Order & Booking System (from deck slide 6).
No per-order pricing row. Korvia Partners branded.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT_DIR = Path(__file__).resolve().parents[1] / "pitch" / "meta-ads"
ROOT = Path(__file__).resolve().parents[2]
LOGO = ROOT / "korvia-logo.jpeg"
QR = Path(__file__).resolve().parents[1] / "pitch" / "wa-discovery-qr.png"

# Korvia palette
NAVY = (10, 22, 40)
NAVY_DEEP = (6, 14, 28)
ORANGE = (232, 93, 20)
ORANGE_SOFT = (255, 140, 66)
CREAM = (250, 247, 242)
WHITE = (255, 255, 255)
INK = (20, 28, 38)
MUTED = (100, 110, 122)
CARD = (255, 255, 255)
TEAL_LINE = (12, 140, 120)  # WhatsApp-adjacent accent, not brand green clone


def font(size, bold=False):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf" if bold else "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def rounded_rect(draw, xy, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def draw_plan_card(draw, x, y, w, h, name, setup, monthly, items, golive, featured=False):
    # card shadow
    rounded_rect(draw, (x + 6, y + 8, x + w + 6, y + h + 8), 28, (0, 0, 0, 40) if False else (230, 226, 220))
    bg = WHITE
    header = ORANGE if featured else NAVY
    rounded_rect(draw, (x, y, x + w, y + h), 28, bg)
    # header bar
    draw.rounded_rectangle((x, y, x + w, y + 90), radius=28, fill=header)
    draw.rectangle((x, y + 50, x + w, y + 90), fill=header)
    draw.text((x + w // 2, y + 28), name, font=font(36, True), fill=WHITE, anchor="mt")
    if featured:
        draw.text((x + w // 2, y + 62), "MOST CHOSEN", font=font(16, True), fill=WHITE, anchor="mt")

    # prices
    cy = y + 120
    draw.text((x + w // 2, cy), "Setup", font=font(18), fill=MUTED, anchor="mt")
    draw.text((x + w // 2, cy + 28), setup, font=font(42, True), fill=NAVY, anchor="mt")
    draw.text((x + w // 2, cy + 90), "Monthly", font=font(18), fill=MUTED, anchor="mt")
    draw.text((x + w // 2, cy + 118), monthly, font=font(48, True), fill=ORANGE if featured else NAVY, anchor="mt")

    # divider
    draw.line((x + 36, cy + 185, x + w - 36, cy + 185), fill=(230, 226, 220), width=2)

    # features
    feats = [
        f"Up to {items} items / services",
        f"Go-live in {golive}",
        "WhatsApp order or booking",
        "Payments + ops board",
    ]
    fy = cy + 210
    for feat in feats:
        draw.ellipse((x + 36, fy + 6, x + 50, fy + 20), fill=ORANGE if featured else TEAL_LINE)
        draw.text((x + 62, fy), feat, font=font(18), fill=INK)
        fy += 42


def build():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    # Portrait poster — Meta/IG friendly 1080x1350
    W, H = 1080, 1350
    img = Image.new("RGB", (W, H), CREAM)
    draw = ImageDraw.Draw(img)

    # top brand band
    draw.rectangle((0, 0, W, 210), fill=NAVY_DEEP)
    # orange swoosh accent bar
    draw.rectangle((0, 210, W, 218), fill=ORANGE)

    # logo (square mark — trim and place)
    if LOGO.exists():
        logo = Image.open(LOGO).convert("RGBA")
        # flatten onto white for clean chip
        base = Image.new("RGBA", logo.size, (255, 255, 255, 255))
        base.paste(logo, (0, 0), logo if logo.mode == "RGBA" else None)
        logo = base.convert("RGB")
        lw = 150
        ratio = lw / logo.width
        lh = int(logo.height * ratio)
        logo = logo.resize((lw, lh), Image.Resampling.LANCZOS)
        # circular-ish white chip
        chip_w, chip_h = lw + 16, lh + 16
        chip = Image.new("RGB", (chip_w, chip_h), WHITE)
        chip.paste(logo, (8, 8))
        img.paste(chip, (42, 28))

    draw.text((220, 45), "WhatsApp Order", font=font(36, True), fill=WHITE)
    draw.text((220, 90), "& Booking System", font=font(36, True), fill=ORANGE_SOFT)
    draw.text((220, 145), "Simple plans for local businesses in India", font=font(18), fill=(180, 190, 200))

    # hero line
    draw.text((54, 250), "Pick a plan.", font=font(44, True), fill=NAVY)
    draw.text((54, 305), "Run orders & bookings on WhatsApp.", font=font(28), fill=MUTED)

    # three cards
    plans = [
        ("Starter", "₹4,999", "₹1,499", "40", "7–10 days", False),
        ("Growth", "₹7,999", "₹2,499", "100", "10–14 days", True),
        ("Business", "₹12,999", "₹3,499", "250", "2–3 weeks", False),
    ]
    card_w, card_h = 320, 620
    gap = 24
    start_x = (W - (3 * card_w + 2 * gap)) // 2
    card_y = 370
    for i, p in enumerate(plans):
        draw_plan_card(draw, start_x + i * (card_w + gap), card_y, card_w, card_h, *p)

    # bottom band
    by = 1030
    rounded_rect(draw, (40, by, W - 40, by + 200), 24, NAVY)
    draw.text((70, by + 28), "All-in hosted plans", font=font(26, True), fill=ORANGE_SOFT)
    draw.text(
        (70, by + 70),
        "Custom plans for retail / multi-outlet / multi-doctor — contact us.\n"
        "Booking: items = services / doctors / rooms. Meta marketing msgs billed separately.",
        font=font(16),
        fill=(200, 208, 216),
    )
    draw.text((70, by + 140), "WhatsApp demo  ·  +91 80552 92935", font=font(22, True), fill=WHITE)

    # QR
    if QR.exists():
        qr = Image.open(QR).convert("RGB").resize((120, 120), Image.Resampling.LANCZOS)
        img.paste(qr, (W - 180, by + 40))

    draw.text((54, H - 40), "Korvia Partners  ·  Illustrative pricing", font=font(14), fill=MUTED)

    out1 = OUT_DIR / "PRICE_POSTER_WhatsApp_Order_Booking.png"
    img.save(out1, "PNG", optimize=True)
    print("Wrote", out1)

    # Also square 1080 version for feed
    S = 1080
    sq = Image.new("RGB", (S, S), CREAM)
    d = ImageDraw.Draw(sq)
    d.rectangle((0, 0, S, 170), fill=NAVY_DEEP)
    d.rectangle((0, 170, S, 178), fill=ORANGE)
    if LOGO.exists():
        logo = Image.open(LOGO).convert("RGBA")
        base = Image.new("RGBA", logo.size, (255, 255, 255, 255))
        base.paste(logo, (0, 0), logo if logo.mode == "RGBA" else None)
        logo = base.convert("RGB")
        lw = 120
        lh = int(logo.height * (lw / logo.width))
        logo = logo.resize((lw, lh), Image.Resampling.LANCZOS)
        chip = Image.new("RGB", (lw + 12, lh + 12), WHITE)
        chip.paste(logo, (6, 6))
        sq.paste(chip, (28, 22))
    d.text((180, 35), "WhatsApp Order & Booking", font=font(28, True), fill=WHITE)
    d.text((180, 80), "Plans for small businesses · India", font=font(18), fill=ORANGE_SOFT)
    d.text((180, 115), "All-in hosted", font=font(16), fill=(180, 190, 200))

    plans2 = [
        ("Starter", "₹4,999", "₹1,499", "40", "7–10d", False),
        ("Growth", "₹7,999", "₹2,499", "100", "10–14d", True),
        ("Business", "₹12,999", "₹3,499", "250", "2–3w", False),
    ]
    cw, ch = 310, 580
    g = 20
    sx = (S - (3 * cw + 2 * g)) // 2
    for i, p in enumerate(plans2):
        name, setup, monthly, items, golive, feat = p
        draw_plan_card(d, sx + i * (cw + g), 210, cw, ch, name, setup, monthly, items, golive, feat)

    d.text((40, S - 55), "Custom / multi-outlet — contact us   ·   +91 80552 92935", font=font(18, True), fill=NAVY)
    out2 = OUT_DIR / "PRICE_POSTER_WhatsApp_Order_Booking_SQUARE.png"
    sq.save(out2, "PNG", optimize=True)
    print("Wrote", out2)


if __name__ == "__main__":
    build()
